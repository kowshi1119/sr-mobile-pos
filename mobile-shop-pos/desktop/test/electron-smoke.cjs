const {app,BrowserWindow}=require('electron');const fs=require('fs');const path=require('path');const os=require('os');const assert=require('assert/strict');
const secondary=process.argv.includes('--secondary');
const userData=secondary?process.argv[process.argv.indexOf('--secondary')+1]:fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-electron-'));app.setPath('userData',userData);
if(secondary){require('../main');}else{
const output=path.resolve(__dirname,'../../../..','electron-smoke.json');
let finished=false;const watchdog=setTimeout(()=>{fs.writeFileSync(output,JSON.stringify({pass:false,error:'Startup timeout',userData}));app.exit(1);},60000);
app.on('browser-window-created',(_,win)=>{
  win.webContents.on('did-finish-load',async()=>{
    if(finished)return;finished=true;
    try {
      const prefs=win.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);
      win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('http://127.0.0.1:')&&!details.url.startsWith('data:')&&!details.url.startsWith('blob:')}));
      const result=await win.webContents.executeJavaScript(`(async()=>{await new Promise(r=>setTimeout(r,800));const body=document.body.innerText;if(!body.includes('Create your administrator'))throw Error('Setup UI missing');if(typeof require!=='undefined')throw Error('Node leaked');if(!window.desktop)throw Error('Preload missing');const setup=await fetch('/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa@example.invalid',password:'qa-only-strong-password'})});if(setup.status!==201)throw Error('Setup failed');const login=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'qa@example.invalid',password:'qa-only-strong-password'})});const {token}=await login.json();localStorage.setItem('token',token);const data=await fetch('/api/products',{headers:{authorization:'Bearer '+token}});return {setup:setup.status,products:data.status,node:typeof require,bridge:typeof window.desktop.backup,fonts:document.fonts.check('16px "DM Sans Variable"')};})()`);
      assert.equal(result.products,200);assert.equal(result.node,'undefined');
      const secondaryExit=await new Promise((resolve,reject)=>{const child=require('child_process').spawn(process.execPath,[__filename,'--secondary',userData],{stdio:'ignore',windowsHide:true});const timeout=setTimeout(()=>reject(Error('Second instance did not exit')),10000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);resolve(code);});});assert.equal(secondaryExit,0);result.singleInstance=true;
      const screenshot=await win.webContents.capturePage();result.screenshot=path.join(path.dirname(output),'electron-setup-'+Date.now()+'.png');fs.writeFileSync(result.screenshot,screenshot.toPNG());
      await win.loadURL(new URL('/dashboard',win.webContents.getURL()).href);
      await new Promise(r=>setTimeout(r,800));assert.ok((await win.webContents.executeJavaScript('document.body.innerText')).includes('Dashboard'));
      for(const route of ['products','categories','billing','customers','repairs','notifications','analytics','suppliers','expenses','bundles','data']) {await win.loadURL(new URL('/'+route,win.webContents.getURL()).href);await new Promise(r=>setTimeout(r,300));assert.ok((await win.webContents.executeJavaScript("document.getElementById('root').textContent.length"))>50,'Route failed: '+route);}result.routes=12;
      fs.writeFileSync(output,JSON.stringify({pass:true,...result,userData},null,2));clearTimeout(watchdog);app.quit();
    }catch(error){fs.writeFileSync(output,JSON.stringify({pass:false,error:error.message,userData}));clearTimeout(watchdog);app.exit(1);}
  });
});
require('../main');

}
