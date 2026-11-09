import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from '../utils/httpError.js';

export async function protect(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new HttpError(401, 'Authentication required'));
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(new HttpError(401, 'Invalid or expired session'));
    }
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user || !user.isActive) return next(new HttpError(401, 'Account unavailable'));
    // Invalidate sessions issued before the last password change.
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      return next(new HttpError(401, 'Session expired. Please sign in again'));
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Insufficient permissions'));

export const REVIEWERS = ['FACULTY', 'ADMIN', 'SUPER_ADMIN'];
export const ADMINS = ['ADMIN', 'SUPER_ADMIN'];
