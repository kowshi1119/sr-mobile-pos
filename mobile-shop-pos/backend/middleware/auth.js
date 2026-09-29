const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const permissions = require('../utils/permissions');

// The web deployment keeps its environment-configured administrator as a virtual owner.
const ENV_OWNER = 'env-owner';

function toSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    permissions: user.role === 'OWNER' ? permissions.KEYS : permissions.parse(user.permissions),
  };
}

// Verifies the token and reloads the user on every request, so disabling a user or
// changing their permissions takes effect immediately.
async function authMiddleware(req, res, next) {
  if (req.user) return next();
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    if (decoded.sub === ENV_OWNER && process.env.DESKTOP_MODE !== '1') {
      req.user = { id: ENV_OWNER, username: decoded.username, displayName: 'Owner', role: 'OWNER', permissions: permissions.KEYS };
    } else {
      const user = typeof decoded.sub === 'string' ? await prisma.user.findUnique({ where: { id: decoded.sub } }) : null;
      if (!user || !user.isActive || user.tokenVersion !== decoded.tv) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
      req.user = toSessionUser(user);
    }
    req.admin = { ...req.user, email: req.user.username };
    next();
  } catch (err) { next(err); }
}

// Any one of the listed permissions is enough; the owner always passes.
function requirePermission(...keys) {
  return [authMiddleware, (req, res, next) => permissions.has(req.user, ...keys)
    ? next()
    : res.status(403).json({ error: "You don't have permission for this action." })];
}
const requireOwner = [authMiddleware, (req, res, next) => req.user.role === 'OWNER'
  ? next()
  : res.status(403).json({ error: 'Only the owner can do this.' })];

module.exports = authMiddleware;
module.exports.requirePermission = requirePermission;
module.exports.requireOwner = requireOwner;
module.exports.toSessionUser = toSessionUser;
module.exports.ENV_OWNER = ENV_OWNER;
