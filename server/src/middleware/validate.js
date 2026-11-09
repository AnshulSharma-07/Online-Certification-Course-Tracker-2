// validate(schema) parses req.body (or another source) and replaces it with the typed result.
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  // req.query is a getter in Express 5; assign defensively.
  if (source === 'query') Object.defineProperty(req, 'query', { value: result.data, configurable: true });
  else req[source] = result.data;
  next();
};
