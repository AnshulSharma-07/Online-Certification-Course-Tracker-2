import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { cookieOptions } from '../config/env.js';
import { HttpError, conflict } from '../utils/httpError.js';
import { audit } from '../utils/audit.js';

export const safeUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
  rollNumber: u.rollNumber,
});

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

function issueToken(res, user) {
  const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
  res.cookie('token', token, cookieOptions());
}

export async function register(req, res) {
  const { name, email, password, department, rollNumber } = req.body;
  if (await User.exists({ email })) throw conflict('Email is already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, department, rollNumber, role: 'STUDENT' });
  res.status(201).json({ user: safeUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw new HttpError(401, 'Invalid email or password');
  issueToken(res, user);
  res.json({ user: safeUser(user) });
}

export function logout(req, res) {
  const { maxAge, ...opts } = cookieOptions(); // eslint-disable-line no-unused-vars
  res.clearCookie('token', opts);
  res.json({ message: 'Logged out' });
}

export function me(req, res) {
  res.json({ user: safeUser(req.user) });
}

export async function updateProfile(req, res) {
  const { name, department, rollNumber } = req.body;
  Object.assign(req.user, { name, department, ...(req.user.role === 'STUDENT' ? { rollNumber } : {}) });
  await req.user.save();
  res.json({ user: safeUser(req.user) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  await audit(req, 'PASSWORD_CHANGED', 'User', user._id);
  // Older sessions are now invalid (see protect()); keep this one signed in with a fresh token.
  issueToken(res, user);
  res.json({ message: 'Password updated' });
}
