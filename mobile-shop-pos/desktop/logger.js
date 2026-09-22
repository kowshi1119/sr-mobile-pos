const fs = require('fs'); const path = require('path');
module.exports = function logger(dir) {
  const file = path.join(dir,'desktop.log');
  return (event,error) => {
    if (fs.existsSync(file) && fs.statSync(file).size > 1024*1024) {
      for(let i=4;i>=1;i--) { const old=file+'.'+i; if(fs.existsSync(old)) { if(i===4) fs.unlinkSync(old); else fs.renameSync(old,file+'.'+(i+1)); } }
      fs.renameSync(file,file+'.1');
    }
    // Log event identifiers and error classes/codes only, never request bodies or ORM messages.
    fs.appendFileSync(file,JSON.stringify({time:new Date().toISOString(),event,error:error ? {name:error.name,code:error.code} : undefined})+'\n');
  };
};
