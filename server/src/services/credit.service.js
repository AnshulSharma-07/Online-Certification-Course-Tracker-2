import CreditPolicy from '../models/CreditPolicy.js';
import AwardedCredit from '../models/AwardedCredit.js';

/**
 * Pure calculation, kept free of I/O so it can be unit tested.
 * Returns { credits, reason } where credits === 0 means "not eligible" and reason says why.
 */
export function calculateCredits(cert, policy, alreadyAwarded = 0) {
  const weeksPerCredit = policy?.weeksPerCredit || 4;
  const minimumScore = policy?.minimumScore || 0;
  const max = policy?.maxCreditsPerStudent ?? 20;
  const platforms = (policy?.eligiblePlatforms || []).map((p) => p.toLowerCase());

  if (platforms.length && !platforms.includes(String(cert.platform).toLowerCase())) {
    return { credits: 0, reason: `Platform "${cert.platform}" is not eligible under the active credit policy` };
  }
  if (minimumScore > 0) {
    if (cert.assessmentScore == null) return { credits: 0, reason: `An assessment score of at least ${minimumScore}% is required` };
    if (cert.assessmentScore < minimumScore) return { credits: 0, reason: `Score ${cert.assessmentScore}% is below the required ${minimumScore}%` };
  }
  const base = Math.floor(cert.durationWeeks / weeksPerCredit);
  if (base <= 0) return { credits: 0, reason: `Duration of ${cert.durationWeeks} weeks is below the ${weeksPerCredit} weeks needed for one credit` };
  const remaining = Math.max(0, max - alreadyAwarded);
  if (remaining <= 0) return { credits: 0, reason: `Student has reached the maximum of ${max} credits` };
  return { credits: Math.min(base, remaining), reason: base > remaining ? `Capped at the ${max}-credit maximum` : '' };
}

export async function getActivePolicy() {
  return CreditPolicy.findOne({ active: true }).sort({ createdAt: -1 });
}

/** Idempotent: a certification can only ever produce one AwardedCredit (unique index). */
export async function awardCredits(certification, reviewerId) {
  const existing = await AwardedCredit.findOne({ certification: certification._id });
  if (existing) return { record: existing, reason: '' };

  const policy = await getActivePolicy();
  const [agg] = await AwardedCredit.aggregate([
    { $match: { student: certification.student } },
    { $group: { _id: null, total: { $sum: '$credits' } } },
  ]);
  const { credits, reason } = calculateCredits(certification, policy, agg?.total || 0);
  if (!credits) return { record: null, reason };

  try {
    const record = await AwardedCredit.create({
      student: certification.student,
      certification: certification._id,
      credits,
      policy: policy?._id || null,
      awardedBy: reviewerId,
    });
    return { record, reason };
  } catch (err) {
    if (err.code === 11000) return { record: await AwardedCredit.findOne({ certification: certification._id }), reason: '' };
    throw err;
  }
}
