import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me, updateProfile, changePassword } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { registerSchema, loginSchema, profileSchema, changePasswordSchema } from '../validators/schemas.js';

const router = Router();
// Brute-force protection: failed attempts count, successful logins don't.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes' },
});

router.post('/register', authLimiter, validate(registerSchema), h(register));
router.post('/login', authLimiter, validate(loginSchema), h(login));
router.post('/logout', logout);
router.get('/me', protect, me);
router.patch('/profile', protect, validate(profileSchema), h(updateProfile));
router.patch('/password', protect, validate(changePasswordSchema), h(changePassword));
export default router;
