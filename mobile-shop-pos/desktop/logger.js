const fs = require('fs'); const path = require('path');
const SECRET = /(bearer\s+)[\w.-]+|("?(password|token|secret|hash|authorization)"?\s*[:=]\s*)("[^"]*"|\S+)/gi;
module.exports = function logger(dir) {
  const file = path.join(dir,'desktop.log');
  return (event,detail) => {
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 1024*1024) {
        for(let i=4;i>=1;i--) { const old=file+'.'+i; if(fs.existsSync(old)) { if(i===4) fs.unlinkSync(old); else fs.renameSync(old,file+'.'+(i+1)); } }
        fs.renameSync(file,file+'.1');
      }
      // Log event identifiers, routes and error messages only, never request bodies, tokens or passwords.
      const clean = v => typeof v === 'string' ? v.replace(SECRET, '$1$2[redacted]').slice(0, 300) : v;
      let info;
      if (detail instanceof Error) info = { name: detail.name, code: detail.code, message: clean(detail.message) };
      else if (detail && typeof detail === 'object') info = Object.fromEntries(Object.entries(detail).filter(([,v]) => v !== undefined).map(([k,v]) => [k, clean(v)]));
      fs.appendFileSync(file,JSON.stringify({time:new Date().toISOString(),event,detail:info})+'\n');
    } catch { /* Logging must never break the POS. */ }
  };
};
