import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    weeksPerCredit: { type: Number, default: 4, min: 1 },
    minimumScore: { type: Number, default: 0, min: 0, max: 100 },
    eligiblePlatforms: [{ type: String, trim: true }],
    maxCreditsPerStudent: { type: Number, default: 20, min: 0 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('CreditPolicy', schema);
