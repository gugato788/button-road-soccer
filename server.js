// Button Road Soccer - servidor autoritativo (fase 1)
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const pf=path.join(__dirname,'public','index.html');const html=fs.readFileSync(fs.existsSync(pf)?pf:path.join(__dirname,'index.html'));
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html)});
const wss=new WebSocketServer({server:srv,maxPayload:2000000});
const rooms=new Map();let uid=1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const send=(w,o)=>{if(w&&w.readyState===1)w.send(JSON.stringify(o))};
const bc=(R,o)=>R.p.forEach(p=>send(p.ws,o));
const mkCode=()=>{let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms.has(c));return c};
const okImg=(v,max)=>typeof v==='string'&&v.length<=max&&v.startsWith('data:image/png;base64,iVBORw0KGgo')&&/^[A-Za-z0-9+\/=]+$/.test(v.slice(22));
const sync=(R,ws)=>{R.p.forEach(p=>p.skin&&send(ws,{t:'skin',id:p.id,img:p.skin}));if(R.field)send(ws,{t:'field',img:R.field})};
const DR=22,BR=11,MAXV=1100,CD=700,MATCH=180;
function mkRoom(size){const W=700+size*100,H=Math.round(W*0.55);
 return{code:mkCode(),size,W,H,gh:Math.round(H*0.3),p:new Map(),host:null,st:'lobby',sc:[0,0],t:MATCH,hold:0,n:0,
 ball:{x:W/2,y:H/2,vx:0,vy:0,r:BR,m:1,f:0.992}}}
const mem=(R,k)=>[...R.p.values()].filter(p=>p.team===k);
function spawn(R,p){const L=mem(R,p.team),i=L.indexOf(p),n=Math.max(L.length,1);
 const col=i%2,row=Math.floor(i/2),rows=Math.ceil(n/2);
 const x=p.team===0?R.W*(0.18+col*0.14):R.W*(0.82-col*0.14);
 p.d.x=x;p.d.y=R.H*(row+1)/(rows+1)+(col?R.H*0.04:0);p.d.vx=p.d.vy=0}
function layout(R){const b=R.ball;b.x=R.W/2;b.y=R.H/2;b.vx=b.vy=0;R.p.forEach(p=>spawn(R,p))}
function info(R){return{t:'room',code:R.code,W:R.W,H:R.H,gh:R.gh,size:R.size,host:R.host,st:R.st,
 p:[...R.p.values()].map(p=>({id:p.id,name:p.name,team:p.team,bot:p.bot||0}))}}
function coll(a,b){let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),m=a.r+b.r;
 if(d>=m||d===0)return;const nx=dx/d,ny=dy/d,im=1/a.m+1/b.m,o=m-d;
 a.x-=nx*o/a.m/im;a.y-=ny*o/a.m/im;b.x+=nx*o/b.m/im;b.y+=ny*o/b.m/im;
 const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn>=0)return;
 const j=-(1.8)*vn/im;a.vx-=j*nx/a.m;a.vy-=j*ny/a.m;b.vx+=j*nx/b.m;b.vy+=j*ny/b.m}
function move(R,o,dt,isBall){o.x+=o.vx*dt;o.y+=o.vy*dt;const f=Math.pow(o.f,dt*60);o.vx*=f;o.vy*=f;
 if(Math.hypot(o.vx,o.vy)<4){o.vx=o.vy=0}
 const g0=(R.H-R.gh)/2,g1=g0+R.gh,inG=o.y>g0+o.r&&o.y<g1-o.r;
 if(o.y<o.r){o.y=o.r;o.vy=Math.abs(o.vy)*0.8}if(o.y>R.H-o.r){o.y=R.H-o.r;o.vy=-Math.abs(o.vy)*0.8}
 if(isBall&&inG)return;
 if(o.x<o.r){o.x=o.r;o.vx=Math.abs(o.vx)*0.8}if(o.x>R.W-o.r){o.x=R.W-o.r;o.vx=-Math.abs(o.vx)*0.8}}

function applyShot(p,dx,dy,pw){const l=Math.hypot(dx,dy)||1;p.d.vx+=dx/l*pw*MAXV;p.d.vy+=dy/l*pw*MAXV;const s=Math.hypot(p.d.vx,p.d.vy);if(s>MAXV){p.d.vx*=MAXV/s;p.d.vy*=MAXV/s}}
function ai(R,dt){const all=[...R.p.values()],b=R.ball;
 all.forEach(p=>{if(!p.bot)return;p.ait=(p.ait||0)-dt;if(p.ait>0)return;p.ait=[0,1.1,0.7,0.45][p.bot]*(0.8+Math.random()*0.4);
  const gx=p.team===0?R.W:0,ox=p.team===0?0:R.W,dist=q=>Math.hypot(q.d.x-b.x,q.d.y-b.y),me=dist(p);
  const att=all.filter(q=>q.team===p.team).every(q=>q===p||dist(q)>=me);let tx,ty,full=0;
  if(att){const dxg=gx-b.x,dyg=R.H/2-b.y,l=Math.hypot(dxg,dyg)||1;tx=b.x-dxg/l*(DR+BR);ty=b.y-dyg/l*(DR+BR);
   if(Math.hypot(tx-p.d.x,ty-p.d.y)<60){tx=b.x;ty=b.y;full=1}}
  else{tx=ox+(b.x-ox)*0.25+(p.team?-40:40);ty=R.H/2+(b.y-R.H/2)*0.5}
  const dx=tx-p.d.x,dy=ty-p.d.y,l=Math.hypot(dx,dy);if(l<25)return;
  const a=Math.atan2(dy,dx)+[0,0.35,0.18,0.07][p.bot]*(Math.random()*2-1);
  const pw=full?[0,0.7,0.85,1][p.bot]:Math.min(l/450,1)*0.8+0.1;
  applyShot(p,Math.cos(a),Math.sin(a),pw)})}
