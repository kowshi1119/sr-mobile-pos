const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const os=require('os');const path=require('path');const net=require('net');
const bcrypt=require('bcryptjs');
const {pathsFor,migrate,validate,open,migrations}=require('../database-manager');const {backup,stageRestore,replaceDatabase}=require('../backup-manager');
const {loadSettings,preferredPort}=require('../settings');

// Builds a database exactly as v1.0.0 left it: only the first migration, admin stored in settings.
function createV1Database(paths,settings,email,hash) {
  const [first]=migrations();
  const db=open(paths.db);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS _DesktopMigration (name TEXT PRIMARY KEY, hash TEXT NOT NULL, appliedAt TEXT NOT NULL)');
    db.exec(first.sql);db.prepare('INSERT INTO _DesktopMigration VALUES (?, ?, ?)').run(first.name,first.hash,new Date().toISOString());
    db.exec("INSERT INTO Category (id,name,warrantyMonths,isActive) VALUES ('v1-cat','Old Category',3,1)");
  } finally {db.close();}
  settings.save({...settings.value,admin:{email,hash}});
}

test('v1.1 owner/staff permissions, upgrade, validation and recovery',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sr pos perms '));const paths=pathsFor(folder);const settings=loadSettings(paths);
  process.env.DESKTOP_MODE='1';process.env.DATABASE_URL='file:'+paths.db.replace(/\\/g,'/');process.env.JWT_SECRET=settings.value.jwtSecret;
  delete process.env.GROQ_API_KEY;delete process.env.META_WHATSAPP_TOKEN;
  const log=require('../logger')(paths.logs);
  const OWNER_EMAIL='owner@example.invalid';const OWNER_PASSWORD='v1-owner-strong-password';
  createV1Database(paths,settings,OWNER_EMAIL,await bcrypt.hash(OWNER_PASSWORD,4));
  const {prisma}=require('../../backend/db');const {ensureOwner}=require('../../backend/utils/owner');
  let runtime;const start=async()=>{runtime=await require('../../backend/server').startBackend({paths,settings,capability:'cap',log,port:preferredPort(settings),onPortChange:port=>settings.save({...settings.value,port})});};
  t.after(async()=>{if(runtime)await runtime.close();fs.rmSync(folder,{recursive:true,force:true});});
  async function api(route,method='GET',body,token) {
    const response=await fetch(runtime.origin+'/api'+route,{method,headers:{'x-pos-capability':'cap','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};
  }
  let owner,staff,staffUser,category,product;

  await t.test('v1.0 database and admin upgrade to an OWNER account',async()=>{
    migrate(paths);validate(paths.db);
    assert.ok(fs.readdirSync(paths.backups).some(n=>n.startsWith('pre-migration-')),'pre-migration backup');
    assert.equal(await ensureOwner(prisma,settings),'restored');
    assert.equal(settings.value.admin,undefined);assert.equal(settings.value.owner.username,OWNER_EMAIL);
    await start();
    assert.equal((await api('/auth/setup-status')).body.required,false);
    const login=await api('/auth/login','POST',{username:'  Owner@Example.invalid ',password:OWNER_PASSWORD});
    assert.equal(login.status,200,JSON.stringify(login));owner=login.body.token;
    const me=(await api('/auth/me','GET',undefined,owner)).body;assert.equal(me.role,'OWNER');assert.ok(me.permissions.includes('products.editPrice'));
    assert.equal((await api('/categories','GET',undefined,owner)).body[0].name,'Old Category');
    // A launch without pending migrations does not add another pre-migration snapshot.
    const count=fs.readdirSync(paths.backups).length;await runtime.close();runtime=null;migrate(paths);assert.equal(fs.readdirSync(paths.backups).length,count);await start();
  });

  await t.test('the local port is saved and reused across restarts',async()=>{
    const first=runtime.origin;assert.equal(new URL(first).port,String(settings.value.port));
    await runtime.close();runtime=null;await start();assert.equal(runtime.origin,first);
    // If the saved port is taken, another one is chosen and saved.
    const blocker=net.createServer();await runtime.close();runtime=null;await new Promise(r=>blocker.listen(settings.value.port,'127.0.0.1',r));
    await start();assert.notEqual(runtime.origin,first);assert.equal(new URL(runtime.origin).port,String(settings.value.port));
    await new Promise(r=>blocker.close(r));
  });

  await t.test('clear validation messages instead of generic errors',async()=>{
    assert.equal((await api('/categories','POST',{name:'  '},owner)).status,400);
    category=(await api('/categories','POST',{name:'Phones',warrantyMonths:'12'},owner)).body;assert.equal(category.warrantyMonths,12);
    const noCategory=await api('/products','POST',{name:'X',sellingPrice:'10'},owner);assert.equal(noCategory.status,400);assert.match(noCategory.body.error,/category/i);
    const noPrice=await api('/products','POST',{categoryId:category.id,name:'X',sellingPrice:'',costPrice:''},owner);assert.equal(noPrice.status,400);assert.match(noPrice.body.error,/Selling price/);
    const badPrice=await api('/products','POST',{categoryId:category.id,name:'X',sellingPrice:'12.345'},owner);assert.equal(badPrice.status,400);
    const blankCost=await api('/products','POST',{categoryId:category.id,name:'Charger',sellingPrice:'1500',costPrice:'',stockQuantity:'10',lowStockThreshold:'',warrantyMonths:''},owner);
    assert.equal(blankCost.status,201,JSON.stringify(blankCost));assert.equal(Number(blankCost.body.costPrice),0);product=blankCost.body;
    const dupBarcode=await api('/products','POST',{categoryId:category.id,name:'Other',sellingPrice:'5',barcode:product.barcode},owner);assert.equal(dupBarcode.status,400);assert.match(dupBarcode.body.error,/already used/);
    await api('/products/'+product.id,'PATCH',{costPrice:'900'},owner);
    const noStock=await api('/sales','POST',{customer:{name:'A',phone:''},items:[{productId:product.id,unitPrice:1500,quantity:99}],paymentMethod:'CASH'},owner);
    assert.equal(noStock.status,400);assert.match(noStock.body.error,/Insufficient stock for Charger/);
    const logText=fs.readFileSync(path.join(paths.logs,'desktop.log'),'utf8');
    assert.match(logText,/"api-rejected".*"path":"\/api\/products"/);assert.doesNotMatch(logText,new RegExp(OWNER_PASSWORD));
  });

  await t.test('owner creates a cashier with limited permissions',async()=>{
    const perms=(await api('/users/permissions','GET',undefined,owner)).body;assert.ok(perms.presets.Cashier.includes('sales.create'));
    assert.equal((await api('/users','POST',{username:'ab',displayName:'Kumar',password:'cashier-pass'},owner)).status,400);
    assert.equal((await api('/users','POST',{username:'cashier1',displayName:'Kumar',password:'short'},owner)).status,400);
    const created=await api('/users','POST',{username:'Cashier1',displayName:'Kumar',password:'cashier-pass',permissions:[...perms.presets.Cashier,'users.manage','bogus']},owner);
    assert.equal(created.status,201,JSON.stringify(created));staffUser=created.body;assert.equal(staffUser.username,'cashier1');
    assert.ok(!staffUser.permissions.includes('bogus'));assert.ok(!staffUser.permissions.includes('users.manage'));
    assert.equal((await api('/users','POST',{username:'cashier1',displayName:'Dup',password:'cashier-pass'},owner)).status,409);
    const login=await api('/auth/login','POST',{username:'cashier1',password:'cashier-pass'});assert.equal(login.status,200);staff=login.body.token;
    assert.equal(login.body.user.role,'STAFF');
  });

  await t.test('staff are blocked from actions they were not given',async()=>{
    const list=await api('/products','GET',undefined,staff);assert.equal(list.status,200);assert.equal(list.body[0].costPrice,undefined,'cost hidden');
    assert.equal((await api('/products','POST',{categoryId:category.id,name:'Nope',sellingPrice:'1'},staff)).status,403);
    assert.equal((await api('/products/'+product.id,'PATCH',{sellingPrice:'1'},staff)).status,403);
    assert.equal((await api('/products/'+product.id,'PATCH',{stockQuantity:'999'},staff)).status,403);
    assert.equal((await api('/products/'+product.id,'DELETE',undefined,staff)).status,403);
    assert.equal((await api('/categories','POST',{name:'Nope'},staff)).status,403);
    for(const route of ['/users','/dashboard/summary','/dashboard/analytics/monthly','/expenses','/suppliers','/data/export']) assert.equal((await api(route,'GET',undefined,staff)).status,403,route);
    assert.equal((await api('/data/reset','POST',{confirmText:'RESET'},staff)).status,403);
    assert.equal((await api('/data/import','POST',{},staff)).status,403);
    const base={customer:{name:'Walk in',phone:''},items:[{productId:product.id,unitPrice:1500,quantity:1}],paymentMethod:'CASH'};
    assert.equal((await api('/sales','POST',{...base,discountAmount:100},staff)).status,403);
    assert.equal((await api('/sales','POST',{...base,items:[{...base.items[0],unitPrice:1000}]},staff)).status,403);
    const sale=await api('/sales','POST',base,staff);assert.equal(sale.status,201,JSON.stringify(sale));assert.equal(sale.body.sale.soldBy,'Kumar');
    const receipt=await api('/sales/'+sale.body.sale.id,'GET',undefined,staff);assert.equal(receipt.status,200);assert.equal(receipt.body.items[0].product.costPrice,undefined);
    assert.equal((await api('/products/'+product.id,'GET',undefined,owner)).body.stockQuantity,9);
  });

  await t.test('bundle lines may use the bundle price without the change-price permission',async()=>{
    const bundle=(await api('/bundles','POST',{name:'Combo',bundlePrice:1000,items:[{productId:product.id,quantity:1}]},owner)).body;
    const sale=await api('/sales','POST',{customer:{name:'B',phone:''},items:[{productId:product.id,unitPrice:1000,quantity:1,bundleId:bundle.id}],paymentMethod:'CASH'},staff);
    assert.equal(sale.status,201,JSON.stringify(sale));
  });

  await t.test('permission changes apply immediately, disabling signs the user out',async()=>{
    const updated=await api('/users/'+staffUser.id,'PATCH',{permissions:[...staffUser.permissions,'products.create','products.editPrice','products.viewCost']},owner);assert.equal(updated.status,200);
    assert.equal((await api('/products','POST',{categoryId:category.id,name:'Case',sellingPrice:'250'},staff)).status,201);
    assert.equal((await api('/products/'+product.id,'PATCH',{sellingPrice:'1600'},staff)).status,200);
    assert.equal((await api('/products/'+product.id,'PATCH',{stockQuantity:'999'},staff)).status,403,'stock still needs products.editStock');
    assert.notEqual((await api('/products','GET',undefined,staff)).body[0].costPrice,undefined);
    assert.equal((await api('/users/'+staffUser.id,'PATCH',{isActive:false},owner)).status,200);
    assert.equal((await api('/products','GET',undefined,staff)).status,401);
    assert.equal((await api('/auth/login','POST',{username:'cashier1',password:'cashier-pass'})).status,401);
    await api('/users/'+staffUser.id,'PATCH',{isActive:true},owner);
    staff=(await api('/auth/login','POST',{username:'cashier1',password:'cashier-pass'})).body.token;
  });

  await t.test('owner account is protected; passwords can be changed and reset',async()=>{
    const ownerId=(await api('/auth/me','GET',undefined,owner)).body.id;
    for(const [method,route,body] of [['PATCH','/users/'+ownerId,{isActive:false}],['DELETE','/users/'+ownerId],['POST','/users/'+ownerId+'/password',{password:'new-owner-password'}]]) assert.equal((await api(route,method,body,owner)).status,400,method+route);
    assert.equal((await api('/auth/change-password','POST',{currentPassword:'wrong',newPassword:'another-pass'},staff)).status,400);
    const changed=await api('/auth/change-password','POST',{currentPassword:'cashier-pass',newPassword:'cashier-pass-2'},staff);assert.equal(changed.status,200);
    assert.equal((await api('/products','GET',undefined,staff)).status,401,'old session ended');staff=changed.body.token;
    assert.equal((await api('/users/'+staffUser.id+'/password','POST',{password:'reset-by-owner'},owner)).status,200);
    assert.equal((await api('/products','GET',undefined,staff)).status,401);
    assert.equal((await api('/auth/login','POST',{username:'cashier1',password:'reset-by-owner'})).status,200);
    const ownerChange=await api('/auth/change-password','POST',{currentPassword:OWNER_PASSWORD,newPassword:'short'},owner);assert.equal(ownerChange.status,400,'owner needs 12+ characters');
  });

  await t.test('export excludes logins; reset keeps them',async()=>{
    const exported=await api('/data/export','GET',undefined,owner);assert.equal(exported.status,200);
    assert.doesNotMatch(JSON.stringify(exported.body),/passwordHash|\$2[ab]\$/);
    assert.equal((await api('/data/reset','POST',{confirmText:'RESET'},owner)).status,200);
    assert.equal((await api('/auth/login','POST',{username:'cashier1',password:'reset-by-owner'})).status,200);
    assert.equal((await api('/auth/me','GET',undefined,owner)).status,200);
  });

  await t.test('restoring a v1.0 backup keeps the owner able to sign in',async()=>{
    const v1=path.join(folder,'v1-backup.db');
    const db=open(v1);try{const [first]=migrations();db.exec('CREATE TABLE _DesktopMigration (name TEXT PRIMARY KEY, hash TEXT NOT NULL, appliedAt TEXT NOT NULL)');db.exec(first.sql);db.prepare('INSERT INTO _DesktopMigration VALUES (?, ?, ?)').run(first.name,first.hash,new Date().toISOString());}finally{db.close();}
    const stage=stageRestore(paths,v1);await runtime.close();runtime=null;replaceDatabase(paths,stage);migrate(paths);
    assert.equal(await ensureOwner(prisma,settings),'restored');await start();
    const login=await api('/auth/login','POST',{username:OWNER_EMAIL,password:OWNER_PASSWORD});assert.equal(login.status,200);
    assert.equal((await api('/auth/login','POST',{username:'cashier1',password:'reset-by-owner'})).status,401,'staff from the replaced database are gone');
  });
});
