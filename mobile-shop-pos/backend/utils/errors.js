// Business-rule failures carry their HTTP status and a message that is safe to show the user.
class AppError extends Error {
  constructor(status, message) { super(message); this.name = 'AppError'; this.status = status; }
}
const badRequest = message => new AppError(400, message);
const MONEY_ERRORS = ['Invalid monetary amount', 'Money must be non-negative'];
function classify(err) {
  if (err instanceof AppError) return { status: err.status, message: err.message };
  if (err?.name === 'MulterError') return { status: 400, message: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (maximum 10 MB).' : 'Upload failed: ' + err.message };
  if (typeof err?.message === 'string' && MONEY_ERRORS.some(m => err.message.startsWith(m)))
    return { status: 400, message: 'Enter a valid amount: 0 or more, at most two decimal places, below 100,000,000.' };
  // Missing or wrongly typed fields reach Prisma as a validation error, not a server fault.
  if (err?.name === 'PrismaClientValidationError') return { status: 400, message: 'Some required information is missing or invalid. Check the form and try again.' };
  switch (err?.code) {
    case 'P2002': {
      const target = [].concat(err.meta?.target || []).join(', ');
      return { status: 409, message: target ? `A record with this ${target} already exists.` : 'This record already exists.' };
    }
    case 'P2025': return { status: 404, message: 'Record not found.' };
    case 'P2003': return { status: 400, message: 'This record is linked to other data and cannot be changed this way.' };
  }
  return null;
}
// Known errors return their own status; everything else is a 500 the server masks and logs.
function sendError(res, err, fallback = 'Unable to complete the request') {
  const known = classify(err);
  res.locals.error = err;
  if (known) return res.status(known.status).json({ error: known.message });
  return res.status(500).json({ error: fallback });
}
module.exports = { AppError, badRequest, classify, sendError };
