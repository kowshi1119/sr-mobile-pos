// Regression suite for "input fields cannot be typed into" (1.1.1). Drives the real desktop app with
// real input events (Chromium-level by default; QA_INPUT=os for Windows SendInput on an unlocked desktop).
// Exit code 1 if any check fails. Results: <QA_OUT>/typing-qa.json
const {app,clipboard}=require('electron');const fs=require('fs');const path=require('path');const os=require('os');
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-typing-qa-'));app.setPath('userData',userData);
const outDir=process.env.QA_OUT||userData;fs.mkdirSync(outDir,{recursive:true});
const {Driver,VK,sleep}=require('./qa-driver.cjs');
const OWNER={username:'qa-owner',displayName:'QA Owner',password:'qa-owner-password-1'};
let started=false;
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
  if(started)return;started=true;
  const d=new Driver(win);const checks=[];
  const save=()=>fs.writeFileSync(path.join(outDir,'typing-qa.json'),JSON.stringify({inputMode:d.mode,screen:require('electron').screen.getPrimaryDisplay().size,userData,checks},null,2));
  // BLOCKED = the environment cannot run the check (reported honestly, not counted as pass or fail).
  const blocked=msg=>Object.assign(Error(msg),{blocked:true});
  const check=async(name,fn)=>{try{const detail=await fn();checks.push({name,status:'PASS',detail});console.log('PASS',name);}catch(e){if(e.blocked){checks.push({name,status:'BLOCKED',reason:e.message});console.log('BLOCKED',name,e.message);save();return;}checks.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);try{win.webContents.invalidate();await sleep(250);fs.writeFileSync(path.join(outDir,'fail-'+checks.length+'.png'),(await win.webContents.capturePage()).toPNG());}catch{}}save();};
  const expect=(cond,msg)=>{if(!cond)throw Error(msg);};
  const typeCheck=async(field,text)=>{const r=await d.clickAndType(field,text);expect(r.clickLandedOnField,`click on ${r.field} hit "${r.elementOnTop}" instead`);if(!r.ok)r.active=await d.active();expect(r.ok,`${r.field}: typed ${JSON.stringify(text)} but field has ${JSON.stringify(r.value)} (focus: ${r.active}, page: ${await d.js('location.pathname')})`);return r;};
  const dialogOpen=()=>d.js(`document.querySelector('[data-app-dialog]')?.getAttribute('data-app-dialog')||null`);
  // Any native alert/confirm/prompt during the run is a failure: record calls instead of opening them.
  const trapNative=()=>d.js(`window.__native=window.__native||[];for(const n of ['alert','confirm','prompt'])window[n]=(...a)=>{window.__native.push(n+': '+a[0]);return n==='confirm'?false:null};true`);
  // Native calls are collected before every navigation, so a page reload cannot hide them.
  const nativeSeen=[];const collectNative=async()=>{try{nativeSeen.push(...await d.js('window.__native||[]'));await d.js('window.__native=[];true');}catch{}};
  const nativeCalls=async()=>{await collectNative();return nativeSeen;};
  const goto=async r=>{await collectNative();await d.go(r);await trapNative();};
  try {
    await d.start();
    const barcode='4791234567890';   // numeric EAN-13 style, as most shop barcodes are
    await d.js(`(async()=>{const j={'Content-Type':'application/json'};const c=${JSON.stringify(OWNER)};
      await fetch('/api/auth/setup',{method:'POST',headers:j,body:JSON.stringify(c)});const t=(await (await fetch('/api/auth/login',{method:'POST',headers:j,body:JSON.stringify(c)})).json()).token;
      const a={...j,authorization:'Bearer '+t};const cat=await (await fetch('/api/categories',{method:'POST',headers:a,body:JSON.stringify({name:'Accessories'})})).json();
      await fetch('/api/products',{method:'POST',headers:a,body:JSON.stringify({categoryId:cat.id,name:'QA Charger',sellingPrice:'1500',stockQuantity:'50',barcode:'${barcode}'})});
      await fetch('/api/sales',{method:'POST',headers:a,body:JSON.stringify({customer:{name:'QA Customer',phone:'0770000001'},items:[{productId:(await (await fetch('/api/products',{headers:a})).json())[0].id,unitPrice:1500,quantity:1}],paymentMethod:'CASH'})});
      localStorage.setItem('token',t);return true})()`);

    for(const [w,h] of [[1366,768],[1280,720]]) {
      await d.resize(w,h);
      // 1. No page element is covered by floating UI: every visible enabled field must receive its own click.
      await check(`no field is covered by another element (${w}x${h})`,async()=>{
        const covered=[];
        for(const route of ['/dashboard','/billing','/products','/customers','/repairs','/suppliers','/expenses','/categories','/data','/users']) {
          await goto(route);
          const found=await d.js(`(()=>{let i=0;const out=[];document.querySelectorAll('input,select,textarea').forEach(e=>{if(e.disabled||e.type==='hidden'||e.type==='file'||!e.getClientRects().length)return;e.setAttribute('data-qa-field',++i);out.push(i)});return out})()`);
          for(const id of found){const sel={css:`[data-qa-field="${id}"]`};const shown=await d.reveal(sel);if(shown!=='visible')continue;const p=await d.locate(sel);if(!p.hit)covered.push(`${route} field #${id} covered by "${p.onTop}"`);}
        }
        expect(!covered.length,covered.join('; '));return 'all fields reachable';
      });
      // 2. The customer's report: New Sale customer fields with an empty cart, 1 item and 3 items.
      for(const items of [0,1,3]) await check(`New Sale customer name / phone / WhatsApp accept typing, ${items} item(s), ${w}x${h}`,async()=>{
        await goto('/billing');await d.waitFor(`document.body.innerText.includes('QA Charger')`,'products');
        await d.js(`document.querySelectorAll('p').forEach(p=>{if(p.textContent.trim()==='QA Charger')p.setAttribute('data-qa','card')})`);
        for(let i=0;i<items;i++){await d.click({css:'[data-qa=card]'});await sleep(200);}
        const r=[await typeCheck({placeholder:'Customer name'},'Kumar Silva'),await typeCheck({placeholder:'Phone number'},'0771234567'),await typeCheck({placeholder:'WhatsApp number'},'0779876543')];
        expect(!(await d.js("!!document.querySelector('video')")),'camera scanner opened');return r.map(x=>x.value);
      });
    }
    await d.resize(1366,768);

    // 3. Keyboard behaviour inside a field.
    await check('keys: letters, digits, space, Backspace, Delete, arrows, Home/End, Ctrl+A',async()=>{
      await goto('/products');await d.click({button:'Add Product'});await sleep(300);
      const name={label:'Product Name'};await d.click(name);
      await d.type('ac');await d.key(VK.LEFT);await d.type('b');expect(await d.value(name)==='abc','arrow insert: '+await d.value(name));
      await d.key(VK.HOME);await d.key(VK.DELETE);expect(await d.value(name)==='bc','Home+Delete: '+await d.value(name));
      await d.key(VK.END);await d.key(VK.BACK);expect(await d.value(name)==='b','End+Backspace: '+await d.value(name));
      await d.type(' 12 Pro');expect(await d.value(name)==='b 12 Pro','space/digits: '+await d.value(name));
      await d.key(VK.A,'ctrl');await d.type('USB-C Cable 2m');expect(await d.value(name)==='USB-C Cable 2m','Ctrl+A replace: '+await d.value(name));
      return await d.value(name);
    });
    await check('keys: Ctrl+C / Ctrl+V between fields',async()=>{
      await clipboard.writeText('qa-clipboard-probe');if((await clipboard.readText())!=='qa-clipboard-probe')throw blocked('the Windows clipboard cannot be read or written in this session (e.g. workstation locked)');
      await clipboard.writeText('');await d.click({label:'Product Name'});await d.key(VK.A,'ctrl');await d.key(VK.C,'ctrl');await sleep(200);
      const copied=await clipboard.readText();expect(copied==='USB-C Cable 2m','clipboard has '+JSON.stringify(copied));
      await d.click({label:'Custom Barcode'});await d.key(VK.V,'ctrl');await sleep(200);
      expect(await d.value({label:'Custom Barcode'})==='USB-C Cable 2m','pasted '+JSON.stringify(await d.value({label:'Custom Barcode'})));
      await d.key(VK.A,'ctrl');await d.key(VK.BACK);return 'copy/paste ok';
    });
    await check('keys: Tab and Shift+Tab move between fields',async()=>{
      await d.click({label:'Selling Price'});await d.key(VK.TAB);const after=await d.active();
      await d.key(VK.TAB,'shift');const back=await d.active();
      expect(after!==back,'Tab did not move focus');await d.type('9');expect(await d.value({label:'Selling Price'})==='9','Shift+Tab did not return to Selling Price');
      await d.key(VK.BACK);return {afterTab:after,afterShiftTab:back};
    });
    await check('decimal entry and dropdown selection by keyboard, then save with the button',async()=>{
      await typeCheck({label:'Selling Price'},'1499.50');await typeCheck({label:'Stock Qty'},'7');
      const sel={label:'Category'};await d.click(sel);await d.key(VK.ESC);await sleep(150);
      await d.js(`document.activeElement.blur()`);await d.click({label:'Product Name'});await d.key(VK.TAB,'shift');   // focus the category select by keyboard
      for(let i=0;i<3&&!(await d.value(sel));i++){await d.key(VK.DOWN);await sleep(150);}
      expect(!!(await d.value(sel)),'category not selected with arrow keys');
      await d.click({button:'Add Product',last:true});await d.waitFor(`!document.body.innerText.includes('Custom Barcode')&&document.body.innerText.includes('USB-C Cable 2m')`,'saved product');
      return 'saved';
    });
    await check('close and reopen a form, then type again',async()=>{
      await d.click({button:'Add Product'});await sleep(300);await typeCheck({label:'Product Name'},'Temp');await d.click({button:'Cancel'});await sleep(300);
      await d.click({button:'Add Product'});await sleep(300);const v=await d.value({label:'Product Name'});await typeCheck({label:'Product Name'},'Again');await d.click({button:'Cancel'});return {valueAfterReopen:v};
    });
    await check('type again after a validation message',async()=>{
      await d.click({button:'Add Product'});await sleep(300);await typeCheck({label:'Product Name'},'No price');
      await d.click({button:'Add Product',last:true});await d.waitFor(`document.body.innerText.includes('Enter the selling price')`,'validation message');
      await typeCheck({label:'Selling Price'},'250');await typeCheck({label:'Product Name'},'Price added');await d.click({button:'Cancel'});return 'ok';
    });

    // 4. Messages and confirmations are in-app dialogs; typing works right after them.
    await check('after an in-app message (Enter to close) typing still works',async()=>{
      await goto('/expenses');await d.click({button:'Add Expense'});await sleep(300);
      await d.click({button:'Save Expense'});await d.waitFor(`!!document.querySelector('[data-app-dialog="alert"]')`,'in-app message');
      await d.key(VK.ENTER);await d.waitFor(`!document.querySelector('[data-app-dialog]')`,'message closed');
      await typeCheck({label:'Description'},'Shop rent September');await typeCheck({label:'Amount (LKR)'},'45000.75');
      await d.click({button:'Cancel'});return 'ok';
    });
    await check('after an in-app confirmation (Esc = cancel, Enter = confirm) typing still works',async()=>{
      // Only ever deactivate the throwaway "USB-C Cable 2m"; later checks need QA Charger.
      const markCable=()=>d.js(`(()=>{const p=[...document.querySelectorAll('p')].find(p=>p.textContent.trim()==='USB-C Cable 2m');const b=p&&p.closest('.card').querySelector('button[title="Deactivate"]');if(b)b.setAttribute('data-qa','deactivate-cable');return !!b})()`);
      await goto('/products');await markCable();await d.click({css:'[data-qa=deactivate-cable]'});await d.waitFor(`!!document.querySelector('[data-app-dialog="confirm"]')`,'confirm dialog');
      await d.key(VK.ESC);await d.waitFor(`!document.querySelector('[data-app-dialog]')`,'cancelled');
      await typeCheck({placeholder:'Search name'},'USB');await d.key(VK.A,'ctrl');await d.key(VK.BACK);await sleep(400);
      const before=await d.js(`document.querySelectorAll('button[title="Deactivate"]').length`);
      await markCable();await d.click({css:'[data-qa=deactivate-cable]'});await d.waitFor(`!!document.querySelector('[data-app-dialog="confirm"]')`,'confirm dialog');
      await d.key(VK.ENTER);await d.waitFor(`document.querySelectorAll('button[title="Deactivate"]').length===${before-1}`,'product deactivated');
      await typeCheck({placeholder:'Search name'},'QA');return 'ok';
    });
    await check('Reset data asks for a typed RESET in the app (no browser prompt)',async()=>{
      await goto('/data');await d.click({button:'Reset All Data'});await d.waitFor(`!!document.querySelector('[data-app-dialog="text"]')`,'reset dialog');
      await d.type('RESE');expect(await d.js(`document.querySelector('[data-app-dialog] button.btn-primary').disabled`),'Reset enabled before RESET typed');
      await d.key(VK.ESC);await d.waitFor(`document.body.innerText.includes('Reset cancelled')`,'cancel message');return 'cancelled safely';
    });

    // 5. Other forms.
    await check('customer debt payment amount (auto-focused field) accepts typing',async()=>{
      await goto('/customers');await d.js(`[...document.querySelectorAll('p')].find(p=>p.textContent.includes('QA Customer'))?.click()`);await sleep(900);await d.inject();await trapNative();
      await d.click({button:'Add Credit'});await sleep(300);await d.type('250.75');const v=await d.value({css:'input[placeholder="0.00"]'});expect(v==='250.75','autofocused amount has '+JSON.stringify(v));
      await typeCheck({placeholder:'Reason for credit'},'Screen guard on credit');await d.click({button:'Cancel'});return v;
    });
    await check('repair, supplier, category, expense and staff forms accept typing',async()=>{
      await goto('/repairs');await d.click({button:'New Repair'});await sleep(300);await typeCheck({label:'Name *'},'Repair Customer');await typeCheck({label:'Phone *'},'0712345678');await typeCheck({label:'Device Name *'},'Galaxy A15');await typeCheck({label:'Estimated Cost'},'3500.50');await d.click({button:'Cancel'});
      await goto('/suppliers');await d.click({button:'Add Supplier'});await sleep(300);await typeCheck({label:'Name *'},'Lanka Mobile Parts');await typeCheck({label:'Email'},'parts@example.invalid');await d.click({button:'Cancel'});
      await goto('/categories');await d.click({button:'Add Category'});await sleep(300);await typeCheck({label:'Category Name'},'Screen Guards');await typeCheck({label:'Default Warranty'},'6');await d.click({button:'Cancel'});
      await goto('/users');await d.click({button:'Add Staff'});await sleep(300);await typeCheck({label:'Name'},'Nimal');await typeCheck({label:'Username'},'cashier2');await typeCheck({label:'Password'},'cashier-pass-9');await d.click({button:'Cancel'});
      return 'ok';
    });
    await check('New Sale discount accepts 0 and decimals without jumping',async()=>{
      await goto('/billing');await d.waitFor(`document.body.innerText.includes('QA Charger')`,'products');await d.js(`document.querySelectorAll('p').forEach(p=>{if(p.textContent.trim()==='QA Charger')p.setAttribute('data-qa','card')})`);await d.click({css:'[data-qa=card]'});
      await d.click({button:'Add discount'});await sleep(200);const f={placeholder:'e.g. 10'};await d.click(f);await d.type('0');expect(await d.value(f)==='0','"0" became '+JSON.stringify(await d.value(f)));
      await d.type('.5');expect(await d.value(f)==='0.5','"0.5" became '+JSON.stringify(await d.value(f)));return await d.value(f);
    });
    await check('barcode scanner burst adds the product and typing into fields still works',async()=>{
      await goto('/billing');await d.waitFor(`document.body.innerText.includes('QA Charger')`,'products');await d.js(`document.activeElement.blur()`);
      const before=await d.js(`document.body.innerText.match(/Cart\\s*(\\d+)/)?.[1]||'0'`);
      await d.click({css:'h1'});   // focus outside any field, as a cashier would before scanning
      for(const ch of barcode){await d.os.cmd('text '+Buffer.from(ch).toString('base64'));}await d.key(VK.ENTER);
      await d.waitFor(`document.body.innerText.includes('QA Charger')&&/Cart\\s*1/.test(document.body.innerText)`,'scanned item in cart');
      await typeCheck({placeholder:'Customer name'},'After scan');
      const cart=await d.js(`document.body.innerText.match(/Cart\\s*(\\d+)/)?.[1]`);await typeCheck({placeholder:'Phone number'},'0712345677');
      expect(await d.js(`document.body.innerText.match(/Cart\\s*(\\d+)/)?.[1]`)===cart,'typing digits in a field was treated as a scan');return {before,after:cart};
    });
    await check('Enter submits the sign-in form; typing works after logout and login',async()=>{
      await d.js(`localStorage.removeItem('token');true`);await goto('/login');await d.waitFor(`document.body.innerText.includes('Sign In')`,'login');await sleep(600);
      await typeCheck({label:'Username'},OWNER.username);await d.key(VK.TAB);await d.type(OWNER.password);await d.key(VK.ENTER);
      await d.waitFor(`location.pathname!=='/login'`,'signed in',10000);await trapNative();return await d.js('location.pathname');
    });
    await check('typing works after minimise and restore',async()=>{
      await goto('/billing');await d.waitFor(`document.body.innerText.includes('QA Charger')`,'products');
      win.minimize();await sleep(500);win.restore();win.focus();await sleep(700);
      const state={minimized:win.isMinimized(),page:await d.js('document.visibilityState')};
      if(state.minimized||state.page!=='visible')throw blocked('Windows did not restore the window in this session (locked desktop): '+JSON.stringify(state));
      await typeCheck({placeholder:'Customer name'},'Restored');return state;
    });
    await check('after minimise and restore, another page still accepts typing',async()=>{
      const state={minimized:win.isMinimized(),visible:win.isVisible(),focused:win.isFocused(),page:await d.js('document.visibilityState')};
      if(state.minimized||state.page!=='visible')throw blocked('Windows did not restore the window in this session (locked desktop): '+JSON.stringify(state));
      await goto('/products');await typeCheck({placeholder:'Search name'},'After restore');return state;
    });
    await check('no browser alert/confirm/prompt was used during the run',async()=>{const n=await nativeCalls();expect(!n.length,n.join('; '));return 'none';});
  } catch(err){checks.push({name:'harness',status:'FAIL',error:err.stack});}
  finally{save();d.close();const failed=checks.filter(c=>c.status==='FAIL').length,skipped=checks.filter(c=>c.status==='BLOCKED').length;console.log(`RESULT ${checks.length-failed-skipped}/${checks.length} passed, ${failed} failed, ${skipped} blocked`);app.exit(failed?1:0);}
}));
require(process.env.QA_APP_MAIN||'../main');   // QA_APP_MAIN points at a packaged app.asar main.js
