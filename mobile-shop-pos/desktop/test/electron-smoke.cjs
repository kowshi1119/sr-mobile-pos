// Drives the real desktop UI: owner setup, category + product creation, a cashier login with limited
// permissions, and screenshots of every page in dark and light mode. Uses a temporary profile.
const {app}=require('electron');const fs=require('fs');const path=require('path');const os=require('os');const assert=require('assert/strict');
const secondary=process.argv.includes('--secondary');
const userData=secondary?process.argv[process.argv.indexOf('--secondary')+1]:fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-electron-'));app.setPath('userData',userData);
if(secondary){require(process.env.QA_APP_MAIN||'../main');}else{
const outDir=process.env.SMOKE_OUT||path.resolve(__dirname,'../../../..');fs.mkdirSync(outDir,{recursive:true});
const output=path.join(outDir,'electron-smoke.json');
const shots=path.join(outDir,'screenshots');fs.mkdirSync(shots,{recursive:true});
let finished=false;const watchdog=setTimeout(()=>{fs.writeFileSync(output,JSON.stringify({pass:false,error:'Timeout',userData}));app.exit(1);},240000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Page helpers injected into the renderer (React needs the native value setter plus an input event).
const HELPERS=`window.__qa={
  field(label){const l=[...document.querySelectorAll('label')].find(x=>x.textContent.trim().toLowerCase().startsWith(label.toLowerCase()));if(!l)throw Error('No field '+label);return l.parentElement.querySelector('input,select,textarea');},
  set(el,v){const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));},
  fill(label,v){this.set(this.field(label),v);},
  button(text,last){const all=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim().includes(text)&&!b.disabled);const b=last?all[all.length-1]:all[0];if(!b)throw Error('No button '+text);return b;},
  click(text,last){this.button(text,last).click();},
  text(){return document.body.innerText;},
  nav(){return [...document.querySelectorAll('aside nav a')].map(a=>a.querySelector('span:last-child').textContent.trim());}
};true`;
app.on('browser-window-created',(_,win)=>{
  win.webContents.on('did-finish-load',async()=>{
    if(finished)return;finished=true;
    const result={};
    const js=code=>win.webContents.executeJavaScript(code);
    const go=async route=>{await win.loadURL(new URL(route,win.webContents.getURL()).href);await sleep(700);await js(HELPERS);};
    const waitFor=async(check,label,timeout=8000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await js(check))return;await sleep(150);}throw Error('Timed out waiting for '+label);};
    // capturePage can fail transiently while the compositor is busy; retry a few times.
    const capture=async()=>{for(let i=0;;i++){try{return await win.webContents.capturePage();}catch(e){if(i>=4)throw e;await sleep(400);}}};
    // Force a fresh frame so the capture never shows an earlier page.
    const shot=async name=>{win.webContents.invalidate();await sleep(350);const img=await capture();const file=path.join(shots,name+'.png');fs.writeFileSync(file,img.toPNG());return file;};
    const theme=async t=>{await js(`localStorage.setItem('sr-mobile-pos-theme','${t}');true`);};
    try {
      const prefs=win.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);
      win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('http://127.0.0.1:')&&!details.url.startsWith('data:')&&!details.url.startsWith('blob:')&&!details.url.startsWith('devtools:')}));
      await js(HELPERS);
      await waitFor(`document.body.innerText.includes('Create the owner account')`,'owner setup screen');
      assert.equal(await js('typeof require'),'undefined');assert.equal(await js('typeof window.desktop.backup'),'function');
      result.setupScreenshot=await shot('01-owner-setup-dark');

      // 1. Owner setup through the form, including the mismatch check.
      await js(`__qa.fill('Your name','Shop Owner');__qa.fill('Username','owner');__qa.fill('Password','owner-strong-pass-1');__qa.fill('Confirm password','different-pass-1');__qa.click('Create Owner Account');true`);
      await waitFor(`document.body.innerText.includes('do not match')`,'password mismatch message');
      await js(`__qa.fill('Confirm password','owner-strong-pass-1');__qa.click('Create Owner Account');true`);
      await waitFor(`location.pathname==='/dashboard'`,'dashboard after setup',15000);
      result.ownerSetup='PASS';

      // 2. Products: first-run guidance, validation message, inline category, product save with blank cost.
      await go('/products');
      await waitFor(`document.body.innerText.includes('Create your first category')`,'category guidance');
      await js(`__qa.click('Add Product');true`);await sleep(300);
      await js(`__qa.fill('Product Name','QA Charger');__qa.click('Add Product',true);true`);
      await waitFor(`document.body.innerText.includes('Create a category first')`,'missing category message');
      await js(`__qa.set(document.querySelector('input[placeholder^="Type a category name"]'),'Mobile Accessories');__qa.click('Add category');true`);
      await waitFor(`!!__qa.field('Category').value`,'new category selected');
      await js(`__qa.click('Add Product',true);true`);
      await waitFor(`document.body.innerText.includes('Enter the selling price')`,'selling price message');
      await js(`__qa.fill('Selling Price','1500');__qa.fill('Stock Qty','10');__qa.click('Add Product',true);true`);
      await waitFor(`!document.querySelector('[role=dialog]')&&document.body.innerText.includes('QA Charger')`,'product card',10000);
      result.productCreatedThroughUi='PASS';
      result.productsScreenshot=await shot('02-products-owner-dark');

      // 3. Owner creates a cashier with the Cashier preset.
      await go('/users');
      await js(`__qa.click('Add Staff');true`);await sleep(300);
      await js(`__qa.fill('Name','Kumar');__qa.fill('Username','cashier1');__qa.fill('Password','cashier-pass-1');true`);
      result.usersModalScreenshot=await shot('03-add-staff-dark');
      await js(`__qa.click('Create login');true`);
      await waitFor(`!document.querySelector('[role=dialog]')&&document.body.innerText.includes('cashier1')`,'staff row');
      result.staffCreated='PASS';

      // 4. Every owner page in dark and light mode.
      const routes=['dashboard','analytics','billing','products','bundles','suppliers','expenses','categories','customers','repairs','notifications','data','users'];
      result.pages={};
      for(const mode of ['dark','light']) {
        await theme(mode);
        for(const route of routes) {
          await go('/'+route);
          const ok=await js(`document.getElementById('root').textContent.length>50&&document.documentElement.classList.contains('${mode}')`);
          assert.ok(ok,'Route failed: '+route+' '+mode);
          result.pages[mode+'-'+route]=await shot(`owner-${mode}-${route}`);
        }
      }
      await go('/products');await js(`__qa.click('Add Product');true`);await sleep(400);result.productFormLight=await shot('owner-light-product-form');
      await go('/users');await js(`__qa.click('Add Staff');true`);await sleep(400);result.staffFormLight=await shot('owner-light-add-staff');

      // 5. Cashier signs in and only sees what the owner allowed.
      await js(`localStorage.removeItem('token');true`);await go('/login');
      await waitFor(`document.body.innerText.includes('Sign In')`,'login screen');
      result.loginLight=await shot('login-light');
      await js(`__qa.fill('Username','cashier1');__qa.fill('Password','cashier-pass-1');__qa.click('Sign In');true`);
      await waitFor(`location.pathname==='/billing'`,'cashier lands on billing',10000);
      const nav=await js('__qa.nav()');result.cashierMenu=nav;
      for(const item of ['New Sale','Products','Customers','Repairs']) assert.ok(nav.includes(item),'cashier should see '+item);
      for(const item of ['Dashboard','Analytics','Expenses','Suppliers','Data & Backup','Users & Permissions']) assert.ok(!nav.includes(item),'cashier should not see '+item);
      assert.ok(!(await js(`document.body.innerText.includes('Add discount')`)),'discount hidden');
      result.cashierBilling=await shot('cashier-light-billing');
      await go('/products');
      assert.ok(!(await js(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Add Product'))`)),'Add Product hidden');
      result.cashierProducts=await shot('cashier-light-products');
      await go('/users');assert.equal(await js('location.pathname'),'/billing');
      result.cashierRestrictions='PASS';

      // 6. A second launch focuses the running app instead of opening a conflicting instance.
      const secondaryExit=await new Promise((resolve,reject)=>{const child=require('child_process').spawn(process.execPath,[__filename,'--secondary',userData],{stdio:'ignore',windowsHide:true});const timeout=setTimeout(()=>reject(Error('Second instance did not exit')),10000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);resolve(code);});});
      assert.equal(secondaryExit,0);result.singleInstance='PASS';

      const log=fs.readFileSync(path.join(userData,'logs','desktop.log'),'utf8');
      assert.doesNotMatch(log,/owner-strong-pass-1|cashier-pass-1/);result.logHasNoPasswords='PASS';
      fs.writeFileSync(output,JSON.stringify({pass:true,...result,userData},null,2));clearTimeout(watchdog);app.quit();
    }catch(error){try{result.failureScreenshot=await shot('failure');result.failureText=(await js('document.body.innerText')).slice(0,1500);result.failureUrl=await js('location.pathname');}catch{}fs.writeFileSync(output,JSON.stringify({pass:false,error:error.message,...result,userData},null,2));clearTimeout(watchdog);app.exit(1);}
  });
});
require(process.env.QA_APP_MAIN||'../main');   // QA_APP_MAIN points at a packaged app.asar main.js

}
