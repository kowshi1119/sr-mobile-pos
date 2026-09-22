const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const migrationsDir = path.join(__dirname, '../backend/prisma/desktop/migrations');
function pathsFor(userData) {
  const p = { root: userData };
  for (const name of ['data', 'backups', 'exports', 'logs', 'settings', 'uploads']) {
    p[name] = path.join(userData, name); fs.mkdirSync(p[name], { recursive: true });
  }
  p.db = path.join(p.data, 'pos.db'); return p;
}
function migrations() {
  return fs.readdirSync(migrationsDir).filter(n => n.endsWith('.sql')).sort().map(name => {
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
    return { name, sql, hash: crypto.createHash('sha256').update(sql).digest('hex') };
  });
}
function open(file, readOnly = false) {
  const db = new DatabaseSync(file, { readOnly, enableExtensions: false });
  db.exec('PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;');
  return db;
}
function snapshot(source, destination) {
  if (fs.existsSync(destination)) throw new Error('Backup destination already exists');
  const db = open(source);
  try { db.prepare('VACUUM INTO ?').run(destination); } finally { db.close(); }
  validate(destination);
  return destination;
}
function validate(file) {
  if (path.extname(file).toLowerCase() !== '.db') throw new Error('Select a .db backup');
  if (!fs.statSync(file).isFile()) throw new Error('Not a database file');
  const db = open(file, true);
  try {
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Damaged database');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Broken database relationships');
    const applied = db.prepare('SELECT name, hash FROM _DesktopMigration ORDER BY name').all();
    const known = migrations();
    if (!applied.length || applied.some((m,i) => !known[i] || known[i].name !== m.name || known[i].hash !== m.hash)) throw new Error('Unknown or newer database version');
    // Validate the complete schema against a pristine database at the same migration version.
    const expected = new DatabaseSync(':memory:');
    try {
      for (const m of known.slice(0, applied.length)) expected.exec(m.sql);
      const objects = d => d.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != '_DesktopMigration' ORDER BY type,name").all();
      if (JSON.stringify(objects(db)) !== JSON.stringify(objects(expected))) throw new Error('Not an unmodified SR Mobile POS database');
    } finally { expected.close(); }
  } finally { db.close(); }
  return true;
}
function migrate(p) {
  const marker=path.join(p.data,'restore-pending.json');
  if(fs.existsSync(marker)) {
    const {old}=JSON.parse(fs.readFileSync(marker,'utf8'));
    if(!/^previous-[a-f0-9-]+\.db$/.test(old))throw new Error('Invalid restore recovery marker');
    const oldFile=path.join(p.data,old);
    if(!fs.existsSync(p.db)&&fs.existsSync(oldFile))fs.renameSync(oldFile,p.db);
    if(fs.existsSync(p.db))validate(p.db);else throw new Error('Restore needs support recovery');
    fs.unlinkSync(marker); // An old file left after interruption is retained for manual recovery.
  }
  const existed = fs.existsSync(p.db);
  if (existed) {
    validate(p.db);
    const name = 'pre-migration-' + Date.now() + '-' + crypto.randomUUID() + '.db';
    snapshot(p.db, path.join(p.backups, name));
  }
  const target=existed?p.db:p.db+'.initializing';
  if(!existed&&fs.existsSync(target))fs.unlinkSync(target);
  const db = open(target);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS _DesktopMigration (name TEXT PRIMARY KEY, hash TEXT NOT NULL, appliedAt TEXT NOT NULL)');
    const applied = db.prepare('SELECT name, hash FROM _DesktopMigration ORDER BY name').all();
    const known = migrations();
    if (applied.some((m,i) => !known[i] || m.name !== known[i].name || m.hash !== known[i].hash)) throw new Error('Migration history mismatch');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const m of known.slice(applied.length)) {
        db.exec(m.sql);
        db.prepare('INSERT INTO _DesktopMigration VALUES (?, ?, ?)').run(m.name,m.hash,new Date().toISOString());
      }
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Migration relationship check failed');
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  } finally { db.close(); }
  if(!existed)fs.renameSync(target,p.db);
}
module.exports = { pathsFor, migrate, snapshot, validate, open, migrations };
