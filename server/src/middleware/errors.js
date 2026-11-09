import { ZodError } from 'zod';
import multer from 'multer';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(400).json({ message: issues[0]?.message || 'Invalid input', issues });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 5 MB)' : `Upload error: ${err.message}`;
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier' });
  if (err.code === 11000) return res.status(409).json({ message: 'A record with this unique value already exists' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body' });

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status === 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  });
}
