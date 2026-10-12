import { HttpError } from '../utils/httpError.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) {
    throw new HttpError(400, 'Validation failed', parsed.error.flatten());
  }
  req[source] = parsed.data;
  next();
};
