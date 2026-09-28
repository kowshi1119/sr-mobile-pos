// Shared helpers for desktop QA runs that use REAL Windows mouse/keyboard input (os-input.ps1),
// so typing is proven through the same path as a physical keyboard, never by assigning input.value.
const {spawn}=require('child_process');const path=require('path');const {screen}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VK={BACK:8,TAB:9,ENTER:13,ESC:27,SPACE:32,END:35,HOME:36,LEFT:37,UP:38,RIGHT:39,DOWN:40,DELETE:46,A:65,C:67,V:86,F4:115,F12:123};

class OsInput {
  constructor(){
    this.ps=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'os-input.ps1')],{stdio:['pipe','pipe','inherit'],windowsHide:true});
    this.buf='';this.waiters=[];
    this.ps.stdout.on('data',d=>{this.buf+=d;let i;while((i=this.buf.indexOf('\n'))>=0){const line=this.buf.slice(0,i).trim();this.buf=this.buf.slice(i+1);if(line)this.waiters.shift()?.(line);}});
  }
  cmd(line){return new Promise((resolve,reject)=>{this.waiters.push(r=>r.startsWith('ok')?resolve(r):reject(Error(line.split(' ')[0]+': '+r)));this.ps.stdin.write(line+'\n');});}
  close(){this.ps.stdin.end();}
}

// Real input events injected into Chromium's input pipeline (hit-testing, focus, key handling).
// Used when the Windows desktop is locked; it cannot reproduce Win32-level bugs such as the
// Electron alert()/confirm() WM_CHAR issue, which needs QA_INPUT=os on an unlocked desktop.
const KEYCODE={8:'Backspace',9:'Tab',13:'Enter',27:'Escape',32:'Space',35:'End',36:'Home',37:'Left',38:'Up',39:'Right',40:'Down',46:'Delete',65:'A',67:'C',86:'V',115:'F4',123:'F12'};
class ChromiumInput {
  constructor(win){this.win=win;}
  async cmd(line){
    const p=line.split(' ');const wc=this.win.webContents;
    if(p[0]==='target'||p[0]==='activate')return 'ok';
    if(p[0]==='fg')return 'ok '+this.win.isFocused();
    if(p[0]==='wheel'){wc.focus();wc.sendInputEvent({type:'mouseWheel',x:+p[1],y:+p[2],deltaX:0,deltaY:+p[3],canScroll:true});return 'ok';}
    if(p[0]==='dblclick'){const x=+p[1],y=+p[2];wc.focus();wc.sendInputEvent({type:'mouseMove',x,y});for(const clickCount of [1,2]){wc.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount});wc.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount});}return 'ok';}
    if(p[0]==='click'){const x=+p[1],y=+p[2];wc.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])wc.sendInputEvent({type,x,y,button:'left',clickCount:1});return 'ok';}
    if(p[0]==='text'){wc.focus();for(const ch of Buffer.from(p[1],'base64').toString('utf8')){wc.sendInputEvent({type:'keyDown',keyCode:ch});wc.sendInputEvent({type:'char',keyCode:ch});wc.sendInputEvent({type:'keyUp',keyCode:ch});await sleep(8);}return 'ok';}
    if(p[0]==='key'){wc.focus();const keyCode=KEYCODE[p[1]];const modifiers=p.slice(2).map(m=>m==='ctrl'?'control':m);wc.sendInputEvent({type:'keyDown',keyCode,modifiers});if(!modifiers.includes('control')&&(keyCode.length===1||keyCode==='Space'||keyCode==='Enter'))wc.sendInputEvent({type:'char',keyCode:keyCode==='Space'?' ':keyCode==='Enter'?String.fromCharCode(13):keyCode.toLowerCase(),modifiers});wc.sendInputEvent({type:'keyUp',keyCode,modifiers});return 'ok';}
    throw Error('unknown '+p[0]);
  }
  close(){}
}

// Page-side locator: finds an element by placeholder, label text, button text or CSS selector.
const LOCATOR=`window.__find=function(d){
  const vis=e=>e&&e.getClientRects().length>0;
  if(d.css)return [...document.querySelectorAll(d.css)].find(vis)||null;
  if(d.placeholder)return [...document.querySelectorAll('input,textarea')].find(e=>vis(e)&&(e.placeholder||'').startsWith(d.placeholder))||null;
  if(d.label){const l=[...document.querySelectorAll('label')].find(x=>vis(x)&&x.textContent.trim().toLowerCase().startsWith(d.label.toLowerCase()));return l?(l.control||l.parentElement.querySelector('input,select,textarea')):null;}
  if(d.button){const all=[...document.querySelectorAll('button')].filter(b=>vis(b)&&b.textContent.trim().includes(d.button));return d.last?all[all.length-1]:all[0]||null;}
  return null;
};true`;

