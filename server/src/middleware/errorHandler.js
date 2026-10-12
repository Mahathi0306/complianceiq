import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

export function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate record', details: err.keyValue });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
