const router=require('express').Router();
const bcrypt=require('bcryptjs'); const jwt=require('jsonwebtoken'); const auth=require('../middleware/auth');
let settingUp=false; const attempts=new Map();
router.get('/setup-status',(req,res)=>res.json({required:process.env.DESKTOP_MODE==='1'&&!req.app.locals.desktop.settings.value.admin}));
router.post('/setup',async(req,res)=>{
  const config=req.app.locals.desktop.settings;
  if(process.env.DESKTOP_MODE!=='1'||config.value.admin||settingUp) return res.status(409).json({error:'Administrator is already configured'});
  const {email,password}=req.body;
  if(typeof email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72) return res.status(400).json({error:'Enter an email and a password of at least 12 characters (maximum 72 UTF-8 bytes).'});
  settingUp=true;
  try {const hash=await bcrypt.hash(password,12);config.save({...config.value,admin:{email:email.trim().toLowerCase(),hash}});res.status(201).json({configured:true});}
  catch {res.status(500).json({error:'Administrator setup failed'});} finally {settingUp=false;}
});
router.post('/login',async(req,res)=>{
  const key=req.ip; const now=Date.now(); const entry=attempts.get(key);
  if(entry&&entry.until>now&&entry.count>=10)return res.status(429).json({error:'Too many attempts. Wait 15 minutes.'});
  if(!entry||entry.until<=now)attempts.set(key,{count:0,until:now+900000});
  try {
    const {email,password}=req.body;
    if(typeof email!=='string'||typeof password!=='string'||Buffer.byteLength(password)>72)return res.status(400).json({error:'Email and password required'});
    const local=process.env.DESKTOP_MODE==='1'?req.app.locals.desktop.settings.value.admin:null;
    const adminEmail=local?.email||process.env.ADMIN_EMAIL;const hash=local?.hash||process.env.ADMIN_PASSWORD;
    attempts.get(key).count++;
    if(!hash||email.trim().toLowerCase()!==adminEmail||!await bcrypt.compare(password,hash))return res.status(401).json({error:'Invalid credentials'});
    attempts.delete(key);
    res.json({token:jwt.sign({email:adminEmail,role:'admin'},process.env.JWT_SECRET,{expiresIn:'12h',algorithm:'HS256'})});
  } catch {res.status(500).json({error:'Unable to sign in'});}
});
router.post('/logout',(req,res)=>res.json({message:'Logged out'}));
router.get('/me',auth,(req,res)=>res.json({email:req.admin.email,role:req.admin.role}));
module.exports=router;
