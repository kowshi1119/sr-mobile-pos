const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const os=require('os');const path=require('path');const crypto=require('crypto');
const {pathsFor,migrate,validate,open}=require('../database-manager');const {backup,stageRestore,replaceDatabase}=require('../backup-manager');
test('local POS lifecycle, business records, security and recovery',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sr-pos-qa-'));const paths=pathsFor(folder);const settings=require('../settings').loadSettings(paths);
  process.env.DESKTOP_MODE='1';process.env.DATABASE_URL='file:'+paths.db.replace(/\\/g,'/');process.env.JWT_SECRET=settings.value.jwtSecret;
  delete process.env.GROQ_API_KEY;delete process.env.META_WHATSAPP_TOKEN;
  migrate(paths);validate(paths.db);let runtime=await require('../../backend/server').startBackend({paths,settings,capability:'test-capability'});
  t.after(async()=>{if(runtime)await runtime.close();fs.rmSync(folder,{recursive:true,force:true});});
  let token;let product;let customer;let sale;let before;
  async function api(route,method='GET',body,extra={}) {
    const response=await fetch(runtime.origin+'/api'+route,{method,headers:{'x-pos-capability':'test-capability','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }
  await t.test('loopback capability, origin and JWT restrictions',async()=>{
    assert.equal(runtime.server.address().address,'127.0.0.1');
    assert.equal((await fetch(runtime.origin+'/api/health')).status,403);
    assert.equal((await api('/health','GET',undefined,{origin:'https://attacker.invalid'})).status,403);
    assert.equal((await api('/products')).status,401);
    assert.equal((await api('/invoice/INV-0001')).status,401);
  });
  await t.test('first-run setup, strong password and login',async()=>{
    assert.equal((await api('/auth/setup-status')).body.required,true);
    assert.equal((await api('/auth/setup','POST',{email:'qa@example.invalid',password:'short'})).status,400);
    assert.equal((await api('/auth/setup','POST',{email:'qa@example.invalid',password:'qa-only-strong-password'})).status,201);
    assert.equal((await api('/auth/setup','POST',{email:'qa@example.invalid',password:'qa-only-strong-password'})).status,409);
    assert.equal((await api('/auth/login','POST',{email:'qa@example.invalid',password:'wrong'})).status,401);
    const login=await api('/auth/login','POST',{email:'qa@example.invalid',password:'qa-only-strong-password'});assert.equal(login.status,200);token=login.body.token;
    assert.equal((await api('/auth/me')).body.role,'admin');
  });
  await t.test('category and product create/edit/search',async()=>{
    const category=await api('/categories','POST',{name:'Accessories',warrantyMonths:3});assert.equal(category.status,201);
    const created=await api('/products','POST',{categoryId:category.body.id,name:'QA Cable',sellingPrice:0.1,costPrice:0.05,stockQuantity:20,barcode:'QA-CABLE'});assert.equal(created.status,201,JSON.stringify(created));product=created.body;
    assert.equal((await api('/products/'+product.id,'PATCH',{name:'QA Cable Edited'})).status,200);
    assert.equal((await api('/products?search=cable')).body.length,1);
  });
  await t.test('fractional-price sale, stock, invoice, debt and exact totals',async()=>{
    const created=await api('/sales','POST',{customer:{name:'QA Customer',phone:'QA-001'},items:[{productId:product.id,unitPrice:'0.10',quantity:3},{productId:product.id,unitPrice:'0.20',quantity:1}],paymentMethod:'CASH',creditAmount:'0.20'});
    assert.equal(created.status,201,JSON.stringify(created));sale=created.body.sale;assert.equal(Number(sale.totalAmount),0.5);
    assert.equal((await api('/products/'+product.id)).body.stockQuantity,16);
    customer=(await api('/customers')).body[0];assert.equal(Number(customer.totalDebt),0.2);
    assert.equal((await api('/invoice/'+sale.invoiceNumber)).status,200);
    assert.equal((await api('/customers/'+customer.id,'PATCH',{name:'QA Edited'})).status,200);
  });
  await t.test('manual debt decimal accumulation is atomic and rounded',async()=>{
    for(let i=1;i<=10;i++) {
      assert.equal((await api('/debt','POST',{customerId:customer.id,type:'CREDIT',amount:'0.10'})).status,201);
      assert.equal(Number((await api('/customers/'+customer.id)).body.totalDebt),(2+i)/10);
    }
    assert.equal((await api('/debt','POST',{customerId:customer.id,type:'PAYMENT',amount:'1.00'})).status,201);
    assert.equal(Number((await api('/customers/'+customer.id)).body.totalDebt),0.2);
  });
  await t.test('rejected stock and malformed sales roll back',async()=>{
    const base={customer:{name:'Rollback',phone:'QA-ROLLBACK'},items:[{productId:product.id,unitPrice:1,quantity:100}],paymentMethod:'CASH'};
    assert.notEqual((await api('/sales','POST',base)).status,201);
    assert.equal((await api('/customers?search=QA-ROLLBACK')).body.length,0);
    assert.equal((await api('/sales','POST',{...base,items:[{productId:product.id,unitPrice:1,quantity:-1}]})).status,400);
    assert.equal((await api('/products/'+product.id)).body.stockQuantity,16);
  });
  await t.test('repairs, local reports and optional AI offline behavior',async()=>{
    const repair=await api('/repairs','POST',{customerId:customer.id,deviceName:'QA Phone',issueDescription:'Screen',estimatedCost:100});assert.equal(repair.status,201,JSON.stringify(repair));
    assert.equal((await api('/repairs/'+repair.body.id+'/status','PATCH',{status:'IN_PROGRESS'})).status,200);
    for(const route of ['/dashboard/summary','/dashboard/low-stock','/dashboard/analytics/monthly','/dashboard/analytics/products','/dashboard/analytics/trends','/dashboard/analytics/customers','/suppliers','/expenses','/targets','/bundles','/loyalty/leaderboard','/reminders/warranty-expiring','/notifications']) assert.equal((await api(route)).status,200,route);
    assert.equal((await api('/ai/chat','POST',{query:'test'})).status,503);
  });
  await t.test('variants, IMEI warranty, suppliers, expenses, targets and bundles',async()=>{
    const category=(await api('/categories','POST',{name:'Phones',warrantyMonths:12})).body;
    const variantProduct=(await api('/products','POST',{categoryId:category.id,name:'Variant phone',sellingPrice:1000,costPrice:500,stockQuantity:2,barcode:'VAR-P',variants:[{variantName:'Blue',priceOverride:1000,stockQuantity:2,barcode:'VAR-BLUE'}]})).body;
    assert.ok(variantProduct.variants?.length);
    const variantSale=await api('/sales','POST',{customer:{name:'Loyal customer',phone:'QA-LOYAL',whatsappOptIn:true},items:[{productId:variantProduct.id,variantId:variantProduct.variants[0].id,unitPrice:1000,quantity:1}],paymentMethod:'CARD'});
    assert.equal(variantSale.status,201,JSON.stringify(variantSale));assert.ok(variantSale.body.integrationNotice.includes('not sent'));
    assert.equal((await api('/products/'+variantProduct.id)).body.variants[0].stockQuantity,1);
    const loyal=(await api('/customers?search=QA-LOYAL')).body[0];assert.equal((await api('/loyalty/customer/'+loyal.id)).body.points,10);
    const imeiProduct=(await api('/products','POST',{categoryId:category.id,name:'IMEI Phone',sellingPrice:2000,costPrice:1000,hasImei:true,imeiNumbers:['QA-IMEI-01'],barcode:'IMEI-P'})).body;
    const imeiSale=await api('/sales','POST',{customer:{name:'IMEI Customer',phone:'QA-IMEI-C'},items:[{productId:imeiProduct.id,imeiId:imeiProduct.imeiRecords[0].id,unitPrice:2000,quantity:1}],paymentMethod:'TRANSFER'});
    assert.equal(imeiSale.status,201,JSON.stringify(imeiSale));assert.equal((await api('/products/'+imeiProduct.id)).body.stockQuantity,0);
    assert.equal((await api('/products/'+imeiProduct.id+'/imei')).body[0].status,'SOLD');assert.equal((await api('/sales/'+imeiSale.body.sale.id)).body.warrantyRecords.length,1);
    const supplier=await api('/suppliers','POST',{name:'QA Supplier'});assert.equal(supplier.status,201);
    const purchase=await api('/suppliers/'+supplier.body.id+'/purchases','POST',{items:[{productName:'Cable',quantity:3,unitCost:0.1}]});assert.equal(purchase.status,201);assert.equal(Number(purchase.body.totalAmount),0.3);
    assert.equal((await api('/expenses','POST',{category:'Other',description:'QA',amount:0.1})).status,201);
    assert.equal((await api('/targets','POST',{year:2026,month:9,targetAmount:10000})).status,200);
    assert.equal((await api('/bundles','POST',{name:'QA Bundle',bundlePrice:0.2,items:[{productId:product.id,quantity:2}]})).status,201);
  });
  await t.test('local image upload and invalid file rejection',async()=>{
    const form=new FormData();form.append('image',new Blob([Buffer.from('89504e470d0a1a0a','hex')],{type:'image/png'}),'qa.png');
    const r=await fetch(runtime.origin+'/api/products/upload-image',{method:'POST',headers:{'x-pos-capability':'test-capability',authorization:'Bearer '+token},body:form});assert.equal(r.status,200);const data=await r.json();assert.ok(data.imageUrl.startsWith('/uploads/'));
    const bad=new FormData();bad.append('image',new Blob(['<svg onload=alert(1)>'],{type:'image/svg+xml'}),'bad.svg');
    assert.equal((await fetch(runtime.origin+'/api/products/upload-image',{method:'POST',headers:{'x-pos-capability':'test-capability',authorization:'Bearer '+token},body:bad})).status,400);
  });
  await t.test('JSON round trip and invoice counter preservation',async()=>{
    const exported=await api('/data/export');assert.equal(exported.status,200);
    const imported=await api('/data/import','POST',exported.body);assert.equal(imported.status,200,JSON.stringify(imported));
    assert.equal((await api('/sales')).body.length,3);
  });
  await t.test('consistent snapshot, retention and invalid restore',async()=>{
    before=backup(paths,'manual');assert.ok(validate(before));
    const bad=path.join(folder,'invalid.db');fs.writeFileSync(bad,'not sqlite');assert.throws(()=>stageRestore(paths,bad));
    for(let i=0;i<32;i++)backup(paths);
    assert.equal(fs.readdirSync(paths.backups).filter(n=>/^(auto|manual)-/.test(n)).length,30);
    before=backup(paths,'manual');
  });
  await t.test('close/reopen persistence and migration upgrade simulation',async()=>{
    await runtime.close();runtime=null;migrate(paths);
    runtime=await require('../../backend/server').startBackend({paths,settings,capability:'test-capability'});
    assert.equal((await api('/sales')).body.length,3);assert.equal((await api('/products/'+product.id)).body.stockQuantity,16);
    assert.equal((await api('/auth/me')).status,200);
  });
  await t.test('restore replaces records only after safety backup',async()=>{
    await api('/products/'+product.id,'PATCH',{name:'Changed after backup'});
    const stage=stageRestore(paths,before);await runtime.close();runtime=null;replaceDatabase(paths,stage);migrate(paths);
    runtime=await require('../../backend/server').startBackend({paths,settings,capability:'test-capability'});
    assert.equal((await api('/products/'+product.id)).body.name,'QA Cable Edited');
    assert.ok(fs.readdirSync(paths.backups).some(n=>n.startsWith('safety-')));
  });
  await t.test('database rejects invalid enum values and schema tampering',()=>{
    const db=open(paths.db);assert.throws(()=>db.prepare('UPDATE Sale SET paymentMethod=?').run('INVALID'));db.close();
    const copy=stageRestore(paths,before);const changed=open(copy);changed.exec('CREATE TRIGGER unsafe AFTER INSERT ON Product BEGIN DELETE FROM Sale; END');changed.close();assert.throws(()=>validate(copy));fs.unlinkSync(copy);
  });
});
