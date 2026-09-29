const router=require('express').Router();
const bcrypt=require('bcryptjs'); const jwt=require('jsonwebtoken'); const crypto=require('crypto');
const auth=require('../middleware/auth'); const {toSessionUser,ENV_OWNER}=auth;
const {prisma}=require('../db');
const {validUsername,validPassword,OWNER_MIN,STAFF_MIN}=require('../utils/owner');
let settingUp=false; const attempts=new Map();
// Compared against when the username is unknown so response timing does not reveal valid usernames.
let dummy; const dummyHash=()=>dummy??=bcrypt.hash(crypto.randomUUID(),12);
const desktop=()=>process.env.DESKTOP_MODE==='1';
const sign=user=>jwt.sign({sub:user.id,role:user.role,tv:user.tokenVersion},process.env.JWT_SECRET,{expiresIn:'12h',algorithm:'HS256'});
async function ownerExists(){return !!await prisma.user.findFirst({where:{role:'OWNER',isActive:true},select:{id:true}});}

router.get('/setup-status',async(req,res,next)=>{
  try {res.json({required:desktop()&&!await ownerExists()});} catch(err){next(err);}
});
router.post('/setup',async(req,res)=>{
  const config=req.app.locals.desktop?.settings;
  if(!desktop()||settingUp) return res.status(409).json({error:'The owner account is already configured'});
  settingUp=true;
  try {
    if(await ownerExists()) return res.status(409).json({error:'The owner account is already configured'});
    const username=String(req.body.username??req.body.email??'').trim().toLowerCase();
    const displayName=String(req.body.displayName??'').trim().slice(0,60)||'Owner';
    const {password}=req.body;
    if(!validUsername(username)) return res.status(400).json({error:'Username must be 3-64 characters: letters, numbers, dot, dash, underscore or @.'});
    if(!validPassword(password,OWNER_MIN)) return res.status(400).json({error:`Password must be at least ${OWNER_MIN} characters (maximum 72 bytes).`});
    const hash=await bcrypt.hash(password,12);
    await prisma.user.create({data:{username,displayName,passwordHash:hash,role:'OWNER',permissions:'[]'}});
    const {admin,...rest}=config.value;
    config.save({...rest,owner:{username,displayName,hash}});
    res.status(201).json({configured:true});
  } catch(err) {
    if(err?.code==='P2002') return res.status(409).json({error:'That username is already taken'});
    res.locals.error=err;res.status(500).json({error:'Owner setup failed'});
  } finally {settingUp=false;}
});
router.post('/login',async(req,res)=>{
  const key=req.ip; const now=Date.now(); const entry=attempts.get(key);
  if(entry&&entry.until>now&&entry.count>=10)return res.status(429).json({error:'Too many attempts. Wait 15 minutes.'});
  if(!entry||entry.until<=now)attempts.set(key,{count:0,until:now+900000});
  try {
    const {password}=req.body; const login=req.body.username??req.body.email;
    if(typeof login!=='string'||!login.trim()||typeof password!=='string'||Buffer.byteLength(password)>72)return res.status(400).json({error:'Username and password required'});
    const username=login.trim().toLowerCase();
    attempts.get(key).count++;
    let user=null;
    try {user=await prisma.user.findUnique({where:{username}});}
    catch(err){if(desktop())throw err;} // Web deployments without the User table fall back to the environment owner.
    if(user) {
      if(!await bcrypt.compare(password,user.passwordHash))return res.status(401).json({error:'Invalid username or password'});
      if(!user.isActive)return res.status(401).json({error:'This account is disabled. Ask the owner.'});
      attempts.delete(key);
      const updated=await prisma.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
      return res.json({token:sign(updated),user:toSessionUser(updated)});
    }
    const envEmail=process.env.ADMIN_EMAIL?.trim().toLowerCase(); const envHash=process.env.ADMIN_PASSWORD;
    if(!desktop()&&envEmail&&envHash&&username===envEmail&&await bcrypt.compare(password,envHash)) {
      attempts.delete(key);
      return res.json({token:jwt.sign({sub:ENV_OWNER,username:envEmail,role:'OWNER'},process.env.JWT_SECRET,{expiresIn:'12h',algorithm:'HS256'})});
    }
    await bcrypt.compare(password,await dummyHash());
    res.status(401).json({error:'Invalid username or password'});
  } catch(err) {res.locals.error=err;res.status(500).json({error:'Unable to sign in'});}
});
router.post('/logout',(req,res)=>res.json({message:'Logged out'}));
router.get('/me',auth,(req,res)=>res.json({...req.user,email:req.user.username}));
router.post('/change-password',auth,async(req,res)=>{
  try {
    if(req.user.id===ENV_OWNER)return res.status(400).json({error:'Change the web administrator password in the server configuration.'});
    const {currentPassword,newPassword}=req.body;
    const user=await prisma.user.findUnique({where:{id:req.user.id}});
    const min=user.role==='OWNER'?OWNER_MIN:STAFF_MIN;
    if(typeof currentPassword!=='string'||!await bcrypt.compare(currentPassword,user.passwordHash))return res.status(400).json({error:'Current password is incorrect'});
    if(!validPassword(newPassword,min))return res.status(400).json({error:`New password must be at least ${min} characters (maximum 72 bytes).`});
    const hash=await bcrypt.hash(newPassword,12);
    const updated=await prisma.user.update({where:{id:user.id},data:{passwordHash:hash,tokenVersion:{increment:1}}});
    const config=req.app.locals.desktop?.settings;
    if(updated.role==='OWNER'&&config)config.save({...config.value,owner:{username:updated.username,displayName:updated.displayName,hash}});
    res.json({token:sign(updated),user:toSessionUser(updated)});
  } catch(err) {res.locals.error=err;res.status(500).json({error:'Unable to change password'});}
});
module.exports=router;
