import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import CreditPolicy from '../models/CreditPolicy.js';
import Certification from '../models/Certification.js';
import AwardedCredit from '../models/AwardedCredit.js';
import AuditLog from '../models/AuditLog.js';
import { badRequest, forbidden, notFound, conflict } from '../utils/httpError.js';
import { audit } from '../utils/audit.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department, isActive: u.isActive });
const isSuper = (u) => u.role === 'SUPER_ADMIN';
const paging = (q, max = 100) => ({
  page: Math.max(1, Number(q.page) || 1),
  limit: Math.min(max, Math.max(1, Number(q.limit) || 20)),
});

/* ---------------------------------- users --------------------------------- */

export async function listUsers(req, res) {
  const { page, limit } = paging(req.query);
  const filter = {};
  if (['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { department: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ users, page, pages: Math.max(1, Math.ceil(total / limit)), total });
}

export async function listFaculty(req, res) {
  const faculty = await User.find({ role: 'FACULTY', isActive: true }).select('name email department').sort({ name: 1 });
  res.json({ faculty });
}

export async function createUser(req, res) {
  const { name, email, password, role, department } = req.body;
  if (!isSuper(req.user) && role !== 'FACULTY') throw forbidden('Only a Super Admin can create administrators');
  if (await User.exists({ email })) throw conflict('Email is already registered');
  const user = await User.create({ name, email, department, role, passwordHash: await bcrypt.hash(password, 12) });
  await audit(req, 'USER_CREATED', 'User', user._id, { email, role });
  res.status(201).json({ user: publicUser(user) });
}

export async function updateUser(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) throw notFound('User not found');
  const changes = req.body;
  const isSelf = String(target._id) === String(req.user._id);

  // Admins manage students and faculty; only a Super Admin touches administrator accounts or roles.
  if (!isSuper(req.user)) {
    if (['ADMIN', 'SUPER_ADMIN'].includes(target.role)) throw forbidden('Only a Super Admin can modify administrator accounts');
    if (changes.role && !['STUDENT', 'FACULTY'].includes(changes.role)) throw forbidden('Only a Super Admin can grant administrator roles');
  }
  if (isSelf && (changes.isActive === false || (changes.role && changes.role !== target.role))) {
    throw badRequest('You cannot deactivate or change the role of your own account');
  }
  const losesSuper = target.role === 'SUPER_ADMIN' && (changes.isActive === false || (changes.role && changes.role !== 'SUPER_ADMIN'));
  if (losesSuper && (await User.countDocuments({ role: 'SUPER_ADMIN', isActive: true, _id: { $ne: target._id } })) === 0) {
    throw badRequest('At least one active Super Admin must remain');
  }
  Object.assign(target, changes);
  await target.save();
  await audit(req, 'USER_UPDATED', 'User', target._id, changes);
  res.json({ user: publicUser(target) });
}

export async function resetUserPassword(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) throw notFound('User not found');
  if (!isSuper(req.user) && ['ADMIN', 'SUPER_ADMIN'].includes(target.role)) throw forbidden('Only a Super Admin can reset administrator passwords');
  target.passwordHash = await bcrypt.hash(req.body.password, 12);
  target.passwordChangedAt = new Date();
  await target.save();
  await audit(req, 'USER_PASSWORD_RESET', 'User', target._id);
  res.json({ message: 'Password reset. The user has been signed out everywhere' });
}

/* --------------------------------- policies -------------------------------- */

export async function getPolicy(req, res) {
  res.json({ policy: await CreditPolicy.findOne({ active: true }).sort({ createdAt: -1 }) });
}

export async function listPolicies(req, res) {
  res.json({ policies: await CreditPolicy.find().sort({ createdAt: -1 }).limit(25).populate('createdBy', 'name') });
}

/** Policies are immutable once saved; a change creates a new version and retires the old one. */
export async function savePolicy(req, res) {
  await CreditPolicy.updateMany({ active: true }, { active: false });
  const policy = await CreditPolicy.create({ ...req.body, active: true, createdBy: req.user._id });
  await audit(req, 'POLICY_SAVED', 'CreditPolicy', policy._id, req.body);
  res.status(201).json({ policy });
}

/* --------------------------------- reports --------------------------------- */

export async function reports(req, res) {
  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  since.setHours(0, 0, 0, 0);

  const [byStatus, byPlatform, byMonth, creditsByDept, totals, userCounts] = await Promise.all([
    Certification.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Certification.aggregate([{ $group: { _id: '$platform', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Certification.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    AwardedCredit.aggregate([
      { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 's' } },
      { $unwind: '$s' },
      { $group: { _id: { $ifNull: [{ $cond: [{ $eq: ['$s.department', ''] }, null, '$s.department'] }, 'Unspecified'] }, credits: { $sum: '$credits' }, students: { $addToSet: '$student' } } },
      { $project: { credits: 1, students: { $size: '$students' } } },
      { $sort: { credits: -1 } },
      { $limit: 10 },
    ]),
    AwardedCredit.aggregate([{ $group: { _id: null, credits: { $sum: '$credits' } } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);

  // Fill gaps so the chart always shows 12 consecutive months.
  const monthMap = new Map(byMonth.map((m) => [m._id, m.count]));
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: key, count: monthMap.get(key) || 0 });
  }
  res.json({
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    byPlatform: byPlatform.map((p) => ({ platform: p._id, count: p.count })),
    byMonth: months,
    creditsByDepartment: creditsByDept.map((d) => ({ department: d._id, credits: d.credits, students: d.students })),
    totalCredits: totals[0]?.credits || 0,
    users: Object.fromEntries(userCounts.map((u) => [u._id, u.count])),
  });
}

// Spreadsheet apps execute cells starting with = + - @ as formulas; neutralise user-controlled text.
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

export async function exportCreditsCsv(req, res) {
  const records = await AwardedCredit.find()
    .sort({ createdAt: -1 })
    .populate('student', 'name email department rollNumber')
    .populate('certification', 'title platform durationWeeks assessmentScore certificateId')
    .limit(50000);
  const header = ['Student', 'Email', 'Roll number', 'Department', 'Certificate', 'Platform', 'Certificate ID', 'Duration (weeks)', 'Score', 'Credits', 'Awarded on'];
  const rows = records.map((r) => [
    r.student?.name, r.student?.email, r.student?.rollNumber, r.student?.department,
    r.certification?.title, r.certification?.platform, r.certification?.certificateId, r.certification?.durationWeeks,
    r.certification?.assessmentScore, r.credits, r.createdAt.toISOString().slice(0, 10),
  ]);
  await audit(req, 'CREDITS_EXPORTED', 'AwardedCredit', '', { rows: rows.length });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="awarded-credits.csv"' });
  res.send([header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'));
}

export async function listAuditLogs(req, res) {
  const { page, limit } = paging(req.query, 100);
  const filter = req.query.action ? { action: String(req.query.action).slice(0, 60) } : {};
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name role'),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ logs, page, pages: Math.max(1, Math.ceil(total / limit)), total });
}
