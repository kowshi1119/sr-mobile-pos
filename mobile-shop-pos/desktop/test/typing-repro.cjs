// Reproduction run for the customer report "some input fields cannot be typed into".
// Records what happens (it does not assert), using real OS mouse/keyboard input on an isolated profile.
const {app}=require('electron');const fs=require('fs');const path=require('path');const os=require('os');
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-typing-'));app.setPath('userData',userData);
const outDir=process.env.QA_OUT||userData;fs.mkdirSync(outDir,{recursive:true});
const {Driver,VK,sleep}=require('./qa-driver.cjs');
let started=false;
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
  if(started)return;started=true;const results={screen:require('electron').screen.getPrimaryDisplay().size,inputMode:process.env.QA_INPUT==='os'?'os':'chromium',version:app.getVersion(),userData,scenarios:[]};const log=(name,data)=>{results.scenarios.push({name,...data});console.log("STEP",name,JSON.stringify(data).slice(0,400));fs.writeFileSync(path.join(outDir,"typing-repro.json"),JSON.stringify(results,null,2));};
  const d=new Driver(win);
  const shot=async name=>{win.webContents.invalidate();await sleep(300);const img=await win.webContents.capturePage();const f=path.join(outDir,name+'.png');fs.writeFileSync(f,img.toPNG());return f;};
  try {
    await d.start();
    // QA data through the API (setup is not what is under test here).
    const token=await d.js(`(async()=>{const j={'Content-Type':'application/json'};const c={username:'qa-owner',displayName:'QA Owner',password:'qa-owner-password-1'};
      await fetch('/api/auth/setup',{method:'POST',headers:j,body:JSON.stringify(c)});const t=(await (await fetch('/api/auth/login',{method:'POST',headers:j,body:JSON.stringify(c)})).json()).token;
      const a={...j,authorization:'Bearer '+t};const cat=await (await fetch('/api/categories',{method:'POST',headers:a,body:JSON.stringify({name:'Accessories'})})).json();
      await fetch('/api/products',{method:'POST',headers:a,body:JSON.stringify({categoryId:cat.id,name:'QA Charger',sellingPrice:'1500',stockQuantity:'20'})});
      localStorage.setItem('token',t);return t;})()`);

    // Cashier flow without scrolling: add items, then click the customer fields where they are shown.
    for(const [w,h] of [[1366,768],[1920,1080]]) for(const items of [0,1,3]) {
      await d.resize(w,h);await d.go('/billing');
      await d.waitFor(`document.body.innerText.includes('QA Charger')`,'product grid');
      await d.js(`document.querySelectorAll('p').forEach(p=>{if(p.textContent.trim()==='QA Charger')p.setAttribute('data-qa','card')})`);
      for(let i=0;i<items;i++){await d.click({css:'[data-qa=card]'});await sleep(250);}
      const fields=[];
      for(const f of ['Customer name','Phone number','WhatsApp number']) {
        fields.push(await d.clickAndType({placeholder:f},f.startsWith('Customer')?'Kumar':'0771234567'));
        await sleep(300);
        const popup=await d.js(`(()=>{if(document.querySelector('video'))return 'camera scanner opened';if(document.body.innerText.includes('AI Assistant')&&document.body.innerText.includes('Low Stock'))return 'AI assistant opened';return null})()`);
        if(popup){fields[fields.length-1].popup=popup;await d.go('/billing');for(let i=0;i<items;i++){await d.click({css:'[data-qa=card]'});await sleep(200);}}
      }
      log(`billing customer fields ${w}x${h}, ${items} item(s) in cart, no scrolling`,{fields,screenshot:await shot(`billing-${w}x${h}-${items}items`)});
    }

    // Evidence for the "collapse": watch whether the camera scanner screen appears when the covered field is tapped.
    await d.resize(1366,768);await d.go('/billing');
    await d.js(`window.__cameraShown=0;new MutationObserver(()=>{if(document.querySelector('video'))window.__cameraShown++}).observe(document.body,{childList:true,subtree:true});true`);
    const tap=await d.click({placeholder:'Phone number'});await sleep(1500);
    log('tap on covered Phone field (empty cart)',{elementOnTop:tap.onTop,cameraScreenAppeared:await d.js('window.__cameraShown>0'),cameraStillOpen:await d.js("!!document.querySelector('video')"),phoneValue:await d.value({placeholder:'Phone number'}),screenshot:await shot('tap-covered-phone')});

    // Native confirm(): open it with a real click, cancel it with a real Esc, then type into another field.
    await d.resize(1366,768);await d.go('/products');
    log('products search before any dialog',await d.clickAndType({placeholder:'Search name'},'QA'));
    if(d.mode!=='os'){log('native confirm then typing',{status:'BLOCKED',reason:'needs real Windows input (QA_INPUT=os) on an unlocked desktop; Chromium-level events cannot reproduce the Win32 WM_CHAR bug'});}else{
    await d.click({css:'button[title="Deactivate"]'});await sleep(1000);   // renderer is blocked while the native dialog is open
    log('native confirm: foreground check',{result:await d.os.cmd('fg').catch(e=>e.message)});
    await d.key(VK.ESC).catch(e=>log('dismiss confirm',{error:e.message}));await sleep(700);
    log('type after native confirm',await d.clickAndType({placeholder:'Search name'},'Charger'));
    log('type after native confirm (second field)',await d.clickAndType({css:'select'},'').catch(e=>({error:e.message})));
    // The known workaround: leaving and re-entering the window.
    win.minimize();await sleep(600);win.restore();win.focus();await sleep(800);
    log('type after minimize/restore',await d.clickAndType({placeholder:'Search name'},'Charger'));
    }
    results.screens=await shot('products-after-dialog');

    fs.writeFileSync(path.join(outDir,'typing-repro.json'),JSON.stringify(results,null,2));
  } catch(err){results.error=err.stack;fs.writeFileSync(path.join(outDir,'typing-repro.json'),JSON.stringify(results,null,2));}
  finally{d.close();app.exit(0);}
}));
require('../main');
