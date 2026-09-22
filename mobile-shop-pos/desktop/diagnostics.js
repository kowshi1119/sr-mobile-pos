// Explicit --diagnostic-smoke uses a new temporary profile, never client data.
const assert=require('assert/strict');const crypto=require('crypto');
async function run(window) {
  const prefs=window.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);
  const origin=new URL(window.webContents.getURL()).origin;
  window.webContents.session.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(origin+'/')&&!d.url.startsWith('data:')&&!d.url.startsWith('blob:')}));
  const credentials={email:'diagnostic@example.invalid',password:crypto.randomBytes(24).toString('hex')};
  const result=await window.webContents.executeJavaScript(`(async()=>{const credentials=${JSON.stringify(credentials)};const setup=await fetch('/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});const login=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});const {token}=await login.json();const products=await fetch('/api/products',{headers:{authorization:'Bearer '+token}});localStorage.setItem('token',token);return {setup:setup.status,login:login.status,products:products.status,node:typeof require,preload:typeof window.desktop?.backup};})()`);
  assert.equal(result.setup,201);assert.equal(result.products,200);assert.equal(result.node,'undefined');assert.equal(result.preload,'function');
  await window.loadURL(origin+'/dashboard');
  await new Promise(resolve=>setTimeout(resolve,700));assert.ok((await window.webContents.executeJavaScript('document.body.innerText')).includes('Dashboard'));
  return {pass:true,...result,packaged:require('electron').app.isPackaged,externalRequestsBlocked:true};
}
module.exports={run};
