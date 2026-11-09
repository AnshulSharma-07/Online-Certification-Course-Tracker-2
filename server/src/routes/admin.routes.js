import { Router } from 'express';
import { protect, allow, ADMINS } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { createUserSchema, updateUserSchema, resetPasswordSchema, policySchema, idParam } from '../validators/schemas.js';
import * as a from '../controllers/admin.controller.js';

const router = Router();
router.use(protect, allow(...ADMINS));

router.get('/users', h(a.listUsers));
router.post('/users', validate(createUserSchema), h(a.createUser));
router.patch('/users/:id', validate(idParam, 'params'), validate(updateUserSchema), h(a.updateUser));
router.post('/users/:id/reset-password', validate(idParam, 'params'), validate(resetPasswordSchema), h(a.resetUserPassword));
router.get('/faculty', h(a.listFaculty));

router.get('/credit-policy', h(a.getPolicy));
router.get('/credit-policies', h(a.listPolicies));
router.post('/credit-policy', validate(policySchema), h(a.savePolicy));

router.get('/reports', h(a.reports));
router.get('/reports/credits.csv', h(a.exportCreditsCsv));
router.get('/audit-logs', h(a.listAuditLogs));
export default router;
