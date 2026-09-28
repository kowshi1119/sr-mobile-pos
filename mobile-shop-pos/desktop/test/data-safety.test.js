const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const os=require('os');const path=require('path');
const {pathsFor,migrate,validate,open}=require('../database-manager');const {backup,stageRestore}=require('../backup-manager');
const {loadSettings}=require('../settings');

test('1.1.1 data safety and money validation',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-safety-'));const paths=pathsFor(folder);const settings=loadSettings(paths);
  process.env.DESKTOP_MODE='1';process.env.DATABASE_URL='file:'+paths.db.replace(/\\/g,'/');process.env.JWT_SECRET=settings.value.jwtSecret;
  migrate(paths);
  const runtime=await require('../../backend/server').startBackend({paths,settings,capability:'cap'});
  t.after(async()=>{await runtime.close();fs.rmSync(folder,{recursive:true,force:true});});
  let token;
  const api=async(route,method='GET',body)=>{const r=await fetch(runtime.origin+'/api'+route,{method,headers:{'x-pos-capability':'cap','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>null)};};
  await api('/auth/setup','POST',{username:'owner',password:'owner-password-12'});
  token=(await api('/auth/login','POST',{username:'owner',password:'owner-password-12'})).body.token;

  await t.test('a backup made by a newer app version is refused, current data untouched',()=>{
    const newer=backup(paths,'manual');
    const db=open(newer);db.prepare('INSERT INTO _DesktopMigration VALUES (?,?,?)').run('999_future.sql','x'.repeat(64),new Date().toISOString());db.close();
    assert.throws(()=>validate(newer),/newer/i);assert.throws(()=>stageRestore(paths,newer),/newer/i);
    assert.ok(validate(paths.db));
  });
  await t.test('a non-database or renamed file is refused',()=>{
    const fake=path.join(folder,'photo.db');fs.writeFileSync(fake,Buffer.from('89504e470d0a1a0a','hex'));
    assert.throws(()=>stageRestore(paths,fake));
    const wrongExt=path.join(folder,'backup.txt');fs.copyFileSync(paths.db,wrongExt);assert.throws(()=>stageRestore(paths,wrongExt),/\.db/);
  });
  await t.test('negative, over-precise and huge amounts are refused with a readable 400',async()=>{
    const cat=(await api('/categories','POST',{name:'Money'})).body;
    for(const price of ['-1','12.345','100000000','abc']){const r=await api('/products','POST',{categoryId:cat.id,name:'P '+price,sellingPrice:price});assert.equal(r.status,400,price+' '+JSON.stringify(r.body));assert.ok(r.body.error.length>10);}
    const sale=await api('/sales','POST',{customer:{name:'M',phone:'0770000009'},items:[{productId:(await api('/products','POST',{categoryId:cat.id,name:'Valid',sellingPrice:'10.10',stockQuantity:'5'})).body.id,unitPrice:10.1,quantity:1}],paymentMethod:'CASH'});
    assert.equal(sale.status,201);
    const customer=(await api('/customers?search=0770000009')).body[0];
    for(const amount of ['-5','0.001']){const r=await api('/debt','POST',{customerId:customer.id,type:'CREDIT',amount});assert.equal(r.status,400,amount+' '+JSON.stringify(r.body));}
    const expense=await api('/expenses','POST',{category:'Other',description:'neg',amount:-10});assert.equal(expense.status,400,JSON.stringify(expense.body));
  });
  await t.test('decimal totals stay exact across sale, debt and reports',async()=>{
    const p=(await api('/products?search=Valid')).body[0];
    const r=await api('/sales','POST',{customer:{name:'Exact',phone:'0770000010'},items:[{productId:p.id,unitPrice:10.1,quantity:3}],paymentMethod:'CASH',creditAmount:30.3});
    assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(Number(r.body.sale.totalAmount),30.3);
    const c=(await api('/customers?search=0770000010')).body[0];assert.equal(Number(c.totalDebt),30.3);
    const pay=await api('/debt','POST',{customerId:c.id,type:'PAYMENT',amount:'30.30'});assert.equal(pay.status,201);
    assert.equal(Number((await api('/customers/'+c.id)).body.totalDebt),0);
    const summary=(await api('/dashboard/summary')).body;assert.equal(Math.round(summary.todaySales*100)/100,40.4);
  });
});
