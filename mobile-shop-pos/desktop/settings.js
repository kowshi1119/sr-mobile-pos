const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function loadSettings(p) {
  const file = path.join(p.settings, 'security.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ jwtSecret:crypto.randomBytes(64).toString('hex') }), { flag:'wx', mode:0o600 });
  const settings = JSON.parse(fs.readFileSync(file,'utf8'));
  if (typeof settings.jwtSecret !== 'string' || settings.jwtSecret.length < 64) throw new Error('Invalid security settings');
  return { value:settings, save(next) {
    const temp = file + '.tmp'; fs.writeFileSync(temp, JSON.stringify(next), { mode:0o600 });
    fs.renameSync(temp,file); Object.assign(settings,next);
  } };
}
module.exports = { loadSettings };