class Driver {
  constructor(win){this.win=win;this.mode=process.env.QA_INPUT==='os'?'os':'chromium';this.os=this.mode==='os'?new OsInput():new ChromiumInput(win);}
  js(code){return this.win.webContents.executeJavaScript(code);}
  async start(){
    this.win.setAlwaysOnTop(true,'screen-saver');this.win.show();this.win.focus();
    const hwnd=this.win.getNativeWindowHandle().readBigUInt64LE(0);await this.os.cmd('target '+hwnd);await this.inject();
  }
  inject(){return this.js(LOCATOR);}
  async go(route){await this.win.loadURL(new URL(route,this.win.webContents.getURL()).href);await sleep(800);await this.inject();}
  async resize(w,h){this.win.setContentSize(w,h);this.win.center();await sleep(500);}
  // Centre of an element in physical screen pixels, plus what is actually on top at that point.
  async locate(d){
    const r=await this.js(`(()=>{const e=__find(${JSON.stringify(d)});if(!e)return null;if(${JSON.stringify(!!d.scroll)})e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();const x=b.left+b.width/2,y=b.top+b.height/2;const top=document.elementFromPoint(x,y);const hit=top===e||e.contains(top);const describe=n=>n?(n.tagName.toLowerCase()+(n.textContent||'').trim().slice(0,30).replace(/\\s+/g,' ')):'none';return {x,y,hit,onTop:hit?'target':describe(top.closest('button,a,div[style]')||top)};})()`);
    if(!r)throw Error('Element not found: '+JSON.stringify(d));
    const cb=this.win.getContentBounds();const scale=screen.getDisplayMatching(cb).scaleFactor;
    if(this.mode!=='os')return {...r,sx:Math.round(r.x),sy:Math.round(r.y)};
    return {...r,sx:Math.round((cb.x+r.x)*scale),sy:Math.round((cb.y+r.y)*scale)};
  }
  // Like a user: if the field is scrolled out of its panel, turn the mouse wheel over that panel until it shows.
  async reveal(d){
    for(let i=0;i<15;i++){
      const v=await this.js(`(()=>{const e=__find(${JSON.stringify(d)});if(!e)return null;const b=e.getBoundingClientRect();let p=e.parentElement;
        while(p&&p!==document.body){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowY)){const r=p.getBoundingClientRect();
          if(b.top<r.top||b.bottom>r.bottom)return {dir:b.bottom>r.bottom?1:-1,x:r.left+r.width/2,y:r.top+r.height/2};}p=p.parentElement;}
        if(b.top<0||b.bottom>innerHeight)return {dir:b.bottom>innerHeight?1:-1,x:b.left+b.width/2,y:innerHeight/2};return 'visible'})()`);
      if(v==='visible'||v===null)return v;
      const cb=this.win.getContentBounds();const scale=this.mode==='os'?screen.getDisplayMatching(cb).scaleFactor:1;
      const x=this.mode==='os'?Math.round((cb.x+v.x)*scale):Math.round(v.x),y=this.mode==='os'?Math.round((cb.y+v.y)*scale):Math.round(v.y);
      await this.os.cmd(`wheel ${x} ${y} ${v.dir>0?-120:120}`);await sleep(150);
    }
    return 'still hidden';
  }
  async dblclick(d){await this.reveal(d);const p=await this.locate(d);await this.os.cmd(`dblclick ${p.sx} ${p.sy}`);await sleep(250);return p;}
  async click(d){const revealed=await this.reveal(d);const p=await this.locate(d);p.revealed=revealed;await this.os.cmd(`click ${p.sx} ${p.sy}`);await sleep(250);return p;}
  async type(text){await this.os.cmd('text '+Buffer.from(text,'utf8').toString('base64'));await sleep(150);}
  async key(vk,...mods){await this.os.cmd(['key',vk,...mods].join(' '));await sleep(120);}
  value(d){return this.js(`(()=>{const e=__find(${JSON.stringify(d)});return e?e.value:null})()`);}
  active(){return this.js(`(()=>{const e=document.activeElement;return e?(e.tagName+'|'+(e.placeholder||e.name||e.id||'')):null})()`);}
  text(){return this.js('document.body.innerText');}
  async waitFor(check,label,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){if(await this.js(check))return true;await sleep(150);}throw Error('Timed out waiting for '+label);}
  // Click a field and type into it with real keys; report what the field ended up containing.
  async clickAndType(d,text){
    const p=await this.click(d);
    await this.key(VK.A,'ctrl');await this.key(VK.BACK);await this.type(text);
    const value=await this.value(d);
    return {field:d.placeholder||d.label||d.css,clickLandedOnField:p.hit,elementOnTop:p.onTop,typed:text,value,ok:value===text};
  }
  close(){this.os.close();this.win.setAlwaysOnTop(false);}
}
module.exports={Driver,VK,sleep};
