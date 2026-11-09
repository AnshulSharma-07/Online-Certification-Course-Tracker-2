import fs from 'node:fs/promises';
import Certification, { OPEN_STATUSES } from '../models/Certification.js';
import AwardedCredit from '../models/AwardedCredit.js';
import User from '../models/User.js';
import { awardCredits } from '../services/credit.service.js';
import { pickReviewer } from '../services/assignment.service.js';
import { detectType, saveProof, resolveProof, deleteProof, sha256 } from '../services/storage.service.js';
import { badRequest, forbidden, notFound, conflict } from '../utils/httpError.js';
import { audit } from '../utils/audit.js';
import { notify } from '../utils/notify.js';

const isReviewer = (u) => ['FACULTY', 'ADMIN', 'SUPER_ADMIN'].includes(u.role);
const REVIEW_MAP = { approve: 'APPROVED', reject: 'REJECTED', correction: 'CORRECTION_REQUIRED', review: 'UNDER_REVIEW' };
const STUDENT_POPULATE = 'name email department rollNumber';

/** Validates + stores an uploaded file (if any). Returns { proofFile, fileHash } or null. */
async function handleUpload(file) {
  if (!file) return null;
  const type = detectType(file.buffer);
  if (!type) throw badRequest('Unsupported file. Upload a PDF, PNG or JPEG file');
  return { proofFile: await saveProof(file, type), fileHash: sha256(file.buffer) };
}

async function computeFlags(cert) {
  const flags = [];
  if (cert.fileHash && (await Certification.exists({ fileHash: cert.fileHash, student: { $ne: cert.student }, _id: { $ne: cert._id } }))) flags.push('DUPLICATE_FILE');
  if (cert.certificateId) {
    const idRegex = new RegExp(`^${cert.certificateId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (await Certification.exists({ platform: new RegExp(`^${cert.platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), certificateId: idRegex, student: { $ne: cert.student }, _id: { $ne: cert._id } })) flags.push('DUPLICATE_CERTIFICATE_ID');
  }
  return flags;
}

export async function createCertification(req, res) {
  const body = req.body;
  const upload = await handleUpload(req.file);
  if (!upload && !body.proofUrl) throw badRequest('Provide a certificate file or a proof URL');

  let cert;
  try {
    cert = new Certification({
      ...body,
      student: req.user._id,
      proofUrl: body.proofUrl || '',
      ...(upload || {}),
      assignedTo: await pickReviewer(req.user.department),
      status: 'PENDING',
      history: [{ status: 'PENDING', actor: req.user._id, comment: 'Submitted by student' }],
    });
    cert.flags = await computeFlags(cert);
    await cert.save();
  } catch (err) {
    if (upload) await deleteProof(upload.proofFile);
    if (err.code === 11000) throw conflict('You have already submitted a certificate with this certificate ID');
    throw err;
  }
  await audit(req, 'CERT_SUBMITTED', 'Certification', cert._id, { title: cert.title, flags: cert.flags });
  await notify(cert.assignedTo, 'New certificate to review', `${req.user.name} submitted “${cert.title}”.`, '/review');
  res.status(201).json({ certification: cert });
}

export async function myCertifications(req, res) {
  const filter = { student: req.user._id };
  if (req.query.status) filter.status = String(req.query.status);
  const items = await Certification.find(filter).sort({ createdAt: -1 }).populate('assignedTo', 'name');
  res.json({ certifications: items });
}

export async function getCertification(req, res) {
  const cert = await Certification.findById(req.params.id)
    .populate('student', STUDENT_POPULATE)
    .populate('assignedTo', 'name email')
    .populate('history.actor', 'name role');
  if (!cert) throw notFound('Certificate not found');
  if (!isReviewer(req.user) && String(cert.student._id) !== String(req.user._id)) throw notFound('Certificate not found');
  res.json({ certification: cert });
}

