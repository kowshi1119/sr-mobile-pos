const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { snapshot, validate, open } = require('./database-manager');
function backup(p, label = 'auto') {
  const file = path.join(p.backups, label + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID() + '.db');
  snapshot(p.db, file);
  const files = fs.readdirSync(p.backups).filter(n => /^(auto|manual|pre-migration)-.*\.db$/.test(n)).map(n => ({ name:n, time:fs.statSync(path.join(p.backups,n)).mtimeMs })).sort((a,b)=>b.time-a.time);
  for (const f of files.slice(30)) fs.unlinkSync(path.join(p.backups, f.name));
  return file;
}
function stageRestore(p, source) {
  validate(source);
  const stage = path.join(p.data, 'restore-' + crypto.randomUUID() + '.db');
  snapshot(source, stage); // Includes any committed WAL content; never copy a live .db blindly.
  return stage;
}
function replaceDatabase(p, stage) {
  validate(stage);
  backup(p, 'safety'); // Safety snapshots are never automatically pruned.
  const old = path.join(p.data, 'previous-' + crypto.randomUUID() + '.db');
  // Caller has drained Express and disconnected Prisma before this operation.
  const db=open(p.db);try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}finally{db.close();}
  const marker=path.join(p.data,'restore-pending.json');
  fs.writeFileSync(marker,JSON.stringify({old:path.basename(old)}),{flag:'wx'});
  fs.renameSync(p.db, old);
  try { fs.renameSync(stage, p.db); }
  catch (err) { fs.renameSync(old, p.db); throw err; }
  fs.unlinkSync(old);fs.unlinkSync(marker);
}
module.exports = { backup, stageRestore, replaceDatabase };
