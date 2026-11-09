import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../validators/schemas.js';
import { listNotifications, markRead, markAllRead } from '../controllers/notification.controller.js';

const router = Router();
router.use(protect);
router.get('/', h(listNotifications));
router.patch('/read-all', h(markAllRead));
router.patch('/:id/read', validate(idParam, 'params'), h(markRead));
export default router;
