import mongoose from 'mongoose';

export const OPEN_STATUSES = ['PENDING', 'UNDER_REVIEW'];
export const STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const proofFileSchema = new mongoose.Schema(
  {
    storage: { type: String, enum: ['local', 'cloudinary'], required: true },
    key: { type: String, required: true }, // file name on disk or Cloudinary public_id
    originalName: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    resourceType: { type: String, default: 'raw' }, // cloudinary only
  },
  { _id: false, toJSON: { transform: (doc, ret) => { delete ret.key; return ret; } } } // never expose storage keys
);

const certificationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    platform: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, default: 'General', trim: true, maxlength: 80 },
    durationWeeks: { type: Number, required: true, min: 1, max: 104 },
    assessmentScore: { type: Number, min: 0, max: 100, default: null },
    certificateId: { type: String, trim: true, default: '', maxlength: 120 },
    issueDate: { type: Date, default: null },
    proofUrl: { type: String, default: '' },
    proofFile: { type: proofFileSchema, default: null },
    fileHash: { type: String, default: '', index: true },
    flags: { type: [String], default: [] }, // e.g. DUPLICATE_FILE, DUPLICATE_CERTIFICATE_ID
    status: { type: String, enum: STATUSES, default: 'PENDING', index: true },
    facultyComment: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    history: { type: [historySchema], default: [] },
    creditsAwarded: { type: Number, default: 0 },
    creditNote: { type: String, default: '' },
  },
  { timestamps: true }
);

certificationSchema.index(
  { student: 1, certificateId: 1 },
  { unique: true, partialFilterExpression: { certificateId: { $type: 'string', $gt: '' } } }
);
certificationSchema.index({ student: 1, status: 1, createdAt: -1 });
certificationSchema.index({ assignedTo: 1, status: 1, createdAt: 1 });

export default mongoose.model('Certification', certificationSchema);
