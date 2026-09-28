// Regression guard for 1.1.1: native alert()/confirm()/prompt() leave Electron-on-Windows fields unable to
// receive typed characters after the dialog closes (electron/electron#31917), and prompt() is unsupported.
// All messages must go through the in-app dialogs in frontend/src/dialogs.jsx.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const src=path.join(__dirname,'../../frontend/src');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(jsx?|tsx?)$/.test(e.name)?[path.join(dir,e.name)]:[]);}
test('frontend never calls native alert, confirm or prompt',()=>{
  const offenders=[];
  for(const file of files(src)){
    const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
    lines.forEach((line,i)=>{
      const code=line.replace(/\/\/.*$/,'');
      if(/(^|[^\w.])(window\.)?(alert|confirm|prompt)\s*\(/.test(code))offenders.push(`${path.relative(src,file)}:${i+1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders,[],'Use showAlert/askConfirm/askText from dialogs.jsx instead:\n'+offenders.join('\n'));
});
test('no floating fixed-position launcher buttons in the app layout',()=>{
  // Floating corner buttons covered the New Sale customer fields; Scan and AI now live in the header.
  const layout=fs.readFileSync(path.join(src,'components/Layout.jsx'),'utf8');const ai=fs.readFileSync(path.join(src,'components/AiWidget.jsx'),'utf8');
  assert.doesNotMatch(layout,/className=\{?[`"'][^`"']*\bfixed\b[^`"']*\bbottom-\d/,'Layout must not add bottom-fixed floating buttons');
  assert.doesNotMatch(ai,/position:\s*'fixed',\s*bottom/,'AI widget must not float a launcher at the bottom of the window');
});
