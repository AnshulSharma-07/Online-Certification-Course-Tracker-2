import mongoose from 'mongoose';

export const ROLES = ['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'STUDENT', index: true },
    department: { type: String, trim: true, default: '' },
    rollNumber: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    // Tokens issued before this moment are rejected (set on password change/reset).
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
userSchema.index({ role: 1, department: 1 });
userSchema.index({ name: 'text', email: 'text' });

export default mongoose.model('User', userSchema);
