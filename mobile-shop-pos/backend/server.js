if (process.env.DESKTOP_MODE !== '1') require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
function createApp(options = {}) {
  const app = express(); const desktop = process.env.DESKTOP_MODE === '1';
  app.disable('x-powered-by');
  app.locals.desktop = options;
  if (desktop) {
    app.use((req,res,next) => {
      const expectedHost = '127.0.0.1:' + req.socket.localPort;
      if (req.headers.host !== expectedHost || req.headers['x-pos-capability'] !== options.capability) return res.status(403).json({error:'Access denied'});
      if (req.headers.origin && req.headers.origin !== 'http://' + expectedHost) return res.status(403).json({error:'Origin denied'});
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      const json = res.json.bind(res);
      res.json = body => { if(res.statusCode>=500 && body?.error) { options.log?.('api-error'); body={error:'The operation could not be completed. Please retry or contact support.'}; } return json(body); };
      next();
    });
  } else app.use(cors({origin:process.env.FRONTEND_URL || '*',credentials:true}));
  app.use(express.json({limit:'50mb'}));
  app.use(express.urlencoded({extended:true,limit:'50mb'}));
  app.get('/api/health',(req,res)=>res.json({status:'ok'}));
  app.use('/api/auth',require('./routes/auth'));
  if(desktop) {
    const auth=require('./middleware/auth');
    app.use('/api',auth); // Also protects invoices, webhooks and future routes locally.
    app.use('/uploads',express.static(options.paths.uploads,{dotfiles:'deny',index:false}));
  }
  const routes=['categories','products','sales','invoice','customers','repairs','dashboard','notifications','ai','debt','loyalty','suppliers','expenses','targets','bundles','reminders','whatsapp-summary','data'];
  for(const route of routes) app.use('/api/'+route,require('./routes/'+route));
  app.use('/api',(req,res)=>res.status(404).json({error:'Route not found'}));
  if(desktop) {
    const dist=path.join(__dirname,'../frontend/dist');
    app.use(express.static(dist));
    app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
  }
  app.use((err,req,res,next)=>{options.log?.('request-error',err);res.status(500).json({error:'Unable to complete the request'});});
  return app;
}
async function startBackend(options={}) {
  const app=createApp(options);
  const server=await new Promise((resolve,reject)=>{const s=app.listen(process.env.DESKTOP_MODE==='1'?0:Number(process.env.PORT||5000),process.env.DESKTOP_MODE==='1'?'127.0.0.1':undefined,()=>resolve(s));s.on('error',reject);});
  server.requestTimeout=30000;
  return { app, server, origin:'http://127.0.0.1:'+server.address().port, async close() {
    await new Promise((resolve,reject)=>{server.close(err=>err?reject(err):resolve());server.closeIdleConnections();});
    await require('./db').prisma.$disconnect();
  } };
}
if(require.main===module) startBackend().then(runtime=>{
  console.log('POS backend started');
  for(const sig of ['SIGINT','SIGTERM']) process.on(sig,()=>runtime.close().then(()=>process.exit(0)));
}).catch(()=>{console.error('Backend startup failed');process.exitCode=1;});
module.exports={createApp,startBackend};