function tick(R,dt){if(R.st!=='play')return;
 if(R.hold>0){R.hold-=dt;if(R.hold<=0)layout(R);return}
 ai(R,dt);const ds=[...R.p.values()].map(p=>p.d);
 ds.forEach(d=>move(R,d,dt,false));move(R,R.ball,dt,true);
 for(let k=0;k<2;k++){for(let i=0;i<ds.length;i++){for(let j=i+1;j<ds.length;j++)coll(ds[i],ds[j]);coll(ds[i],R.ball)}}
 const b=R.ball;let g=-1;if(b.x<0)g=1;else if(b.x>R.W)g=0;
 if(g>=0){R.sc[g]++;R.hold=1.5;b.vx=b.vy=0;bc(R,{t:'goal',team:g})}
 R.t-=dt;if(R.t<=0){R.t=0;R.st='over';bc(R,info(R))}}
function snap(R){return{t:'s',d:[...R.p.values()].map(p=>[Math.round(p.d.x*10)/10,Math.round(p.d.y*10)/10]),
 b:[Math.round(R.ball.x*10)/10,Math.round(R.ball.y*10)/10],sc:R.sc,tm:Math.ceil(R.t),st:R.st}}
setInterval(()=>{rooms.forEach(R=>{tick(R,1/60);R.n++;if(R.n%3===0&&R.p.size)bc(R,snap(R))})},1000/60);
function addP(R,ws,name){const L0=mem(R,0).length,L1=mem(R,1).length,team=L0<=L1?0:1;
 const p={id:uid++,ws,name:String(name||'Jogador').replace(/[<>]/g,'').slice(0,16)||'Jogador',team,last:0,skin:null,lastChat:0,
 d:{x:0,y:0,vx:0,vy:0,r:DR,m:3,f:0.985}};R.p.set(p.id,p);if(!R.host)R.host=p.id;
 ws.pid=p.id;ws.room=R;spawn(R,p);return p}
wss.on('connection',ws=>{
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}if(!m||typeof m!=='object')return;
  const R=ws.room;
  if(m.t==='ping')return send(ws,{t:'pong',ts:m.ts});
  if(m.t==='create'&&!R){const r=mkRoom(clamp(parseInt(m.size)||3,1,6));rooms.set(r.code,r);const p=addP(r,ws,m.name);send(ws,{t:'you',id:p.id});bc(r,info(r))}
  else if(m.t==='join'&&!R){const r=rooms.get(String(m.code||'').toUpperCase());
   if(!r)return send(ws,{t:'err',msg:'Sala não encontrada'});
   if(r.p.size>=r.size*2)return send(ws,{t:'err',msg:'Sala cheia'});
   const p=addP(r,ws,m.name);send(ws,{t:'you',id:p.id});sync(r,ws);bc(r,info(r))}
  else if(R&&m.t==='skin'){const p=R.p.get(ws.pid);if(p&&okImg(m.img,80000)){p.skin=m.img;bc(R,{t:'skin',id:p.id,img:p.skin})}}
  else if(R&&m.t==='field'&&ws.pid===R.host){if(m.img===null){R.field=null;bc(R,{t:'field',img:null})}else if(okImg(m.img,1600000)){R.field=m.img;bc(R,{t:'field',img:R.field})}}
  else if(R&&m.t==='chat'){const p=R.p.get(ws.pid),now=Date.now();if(!p||now-p.lastChat<1000)return;
   const msg=String(m.msg||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,120);if(!msg)return;p.lastChat=now;bc(R,{t:'chat',name:p.name,team:p.team,msg})}
  else if(R&&m.t==='start'&&ws.pid===R.host&&R.st!=='play'){R.p.forEach((q,k)=>{if(q.bot)R.p.delete(k)});const lv=clamp(parseInt(m.bots)||0,0,3);
   if(lv)for(let k=0;k<2;k++){let n=1;while(mem(R,k).length<R.size){const id=uid++;R.p.set(id,{id,ws:null,name:'Bot '+(k?'V':'A')+n++,team:k,bot:lv,last:0,d:{x:0,y:0,vx:0,vy:0,r:DR,m:3,f:0.985}})}}
   R.sc=[0,0];R.t=MATCH;R.hold=0;R.st='play';layout(R);bc(R,info(R))}
  else if(R&&m.t==='shoot'&&R.st==='play'&&R.hold<=0){const p=R.p.get(ws.pid),now=Date.now();
   if(!p||now-p.last<CD)return;const dx=+m.dx,dy=+m.dy,pw=clamp(+m.p||0,0,1),l=Math.hypot(dx,dy);
   if(!isFinite(l)||l<0.01||!isFinite(pw))return;p.last=now;
   p.d.vx+=dx/l*pw*MAXV;p.d.vy+=dy/l*pw*MAXV;const s=Math.hypot(p.d.vx,p.d.vy);
   if(s>MAXV){p.d.vx*=MAXV/s;p.d.vy*=MAXV/s}}});
 ws.on('close',()=>{const R=ws.room;if(!R)return;R.p.delete(ws.pid);
  const hs=[...R.p.values()].filter(q=>!q.bot);if(!hs.length){rooms.delete(R.code);return}
  if(R.host===ws.pid)R.host=hs[0].id;bc(R,info(R))})});
srv.listen(process.env.PORT||3000,()=>console.log('Button Road Soccer no ar'));
