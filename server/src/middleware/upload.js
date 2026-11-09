import multer from 'multer';

// Memory storage + 5 MB cap; the controller verifies the real file type before persisting.
export const uploadProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
}).single('proofFile');
