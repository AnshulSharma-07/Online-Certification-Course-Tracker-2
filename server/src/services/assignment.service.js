import User from '../models/User.js';
import Certification, { OPEN_STATUSES } from '../models/Certification.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Picks the active faculty member from the student's department with the fewest open reviews.
 * Returns null when the department has no faculty; such items stay in the shared pool
 * that every faculty member and admin can see.
 */
export async function pickReviewer(department) {
  if (!department) return null;
  const faculty = await User.find({
    role: 'FACULTY',
    isActive: true,
    department: new RegExp(`^${escapeRegex(department)}$`, 'i'),
  }).select('_id');
  if (!faculty.length) return null;
  const loads = await Certification.aggregate([
    { $match: { assignedTo: { $in: faculty.map((f) => f._id) }, status: { $in: OPEN_STATUSES } } },
    { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
  ]);
  const load = new Map(loads.map((l) => [String(l._id), l.n]));
  return faculty.sort((a, b) => (load.get(String(a._id)) || 0) - (load.get(String(b._id)) || 0))[0]._id;
}
