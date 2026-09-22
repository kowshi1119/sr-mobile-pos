const {spawnSync}=require('child_process');const path=require('path');const fs=require('fs');
const root=path.resolve(__dirname,'../../..');process.chdir(root);
function run(script,args,env={}) {const r=spawnSync(process.execPath,[script,...args],{stdio:'inherit',env:{...process.env,...env}});if(r.status!==0)process.exit(r.status||1);}
run(require.resolve('prisma/build/index.js'),['generate','--schema','mobile-shop-pos/backend/prisma/desktop/schema.prisma'],{DATABASE_URL:'file:build-only.db'});
const vite=path.join(root,'mobile-shop-pos/frontend/node_modules/vite/bin/vite.js');
if(!fs.existsSync(vite)){console.error('Run npm ci --prefix mobile-shop-pos/frontend first.');process.exit(1);}
process.chdir(path.join(root,'mobile-shop-pos/frontend'));
run(vite,['build','--mode','desktop'],{VITE_API_URL:''});
