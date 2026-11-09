import { z } from 'zod';

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url('Enter a valid URL')
  .refine((u) => /^https?:\/\//i.test(u), 'Only http(s) links are allowed'); // blocks javascript:, data:

const password = z.string().min(10, 'Password must be at least 10 characters').max(128);
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Multipart forms send everything as strings; '' and null both mean "not provided".
const optionalNumber = (min, max) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().min(min).max(max).nullable());
const optionalDate = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.date().nullable());

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
  department: z.string().trim().max(100).optional().default(''),
  rollNumber: z.string().trim().max(50).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().max(254),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(128),
});

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  department: z.string().trim().max(100).optional().default(''),
  rollNumber: z.string().trim().max(50).optional().default(''),
});

export const certificationSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(180),
  platform: z.string().trim().min(1).max(80),
  category: z.string().trim().max(80).optional().default('General'),
  durationWeeks: z.coerce.number().int().min(1).max(104),
  assessmentScore: optionalNumber(0, 100).optional().default(null),
  certificateId: z.string().trim().max(120).optional().default(''),
  issueDate: optionalDate.optional().default(null),
  proofUrl: z.preprocess((v) => (v === '' ? undefined : v), httpUrl.optional()),
});

export const reviewSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'correction', 'review']),
    comment: z.string().trim().max(1000).optional().default(''),
  })
  .refine((d) => !['reject', 'correction'].includes(d.decision) || d.comment.length >= 5, {
    message: 'Please give a reason (at least 5 characters) when rejecting or requesting a correction',
    path: ['comment'],
  });

export const assignSchema = z.object({ facultyId: objectId.nullable() });

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
  role: z.enum(['FACULTY', 'ADMIN', 'SUPER_ADMIN']),
  department: z.string().trim().max(100).optional().default(''),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    department: z.string().trim().max(100),
    role: z.enum(['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN']),
    isActive: z.boolean(),
  })
  .partial();

export const resetPasswordSchema = z.object({ password });

export const policySchema = z.object({
  name: z.string().trim().min(2).max(120),
  weeksPerCredit: z.coerce.number().min(1).max(52),
  minimumScore: z.coerce.number().min(0).max(100),
  maxCreditsPerStudent: z.coerce.number().min(0).max(1000),
  eligiblePlatforms: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
});

export const idParam = z.object({ id: objectId });