/** Student edits a submission the faculty sent back, which re-enters the queue as PENDING. */
export async function resubmitCertification(req, res) {
  const cert = await Certification.findOne({ _id: req.params.id, student: req.user._id });
  if (!cert) throw notFound('Certificate not found');
  if (cert.status !== 'CORRECTION_REQUIRED') throw conflict('Only submissions that need correction can be edited');

  const body = req.body;
  const upload = await handleUpload(req.file);
  const newProofUrl = body.proofUrl || (upload ? '' : cert.proofUrl);
  if (!upload && !cert.proofFile && !newProofUrl) throw badRequest('Provide a certificate file or a proof URL');

  const oldFile = upload && cert.proofFile ? cert.proofFile.toObject() : null; // copy: the subdocument is replaced below
  Object.assign(cert, {
    title: body.title, platform: body.platform, category: body.category, durationWeeks: body.durationWeeks,
    assessmentScore: body.assessmentScore, certificateId: body.certificateId, issueDate: body.issueDate,
    proofUrl: newProofUrl, status: 'PENDING',
  });
  if (upload) Object.assign(cert, upload);
  cert.facultyComment = '';
  cert.flags = await computeFlags(cert);
  cert.history.push({ status: 'PENDING', actor: req.user._id, comment: 'Resubmitted after correction' });
  try {
    await cert.save();
  } catch (err) {
    if (upload) await deleteProof(upload.proofFile);
    if (err.code === 11000) throw conflict('You have already submitted a certificate with this certificate ID');
    throw err;
  }
  await deleteProof(oldFile);
  await audit(req, 'CERT_RESUBMITTED', 'Certification', cert._id);
  await notify(cert.assignedTo || cert.reviewedBy, 'Certificate resubmitted', `${req.user.name} corrected “${cert.title}”.`, '/review');
  res.json({ certification: cert });
}

export async function deleteCertification(req, res) {
  const cert = await Certification.findOne({ _id: req.params.id, student: req.user._id });
  if (!cert) throw notFound('Certificate not found');
  if (!['PENDING', 'CORRECTION_REQUIRED'].includes(cert.status)) throw conflict('Only pending or returned submissions can be withdrawn');
  await cert.deleteOne();
  await deleteProof(cert.proofFile);
  await audit(req, 'CERT_WITHDRAWN', 'Certification', cert._id, { title: cert.title });
  res.json({ message: 'Submission withdrawn' });
}

