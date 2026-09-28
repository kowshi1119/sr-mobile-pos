// New Sale (billing) QA through the real UI with real input events: double submit, F12, decimal
// credit sales, discounts, payment methods, receipts and offline WhatsApp. Results: <QA_OUT>/sales-qa.json
const {app}=require('electron');const fs=require('fs');const path=require('path');const os=require('os');
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-sales-qa-'));app.setPath('userData',userData);
const outDir=process.env.QA_OUT||userData;fs.mkdirSync(outDir,{recursive:true});
const {Driver,VK,sleep}=require('./qa-driver.cjs');
let started=false;
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
  if(started)return;started=true;
  const d=new Driver(win);const checks=[];
  const save=()=>fs.writeFileSync(path.join(outDir,'sales-qa.json'),JSON.stringify({inputMode:d.mode,userData,checks},null,2));
  const check=async(name,fn)=>{try{const detail=await fn();checks.push({name,status:'PASS',detail});console.log('PASS',name,JSON.stringify(detail).slice(0,200));}catch(e){checks.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message);}save();};
  const expect=(c,m)=>{if(!c)throw Error(m);};
  const api=(route,method='GET',body)=>d.js(`(async()=>{const r=await fetch('/api${route}',{method:'${method}',headers:{'Content-Type':'application/json',authorization:'Bearer '+localStorage.getItem('token')},body:${body?JSON.stringify(JSON.stringify(body)):'undefined'}});return {status:r.status,body:await r.json().catch(()=>null)}})()`);
  const salesCount=async()=>(await api('/sales')).body.length;
  const openBilling=async()=>{await d.go('/billing');await d.waitFor(`document.body.innerText.includes('Ten Cent Sticker')`,'products');await d.js(`document.querySelectorAll('p').forEach(p=>{const t=p.textContent.trim();if(t==='Ten Cent Sticker')p.setAttribute('data-qa','cheap');if(t==='Phone Case')p.setAttribute('data-qa','case')})`);};
  const addItem=async(which,n=1)=>{for(let i=0;i<n;i++){await d.click({css:`[data-qa=${which}]`});await sleep(200);}};
  const finishSale=async()=>{await d.waitFor(`location.pathname==='/sale-success'`,'receipt page',15000);await sleep(500);return d.js(`document.body.innerText.match(/INV-\\d+/)?.[0]`);};
  try {
    await d.start();await d.resize(1366,768);
    await d.js(`(async()=>{const j={'Content-Type':'application/json'};const c={username:'qa-owner',displayName:'QA Owner',password:'qa-owner-password-1'};
      await fetch('/api/auth/setup',{method:'POST',headers:j,body:JSON.stringify(c)});const t=(await (await fetch('/api/auth/login',{method:'POST',headers:j,body:JSON.stringify(c)})).json()).token;
      const a={...j,authorization:'Bearer '+t};const cat=await (await fetch('/api/categories',{method:'POST',headers:a,body:JSON.stringify({name:'Accessories'})})).json();
      for(const p of [{name:'Ten Cent Sticker',sellingPrice:'0.10',stockQuantity:'500'},{name:'Phone Case',sellingPrice:'1499.50',stockQuantity:'50'}])await fetch('/api/products',{method:'POST',headers:a,body:JSON.stringify({categoryId:cat.id,...p})});
      localStorage.setItem('token',t);return true})()`);

    await check('double-clicking Complete Sale creates one sale',async()=>{
      const before=await salesCount();await openBilling();await addItem('case');
      await d.dblclick({button:'Complete Sale'});const inv=await finishSale();await sleep(1500);
      const after=await salesCount();expect(after===before+1,`${after-before} sales created`);return {invoice:inv,created:after-before};
    });
    await check('pressing F12 twice quickly creates one sale',async()=>{
      const before=await salesCount();await openBilling();await addItem('case');await d.click({css:'h1'});
      await d.key(VK.F12);await d.key(VK.F12);await finishSale();await sleep(1500);
      const after=await salesCount();expect(after===before+1,`${after-before} sales created`);return {created:after-before};
    });
    await check('credit sale with decimal prices (3 x 0.10) saves and records LKR 0.30 debt',async()=>{
      await openBilling();await addItem('cheap',3);
      await d.click({placeholder:'Customer name'});await d.type('Decimal Credit');await d.click({placeholder:'Phone number'});await d.type('0771112223');
      await d.click({css:'input.accent-red-400'});await sleep(300);
      const shownTotal=await d.js(`[...document.querySelectorAll('span')].find(s=>/^LKR/.test(s.textContent)&&s.className.includes('text-2xl'))?.textContent`);
      await d.click({button:'Complete Sale'});
      const outcome=await Promise.race([finishSale().then(()=>'saved'),d.waitFor(`!!document.querySelector('[data-app-dialog]')`,'error',15000).then(async()=>'error: '+await d.js(`document.querySelector('[data-app-dialog] p').textContent`))]);
      expect(outcome==='saved',outcome+' (total shown '+shownTotal+')');
      const cust=(await api('/customers?search=0771112223')).body[0];expect(Number(cust.totalDebt)===0.3,'debt '+cust.totalDebt);return {shownTotal,debt:cust.totalDebt};
    });
    await check('10% discount on LKR 1,499.50: screen total matches saved sale total',async()=>{
      await openBilling();await addItem('case');await d.click({button:'Add discount'});await d.click({placeholder:'e.g. 10'});await d.type('10');await sleep(300);
      const screen=await d.js(`[...document.querySelectorAll('span')].find(s=>/^LKR/.test(s.textContent)&&s.className.includes('text-2xl'))?.textContent`);
      await d.click({button:'Complete Sale'});await finishSale();
      const sale=(await api('/sales')).body[0];const saved=Number(sale.totalAmount);
      expect(screen.replace(/[^\d.]/g,'')==String(saved)||Number(screen.replace(/[^\d.]/g,''))===saved,`screen ${screen} vs saved ${saved}`);return {screen,saved,discount:sale.discountAmount};
    });
    for(const m of ['CARD','TRANSFER']) await check(`payment method ${m} is saved`,async()=>{
      await openBilling();await addItem('cheap');await d.click({button:m});await d.click({button:'Complete Sale'});await finishSale();
      const sale=(await api('/sales')).body[0];expect(sale.paymentMethod===m,'saved '+sale.paymentMethod);return sale.invoiceNumber;
    });
    await check('invoice numbers are sequential and stock went down',async()=>{
      const sales=(await api('/sales')).body;const nums=sales.map(s=>Number(s.invoiceNumber.slice(4))).sort((a,b)=>a-b);
      expect(nums.every((n,i)=>n===i+1),'invoice numbers '+nums.join(','));
      const products=(await api('/products')).body;const caseP=products.find(p=>p.name==='Phone Case');
      const sold=sales.flatMap(s=>s.items).filter(i=>i.product?.name==='Phone Case').reduce((s,i)=>s+i.quantity,0);
      expect(caseP.stockQuantity===50-sold,`stock ${caseP.stockQuantity}, sold ${sold}`);return {invoices:nums,phoneCaseStock:caseP.stockQuantity};
    });
    await check('WhatsApp opt-in sale with internet blocked: sale saved, clear notice, no freeze',async()=>{
      win.webContents.session.webRequest.onBeforeRequest({urls:['https://*/*','http://*/*']},(dt,cb)=>cb({cancel:!dt.url.startsWith('http://127.0.0.1:')}));
      await openBilling();await addItem('cheap');await d.click({placeholder:'Customer name'});await d.type('Offline WA');await d.click({placeholder:'Phone number'});await d.type('0775556667');
      const before=await d.js(`document.querySelector('input.accent-brand')?.checked`);
      const hit=await d.click({css:'input.accent-brand'});await sleep(300);
      const optIn=await d.js(`document.querySelector('input.accent-brand')?.checked`);expect(optIn===true,'WhatsApp opt-in box was not ticked by the click: '+JSON.stringify({before,after:optIn,hit}));const t0=Date.now();await d.click({button:'Complete Sale'});await finishSale();const ms=Date.now()-t0;
      const text=await d.js('document.body.innerText');expect(ms<12000,'took '+ms+' ms');
      const notice=(text.match(/[^\n]*WhatsApp[^\n]*not sent[^\n]*/)||[])[0];expect(notice,'receipt page does not tell the user the WhatsApp message was not sent; receipt text starts: '+text.slice(0,300).replace(/\n+/g,' | '));
      return {ms,notice};
    });
  } catch(err){checks.push({name:'harness',status:'FAIL',error:err.stack});}
  finally{save();d.close();const failed=checks.filter(c=>c.status==='FAIL').length;console.log(`RESULT ${checks.length-failed}/${checks.length} passed`);app.exit(failed?1:0);}
}));
require(process.env.QA_APP_MAIN||'../main');   // QA_APP_MAIN points at a packaged app.asar main.js
