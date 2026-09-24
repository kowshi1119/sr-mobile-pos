const OWNER_MIN = 12;
const STAFF_MIN = 8;
const validUsername = u => typeof u === 'string' && /^[a-z0-9._@-]{3,64}$/.test(u);
const validPassword = (p, min = STAFF_MIN) => typeof p === 'string' && p.length >= min && Buffer.byteLength(p) <= 72;

// Makes sure the desktop database has exactly one active owner. The owner's login is mirrored in
// settings/security.json so restoring a backup (which replaces the User table) never locks them out,
// and v1.0 installations (single admin stored only in settings) are upgraded to an OWNER user.
async function ensureOwner(prisma, config) {
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
  const mirror = config.value.owner || (config.value.admin && {
    username: String(config.value.admin.email).trim().toLowerCase(), displayName: 'Owner', hash: config.value.admin.hash,
  });
  if (owner?.isActive) {
    if (!config.value.owner || config.value.owner.hash !== owner.passwordHash || config.value.owner.username !== owner.username || config.value.admin) {
      const { admin, ...rest } = config.value;
      config.save({ ...rest, owner: { username: owner.username, displayName: owner.displayName, hash: owner.passwordHash } });
    }
    return 'present';
  }
  if (!mirror?.hash || !validUsername(mirror.username)) return 'setup-required';
  const data = { passwordHash: mirror.hash, displayName: mirror.displayName || 'Owner', role: 'OWNER', permissions: '[]', isActive: true };
  if (owner) await prisma.user.update({ where: { id: owner.id }, data: { ...data, tokenVersion: { increment: 1 } } });
  else {
    const clash = await prisma.user.findUnique({ where: { username: mirror.username } });
    if (clash) await prisma.user.update({ where: { id: clash.id }, data: { ...data, tokenVersion: { increment: 1 } } });
    else await prisma.user.create({ data: { ...data, username: mirror.username } });
  }
  const { admin, ...rest } = config.value;
  config.save({ ...rest, owner: { username: mirror.username, displayName: data.displayName, hash: mirror.hash } });
  return 'restored';
}
module.exports = { OWNER_MIN, STAFF_MIN, validUsername, validPassword, ensureOwner };