/** Streams an uploaded proof file to the owner or a reviewer; access is checked on every request. */
export async function downloadProof(req, res) {
  const cert = await Certification.findById(req.params.id).select('student proofFile proofUrl');
  if (!cert) throw notFound('Certificate not found');
  if (!isReviewer(req.user) && String(cert.student) !== String(req.user._id)) throw notFound('Certificate not found');
  if (!cert.proofFile) throw notFound('This submission has no uploaded file');
  const target = await resolveProof(cert.proofFile).catch(() => null);
  if (!target) throw notFound('The stored file could not be found');
  if (target.kind === 'redirect') return res.json({ url: target.url });
  res.set({
    'Content-Type': cert.proofFile.mimeType,
    'Content-Disposition': `inline; filename="proof${cert.proofFile.mimeType === 'application/pdf' ? '.pdf' : ''}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'Cache-Control': 'private, no-store',
  });
  res.send(await fs.readFile(target.path));
}

function queueScope(user) {
  // Faculty: items assigned to them plus the shared pool (no faculty in the student's department).
  return user.role === 'FACULTY' ? { $or: [{ assignedTo: user._id }, { assignedTo: null }] } : {};
}

export async function facultyQueue(req, res) {
  const tab = ['open', 'correction', 'reviewed', 'all'].includes(req.query.tab) ? req.query.tab : 'open';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const scope = queueScope(req.user);
  const reviewedScope = req.user.role === 'FACULTY' ? { reviewedBy: req.user._id } : {};

  const tabFilter = {
    open: { $and: [scope, { status: { $in: OPEN_STATUSES } }] },
    correction: { $and: [scope, { status: 'CORRECTION_REQUIRED' }] },
    reviewed: { $and: [reviewedScope, { status: { $in: ['APPROVED', 'REJECTED'] } }] },
    all: scope,
  };
  const filter = { ...tabFilter[tab] };
  if (req.user.role !== 'FACULTY' && req.query.assignedTo) {
    filter.$and = [...(filter.$and || []), req.query.assignedTo === 'unassigned' ? { assignedTo: null } : { assignedTo: String(req.query.assignedTo) }];
  }
  const [items, total, open, correction, reviewed] = await Promise.all([
    Certification.find(filter).populate('student', STUDENT_POPULATE).populate('assignedTo', 'name')
      .sort(tab === 'reviewed' ? { reviewedAt: -1 } : { createdAt: 1 }).skip((page - 1) * limit).limit(limit),
    Certification.countDocuments(filter),
    Certification.countDocuments(tabFilter.open),
    Certification.countDocuments(tabFilter.correction),
    Certification.countDocuments(tabFilter.reviewed),
  ]);
  res.json({ certifications: items, page, pages: Math.max(1, Math.ceil(total / limit)), total, counts: { open, correction, reviewed } });
}

export async function reviewCertification(req, res) {
  const { decision, comment } = req.body;
  const nextStatus = REVIEW_MAP[decision];
  const cert = await Certification.findById(req.params.id);
  if (!cert) throw notFound('Certificate not found');
  if (req.user.role === 'FACULTY' && cert.assignedTo && String(cert.assignedTo) !== String(req.user._id)) {
    throw forbidden('This submission is assigned to another faculty member');
  }
  if (!OPEN_STATUSES.includes(cert.status)) {
    throw conflict(cert.status === 'CORRECTION_REQUIRED' ? 'Waiting for the student to resubmit' : 'This submission has already been finalized');
  }
  const previous = cert.status;

  // Atomic claim: if two reviewers act at once only one update matches.
  const claimed = await Certification.findOneAndUpdate(
    { _id: cert._id, status: previous },
    {
      $set: { status: nextStatus, facultyComment: comment, reviewedBy: req.user._id, reviewedAt: new Date(), assignedTo: cert.assignedTo || req.user._id },
      $push: { history: { status: nextStatus, actor: req.user._id, comment, at: new Date() } },
    },
    { new: true }
  );
  if (!claimed) throw conflict('This submission was just updated by someone else. Refresh and try again');

  let creditText = '';
  if (decision === 'approve') {
    try {
      const { record, reason } = await awardCredits(claimed, req.user._id);
      claimed.creditsAwarded = record?.credits || 0;
      claimed.creditNote = record ? reason : reason || 'No credits awarded';
      await claimed.save();
      creditText = record ? ` ${record.credits} credit(s) awarded.` : ` No credits awarded: ${reason}.`;
    } catch (err) {
      // Don't leave an approval without its credit decision; roll back so it can be retried.
      await Certification.updateOne({ _id: claimed._id }, { $set: { status: previous, reviewedBy: null, reviewedAt: null }, $pop: { history: 1 } });
      throw err;
    }
  }
  await audit(req, `CERT_${nextStatus}`, 'Certification', claimed._id, { comment, credits: claimed.creditsAwarded });
  await notify(
    claimed.student,
    `Certificate ${nextStatus.toLowerCase().replaceAll('_', ' ')}`,
    `“${claimed.title}”: ${comment || 'your submission was reviewed.'}${creditText}`,
    '/certificates'
  );
  res.json({ certification: claimed });
}

export async function assignCertification(req, res) {
  const { facultyId } = req.body;
  const cert = await Certification.findById(req.params.id);
  if (!cert) throw notFound('Certificate not found');
  if (!OPEN_STATUSES.includes(cert.status) && cert.status !== 'CORRECTION_REQUIRED') throw conflict('Finalized submissions cannot be reassigned');
  if (facultyId) {
    if (!(await User.exists({ _id: facultyId, role: 'FACULTY', isActive: true }))) throw badRequest('Selected user is not an active faculty member');
  }
  cert.assignedTo = facultyId;
  await cert.save();
  await audit(req, 'CERT_ASSIGNED', 'Certification', cert._id, { facultyId });
  await notify(facultyId, 'Submission assigned to you', `“${cert.title}” was assigned to you for verification.`, '/review');
  res.json({ certification: cert });
}

export async function dashboard(req, res) {
  if (req.user.role === 'STUDENT') {
    const sid = req.user._id;
    const [byStatus, credit, recent] = await Promise.all([
      Certification.aggregate([{ $match: { student: sid } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      AwardedCredit.aggregate([{ $match: { student: sid } }, { $group: { _id: null, total: { $sum: '$credits' } } }]),
      Certification.find({ student: sid }).sort({ createdAt: -1 }).limit(5).select('title platform status creditsAwarded createdAt'),
    ]);
    const n = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    return res.json({
      total: byStatus.reduce((a, s) => a + s.n, 0),
      pending: (n.PENDING || 0) + (n.UNDER_REVIEW || 0) + (n.CORRECTION_REQUIRED || 0),
      needsCorrection: n.CORRECTION_REQUIRED || 0,
      approved: n.APPROVED || 0,
      rejected: n.REJECTED || 0,
      credits: credit[0]?.total || 0,
      recent,
    });
  }
  const scope = queueScope(req.user);
  const [open, correction, approved, rejected, total, myReviewed] = await Promise.all([
    Certification.countDocuments({ ...scope, status: { $in: OPEN_STATUSES } }),
    Certification.countDocuments({ ...scope, status: 'CORRECTION_REQUIRED' }),
    Certification.countDocuments({ status: 'APPROVED' }),
    Certification.countDocuments({ status: 'REJECTED' }),
    Certification.countDocuments(),
    Certification.countDocuments({ reviewedBy: req.user._id }),
  ]);
  res.json({ total, pending: open, needsCorrection: correction, approved, rejected, myReviewed });
}

export async function myCredits(req, res) {
  const records = await AwardedCredit.find({ student: req.user._id }).populate('certification', 'title platform durationWeeks').sort({ createdAt: -1 });
  res.json({ records, total: records.reduce((sum, r) => sum + r.credits, 0) });
}
