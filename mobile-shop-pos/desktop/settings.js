const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Antivirus scanners can briefly lock the settings file on Windows; retry the atomic replace.
function replace(temp, file) {
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(temp, file); return; }
    catch (err) {
      if (attempt >= 20 || !['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}
function loadSettings(p) {
  const file = path.join(p.settings, 'security.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ jwtSecret:crypto.randomBytes(64).toString('hex') }), { flag:'wx', mode:0o600 });
  const settings = JSON.parse(fs.readFileSync(file,'utf8'));
  if (typeof settings.jwtSecret !== 'string' || settings.jwtSecret.length < 64) throw new Error('Invalid security settings');
  return { value:settings, save(next) {
    const temp = file + '.tmp'; fs.writeFileSync(temp, JSON.stringify(next), { mode:0o600 });
    replace(temp, file);
    for (const key of Object.keys(settings)) if (!(key in next)) delete settings[key];
    Object.assign(settings,next);
  } };
}
// A fixed local port keeps the app's origin, and therefore the saved login and theme, across launches.
function preferredPort(config) {
  if (Number.isInteger(config.value.port)) return config.value.port;
  const port = 41000 + crypto.randomInt(8000);
  config.save({ ...config.value, port });
  return port;
}
module.exports = { loadSettings, preferredPort };
