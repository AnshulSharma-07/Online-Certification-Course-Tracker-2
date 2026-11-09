import { Router } from 'express';
import { protect, allow, REVIEWERS, ADMINS } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadProof } from '../middleware/upload.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { certificationSchema, reviewSchema, assignSchema, idParam } from '../validators/schemas.js';
import * as c from '../controllers/certification.controller.js';

const router = Router();
router.use(protect);
const id = validate(idParam, 'params');

router.get('/dashboard', h(c.dashboard));
router.get('/my', allow('STUDENT'), h(c.myCertifications));
router.get('/credits', allow('STUDENT'), h(c.myCredits));
router.get('/review-queue', allow(...REVIEWERS), h(c.facultyQueue));
router.post('/', allow('STUDENT'), uploadProof, validate(certificationSchema), h(c.createCertification));

router.get('/:id', id, h(c.getCertification));
router.get('/:id/proof', id, h(c.downloadProof));
router.put('/:id', allow('STUDENT'), id, uploadProof, validate(certificationSchema), h(c.resubmitCertification));
router.delete('/:id', allow('STUDENT'), id, h(c.deleteCertification));
router.patch('/:id/review', allow(...REVIEWERS), id, validate(reviewSchema), h(c.reviewCertification));
router.patch('/:id/assign', allow(...ADMINS), id, validate(assignSchema), h(c.assignCertification));
export default router;
