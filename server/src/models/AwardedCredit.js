import mongoose from 'mongoose';
const schema = new mongoose.Schema({ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, certification: { type: mongoose.Schema.Types.ObjectId, ref: 'Certification', required: true, unique: true }, credits: { type: Number, required: true, min: 0 }, policy: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditPolicy', default: null }, awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
schema.index({ student: 1, createdAt: -1 });
export default mongoose.model('AwardedCredit', schema);
