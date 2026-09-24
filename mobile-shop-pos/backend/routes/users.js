const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { requireOwner } = require('../middleware/auth');
const permissions = require('../utils/permissions');
const { validUsername, validPassword, STAFF_MIN } = require('../utils/owner');
const { sendError, badRequest, AppError } = require('../utils/errors');

// Only the owner manages logins. Staff accounts are the only ones created, changed or removed here;
// the owner changes their own password through /api/auth/change-password.
router.use(requireOwner);

const view = u => ({
  id: u.id, username: u.username, displayName: u.displayName || u.username, role: u.role,
  permissions: u.role === 'OWNER' ? permissions.KEYS : permissions.parse(u.permissions),
  isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
});
async function staff(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found');
  if (user.role === 'OWNER') throw badRequest('The owner account cannot be changed here.');
  return user;
}
function readPermissions(list) {
  if (!Array.isArray(list)) throw badRequest('Choose the permissions for this user.');
  return JSON.stringify(permissions.sanitize(list));
}

router.get('/permissions', (req, res) => res.json({ groups: permissions.GROUPS, presets: permissions.PRESETS }));

router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
    res.json(users.map(view));
  } catch (err) { sendError(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const username = String(req.body.username ?? '').trim().toLowerCase();
    const displayName = String(req.body.displayName ?? '').trim().slice(0, 60);
    if (!validUsername(username)) throw badRequest('Username must be 3-64 characters: letters, numbers, dot, dash, underscore or @.');
    if (!displayName) throw badRequest('Enter the staff member\'s name.');
    if (!validPassword(req.body.password, STAFF_MIN)) throw badRequest(`Password must be at least ${STAFF_MIN} characters (maximum 72 bytes).`);
    const user = await prisma.user.create({ data: {
      username, displayName, role: 'STAFF',
      passwordHash: await bcrypt.hash(req.body.password, 12),
      permissions: readPermissions(req.body.permissions ?? []),
    } });
    res.status(201).json(view(user));
  } catch (err) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'That username is already taken.' });
    sendError(res, err);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const user = await staff(req.params.id);
    const data = {};
    if (req.body.displayName !== undefined) {
      data.displayName = String(req.body.displayName).trim().slice(0, 60);
      if (!data.displayName) throw badRequest('Enter the staff member\'s name.');
    }
    if (req.body.permissions !== undefined) data.permissions = readPermissions(req.body.permissions);
    if (req.body.isActive !== undefined) {
      data.isActive = !!req.body.isActive;
      if (!data.isActive) data.tokenVersion = { increment: 1 }; // Signs the user out everywhere.
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json(view(updated));
  } catch (err) { sendError(res, err); }
});

router.post('/:id/password', async (req, res) => {
  try {
    const user = await staff(req.params.id);
    if (!validPassword(req.body.password, STAFF_MIN)) throw badRequest(`Password must be at least ${STAFF_MIN} characters (maximum 72 bytes).`);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(req.body.password, 12), tokenVersion: { increment: 1 } } });
    res.json({ message: 'Password changed. The user must sign in again.' });
  } catch (err) { sendError(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = await staff(req.params.id);
    await prisma.user.delete({ where: { id: user.id } });
    res.json({ message: 'User removed' });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
