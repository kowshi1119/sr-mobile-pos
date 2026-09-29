// Release check: lists what a packaged app.asar / folder contains and fails if it holds anything that must
// never ship (tests, env files, databases, secrets). Usage: node scan-package.js <app.asar | folder>...
const fs=require('fs');const path=require('path');const os=require('os');
const asar=require('@electron/asar');
const FORBIDDEN_FILES=[/(^|[\\/])\.env(\.|$)/i,/\.(db|sqlite|sqlite3)$/i,/[\\/]desktop[\\/]test[\\/]/i,/hash\.txt$/i,/hashPassword\.js$/i,/\.(pem|key|pfx|p12)$/i,/(^|[\\/])node_modules[\\/].*[\\/]\.env$/i];
const SECRET_PATTERNS=[['Groq key',/gsk_[A-Za-z0-9]{20,}/],['OpenAI-style key',/\bsk-[A-Za-z0-9]{32,}/],['DB URL with password',/postgres(ql)?:\/\/[^\s"'`:]+:[^\s"'`@]+@/],['private key',/BEGIN (RSA |EC )?PRIVATE KEY/],['bcrypt hash',/\$2[aby]\$1\d\$[./A-Za-z0-9]{53}/],['Meta token',/EAA[A-Za-z0-9]{60,}/],['Cloudinary URL',/cloudinary:\/\/\d+:[^@\s]+@/]];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const problems=[];const report={};
for(const target of process.argv.slice(2)){
  let root=target,cleanup=null;
  if(target.endsWith('.asar')){root=fs.mkdtempSync(path.join(os.tmpdir(),'sr-scan-'));asar.extractAll(target,root);cleanup=root;}
  const files=walk(root).map(f=>path.relative(root,f));
  report[target]={files:files.length,frontendDist:files.filter(f=>/frontend[\\/]dist[\\/]/.test(f)).length,migrations:files.filter(f=>/migrations[\\/].+\.sql$/.test(f)),generatedClient:files.some(f=>/generated[\\/]desktop[\\/]index\.js$/.test(f))};
  for(const f of files){
    if(FORBIDDEN_FILES.some(r=>r.test(f)))problems.push(`${target}: forbidden file ${f}`);
    if(/node_modules/.test(f)||!/\.(js|cjs|mjs|json|md|txt|yml|yaml|html|env|sql)$/i.test(f))continue;
    const text=fs.readFileSync(path.join(root,f),'utf8');
    for(const [name,re] of SECRET_PATTERNS)if(re.test(text))problems.push(`${target}: possible ${name} in ${f}`);
  }
  if(cleanup)fs.rmSync(cleanup,{recursive:true,force:true});
}
console.log(JSON.stringify({report,problems},null,2));
process.exit(problems.length?1:0);
