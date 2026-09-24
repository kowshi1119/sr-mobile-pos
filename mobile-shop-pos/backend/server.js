if (process.env.DESKTOP_MODE !== '1') require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { classify } = require('./utils/errors');
// Technical details for the log: route and error identity only, never request bodies or tokens.
function errorDetails(req,status,err) {
  return {method:req.method,path:req.originalUrl.split('?')[0],status,name:err?.name,code:err?.code,message:typeof err?.message==='string'?err.message.slice(0,300):undefined};
}
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
      next();
    });
  } else app.use(cors({origin:process.env.FRONTEND_URL || '*',credentials:true}));
  // Unexpected server errors are logged with details and shown to the user as a generic message;
  // known business errors (4xx) keep their own readable message.
  app.use((req,res,next)=>{
    const json=res.json.bind(res);
    res.json=body=>{
      // Rejected requests that raised an error are logged too, to help support explain a failed save.
      if(res.statusCode>=400&&res.statusCode<500&&res.locals.error)options.log?.('api-rejected',errorDetails(req,res.statusCode,res.locals.error));
      if(res.statusCode>=500&&body?.error) {
        options.log?.('api-error',errorDetails(req,res.statusCode,res.locals.error));
        if(desktop)body={error:'Something went wrong. Please try again. If it keeps happening, restart SR Mobile POS.'};
      }
      return json(body);
    };
    next();
  });
  app.use(express.json({limit:'50mb'}));
  app.use(express.urlencoded({extended:true,limit:'50mb'}));
  app.get('/api/health',(req,res)=>res.json({status:'ok'}));
  app.use('/api/auth',require('./routes/auth'));
  if(desktop) {
    const auth=require('./middleware/auth');
    app.use('/api',auth); // Also protects invoices, webhooks and future routes locally.
    app.use('/uploads',express.static(options.paths.uploads,{dotfiles:'deny',index:false}),(req,res)=>res.status(404).end());
  }
  app.use('/api/users',require('./routes/users'));
  const routes=['categories','products','sales','invoice','customers','repairs','dashboard','notifications','ai','debt','loyalty','suppliers','expenses','targets','bundles','reminders','whatsapp-summary','data'];
  for(const route of routes) app.use('/api/'+route,require('./routes/'+route));
  app.use('/api',(req,res)=>res.status(404).json({error:'Route not found'}));
  if(desktop) {
    const dist=path.join(__dirname,'../frontend/dist');
    app.use(express.static(dist));
    app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
  }
  app.use((err,req,res,next)=>{
    const known=classify(err)||(err?.type==='entity.too.large'?{status:413,message:'The upload is too large.'}:err?.type==='entity.parse.failed'?{status:400,message:'Invalid request.'}:null);
    res.locals.error=err;
    if(known)return res.status(known.status).json({error:known.message});
    res.status(500).json({error:'Unable to complete the request'});
  });
  return app;
}
function listen(app,port,host) {
  return new Promise((resolve,reject)=>{const s=app.listen(port,host,()=>resolve(s));s.on('error',reject);});
}
// Desktop mode prefers the saved port so the window keeps the same origin (and its saved login and
// theme) between launches; if that port is taken, onPortChange receives the replacement.
async function startBackend(options={}) {
  const app=createApp(options); const desktop=process.env.DESKTOP_MODE==='1';
  let server;
  if(desktop) {
    const preferred=Number.isInteger(options.port)&&options.port>1024&&options.port<65536?options.port:0;
    try {server=await listen(app,preferred,'127.0.0.1');}
    catch(err) {if(err.code!=='EADDRINUSE'&&err.code!=='EACCES')throw err;options.log?.('port-unavailable',{code:err.code});server=await listen(app,0,'127.0.0.1');}
    if(server.address().port!==preferred)options.onPortChange?.(server.address().port);
  } else server=await listen(app,Number(process.env.PORT||5000));
  server.requestTimeout=300000; // Large JSON imports can take several minutes on slower PCs.
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
