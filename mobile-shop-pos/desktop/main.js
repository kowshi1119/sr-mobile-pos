const { app, BrowserWindow, dialog, ipcMain, session }=require('electron');
const fs=require('fs'); const path=require('path');const crypto=require('crypto');
app.setName('SR Mobile POS');
const diagnostic=process.argv.includes('--diagnostic-smoke');
if(diagnostic)app.setPath('userData',fs.mkdtempSync(path.join(require('os').tmpdir(),'sr-pos-packaged-')));
if(!app.requestSingleInstanceLock()) { app.quit(); } else {
  let window,runtime,paths,log,timer,quitting=false,stopping=false,nativeBusy=false;
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.on('before-quit',event=>{
    if(quitting)return;event.preventDefault();if(nativeBusy||stopping)return;stopping=true;
    clearInterval(timer);
    Promise.resolve(runtime?.close()).then(()=>{if(paths&&fs.existsSync(paths.db))require('./backup-manager').backup(paths);log?.('shutdown');quitting=true;app.quit();})
    .catch(err=>{log?.('shutdown-failed',err);stopping=false;dialog.showErrorBox('Unable to close safely','A database operation has not finished. Please retry closing the application.');});
  });
  app.on('window-all-closed',()=>app.quit());
  app.whenReady().then(async()=>{
    const {pathsFor,migrate}=require('./database-manager');
    paths=pathsFor(app.getPath('userData'));log=require('./logger')(paths.logs);log('startup');
    console.error=(...args)=>log('backend-error',args.find(a=>a instanceof Error)||{message:args.map(String).join(' ')});
    const {loadSettings,preferredPort}=require('./settings');const settings=loadSettings(paths);
    process.env.DESKTOP_MODE='1';process.env.DATABASE_URL='file:'+paths.db.replace(/\\/g,'/');process.env.JWT_SECRET=settings.value.jwtSecret;
    // Load only explicit optional integration settings; never inherit developer DB/auth configuration.
    for(const key of ['ADMIN_EMAIL','ADMIN_PASSWORD','GROQ_API_KEY','META_WHATSAPP_TOKEN','META_PHONE_NUMBER_ID','OWNER_WHATSAPP_NUMBER','META_WEBHOOK_VERIFY_TOKEN'])delete process.env[key];
    const integrations=path.join(paths.settings,'integrations.json');
    if(fs.existsSync(integrations)) {const values=JSON.parse(fs.readFileSync(integrations,'utf8'));for(const key of ['GROQ_API_KEY','META_WHATSAPP_TOKEN','META_PHONE_NUMBER_ID','OWNER_WHATSAPP_NUMBER'])if(typeof values[key]==='string')process.env[key]=values[key];}
    migrate(paths);log('database-ready');
    log('owner-check',{result:await require('../backend/utils/owner').ensureOwner(require('../backend/db').prisma,settings)});
    const capability=crypto.randomBytes(32).toString('hex');
    runtime=await require('../backend/server').startBackend({paths,settings,capability,log,port:preferredPort(settings),onPortChange:port=>settings.save({...settings.value,port})});log('backend-ready');
    const {backup,stageRestore,replaceDatabase}=require('./backup-manager');
    backup(paths);
    timer=setInterval(()=>{try{backup(paths);log('scheduled-backup');}catch(err){log('backup-failed',err);window?.webContents.send('pos:backup-failed');}},86400000);
    const ses=session.fromPartition('persist:sr-mobile-pos');
    ses.webRequest.onBeforeSendHeaders((details,callback)=>{
      const headers={...details.requestHeaders};delete headers['X-POS-Capability'];
      if(new URL(details.url).origin===runtime.origin)headers['X-POS-Capability']=capability;
      callback({requestHeaders:headers});
    });
    ses.setPermissionRequestHandler((wc,permission,callback)=>callback(permission==='media'&&wc===window?.webContents&&new URL(wc.getURL()).origin===runtime.origin));
    ses.setPermissionCheckHandler((wc,permission)=>permission==='media'&&wc===window?.webContents);
    ses.on('will-download',(event,item)=>item.setSaveDialogOptions({defaultPath:path.join(paths.exports,path.basename(item.getFilename()))}));
    window=new BrowserWindow({width:1440,height:950,minWidth:1000,minHeight:700,title:'SR Mobile POS',show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),session:ses,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==runtime.origin)event.preventDefault();});
    // Backup needs the owner or the data.backup permission; restore is owner-only.
    const verify=async(event,token,permission)=>{
      if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||new URL(event.senderFrame.url).origin!==runtime.origin)throw new Error('Untrusted caller');
      const claims=require('jsonwebtoken').verify(token,settings.value.jwtSecret,{algorithms:['HS256']});
      const user=typeof claims.sub==='string'?await require('../backend/db').prisma.user.findUnique({where:{id:claims.sub}}):null;
      if(!user||!user.isActive||user.tokenVersion!==claims.tv)throw new Error('Session expired');
      const session=require('../backend/middleware/auth').toSessionUser(user);
      if(!require('../backend/utils/permissions').has(session,...(permission?[permission]:[])))throw new Error('Permission required');
    };
    ipcMain.handle('pos:backup',async(event,token)=>{
      let ownsBusy=false;
      try {try{await verify(event,token,'data.backup');}catch{return {error:'You do not have permission to back up data.'};}if(nativeBusy)return {error:'Another backup operation is in progress'};nativeBusy=true;ownsBusy=true;
        const selected=await dialog.showSaveDialog(window,{title:'Backup Data',defaultPath:path.join(paths.exports,'SR-Mobile-POS-'+Date.now()+'.db'),filters:[{name:'POS database',extensions:['db']}]});
        if(selected.canceled)return {cancelled:true};
        if(path.extname(selected.filePath).toLowerCase()!=='.db')return {error:'Choose a .db filename'};
        const target=path.resolve(selected.filePath);if(target.startsWith(path.resolve(paths.data)+path.sep)||target.startsWith(path.resolve(paths.settings)+path.sep))return {error:'Choose an export folder'};
        const source=backup(paths,'manual');fs.copyFileSync(source,target);log('manual-backup');return {saved:true};
      }catch(err){log('manual-backup-failed',err);return {error:'Unable to save backup. Choose another destination.'};}finally{if(ownsBusy)nativeBusy=false;}
    });
    ipcMain.handle('pos:restore',async(event,token)=>{
      let stage,ownsBusy=false;
      try {try{await verify(event,token);}catch{return {error:'Only the owner can restore a backup.'};}if(nativeBusy)return {error:'Another backup operation is in progress'};nativeBusy=true;ownsBusy=true;
        const selected=await dialog.showOpenDialog(window,{title:'Restore Backup',properties:['openFile'],filters:[{name:'POS database',extensions:['db']}]});
        if(selected.canceled)return {cancelled:true};stage=stageRestore(paths,selected.filePaths[0]);
        const answer=await dialog.showMessageBox(window,{type:'warning',buttons:['Cancel','Restore and restart'],defaultId:0,cancelId:0,message:'Replace shop data with this backup?',detail:'A safety backup of current data will be saved first. Staff accounts are replaced by the ones in the backup; your owner login keeps working. Images remain unchanged.'});
        if(answer.response!==1)return {cancelled:true};
        clearInterval(timer);await runtime.close();runtime=null;replaceDatabase(paths,stage);stage=null;log('restore-complete');
        quitting=true;app.relaunch();app.quit();return {restored:true};
      }catch(err){log('restore-failed',err);if(!runtime){quitting=true;dialog.showErrorBox('Restore stopped','Your safety backup is retained. Restart SR Mobile POS to recover.');app.quit();}return {error:'Restore stopped. Select an intact SR Mobile POS backup from this version or an older supported version.'};}
      finally{if(ownsBusy)nativeBusy=false;if(stage&&fs.existsSync(stage))fs.unlinkSync(stage);}
    });
    ipcMain.handle('pos:print',event=>{if(event.sender!==window.webContents)return;window.webContents.print({silent:false,printBackground:true});});
    await window.loadURL(runtime.origin);window.show();log('frontend-ready');
    if(diagnostic) {
      const result=await require('./diagnostics').run(window);
      fs.writeFileSync(path.join(paths.logs,'diagnostic.json'),JSON.stringify(result,null,2));
      console.log('DIAGNOSTIC '+paths.root);app.quit();
    }
  }).catch(err=>{log?.('startup-failed',err);if(diagnostic){console.log('DIAGNOSTIC_FAILED '+err.name+' '+(err.code||''));app.exit(1);return;}dialog.showErrorBox('SR Mobile POS could not start','Unable to start the local database or application. Your data has been retained. Please contact support with the desktop log.');app.quit();});
}
