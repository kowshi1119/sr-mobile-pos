// Explicit --diagnostic-smoke uses a new temporary profile, never client data.
const assert=require('assert/strict');const crypto=require('crypto');
async function run(window) {
  const prefs=window.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);
  const origin=new URL(window.webContents.getURL()).origin;
  window.webContents.session.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith(origin+'/')&&!d.url.startsWith('data:')&&!d.url.startsWith('blob:')}));
  const credentials={username:'diagnostic-owner',displayName:'Diagnostic',password:crypto.randomBytes(24).toString('hex')};
  // Owner setup, login, then real writes: a category, a product with a blank cost price, a sale and a staff user.
  const result=await window.webContents.executeJavaScript(`(async()=>{
    const credentials=${JSON.stringify(credentials)};const json={'Content-Type':'application/json'};
    const setup=await fetch('/api/auth/setup',{method:'POST',headers:json,body:JSON.stringify(credentials)});
    const login=await fetch('/api/auth/login',{method:'POST',headers:json,body:JSON.stringify(credentials)});
    const {token}=await login.json();const auth={...json,authorization:'Bearer '+token};
    const category=await fetch('/api/categories',{method:'POST',headers:auth,body:JSON.stringify({name:'Diagnostic'})});const cat=await category.json();
    const product=await fetch('/api/products',{method:'POST',headers:auth,body:JSON.stringify({categoryId:cat.id,name:'Diagnostic item',sellingPrice:'100',costPrice:'',stockQuantity:'5'})});const prod=await product.json();
    const sale=await fetch('/api/sales',{method:'POST',headers:auth,body:JSON.stringify({customer:{name:'',phone:''},items:[{productId:prod.id,unitPrice:100,quantity:1}],paymentMethod:'CASH'})});
    const staff=await fetch('/api/users',{method:'POST',headers:auth,body:JSON.stringify({username:'diagnostic-staff',displayName:'Staff',password:'diagnostic-pass',permissions:['sales.create']})});
    const staffLogin=await fetch('/api/auth/login',{method:'POST',headers:json,body:JSON.stringify({username:'diagnostic-staff',password:'diagnostic-pass'})});
    const staffToken=(await staffLogin.json()).token;
    const denied=await fetch('/api/products',{method:'POST',headers:{...json,authorization:'Bearer '+staffToken},body:JSON.stringify({categoryId:cat.id,name:'x',sellingPrice:'1'})});
    const stock=(await (await fetch('/api/products/'+prod.id,{headers:auth})).json()).stockQuantity;
    localStorage.setItem('token',token);
    return {setup:setup.status,login:login.status,category:category.status,product:product.status,sale:sale.status,stockAfterSale:stock,staff:staff.status,staffLogin:staffLogin.status,staffProductCreate:denied.status,node:typeof require,preload:typeof window.desktop?.backup};
  })()`);
  assert.equal(result.setup,201);assert.equal(result.login,200);assert.equal(result.category,201);assert.equal(result.product,201);assert.equal(result.sale,201);assert.equal(result.stockAfterSale,4);
  assert.equal(result.staff,201);assert.equal(result.staffLogin,200);assert.equal(result.staffProductCreate,403);
  assert.equal(result.node,'undefined');assert.equal(result.preload,'function');
  await window.loadURL(origin+'/dashboard');
  await new Promise(resolve=>setTimeout(resolve,700));assert.ok((await window.webContents.executeJavaScript('document.body.innerText')).includes('Dashboard'));
  return {pass:true,...result,packaged:require('electron').app.isPackaged,externalRequestsBlocked:true};
}
module.exports={run};
