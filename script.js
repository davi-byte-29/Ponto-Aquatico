'use strict';
const $=i=>document.getElementById(i),cv=$('c'),x=cv.getContext('2d');
// Física SEMPRE em coordenadas da arena (480x520), independente da tela de cada dispositivo
const PW=480,PH=520,GH=30,RL=16,BR=34,WIN=5,CD=.7,MAXA=1.2,FONT="'Orbitron','Segoe UI',sans-serif";
// s:1 = jogador de baixo (atira p/ cima) | s:0 = jogador de cima (atira p/ baixo)
const P=[
{n:'Amarelo',c:'#ffc400',d:'#a67c00',s:1,fx:.3},
{n:'Ciano',c:'#00e5ff',d:'#007c8c',s:0,fx:.3},
{n:'Vermelho',c:'#ff3d6e',d:'#9c1236',s:1,fx:.7},
{n:'Verde',c:'#39ff88',d:'#12944a',s:0,fx:.7}];
const ICE={config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},{urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}]}};
let G=null,mode='',me=-1,peer=null,conn=null,conns=[],slots=[],map=[],code='',lastT=0,acc=0,parts=[],cw=0,ch=0,dpr=1,bg=null,lastSend=0;
const V={s:1,L:false,m:{a:1,b:0,c:0,d:1,e:0,f:0}};

/* ---------- layout responsivo: em tela larga a arena gira 90° ---------- */
function resize(){dpr=Math.min(devicePixelRatio||1,2);cw=innerWidth;ch=innerHeight;cv.width=cw*dpr;cv.height=ch*dpr;
 const L=cw/ch>1.05,s=L?Math.min(cw/800,ch/540):Math.min(cw/540,ch/800);V.s=s;V.L=L;
 V.m=L?{a:0,b:-s,c:s,d:0,e:cw/2-260*s,f:ch/2+240*s}:{a:s,b:0,c:0,d:s,e:cw/2-240*s,f:ch/2-260*s};
 bg=document.createElement('canvas');bg.width=cw*dpr;bg.height=ch*dpr;const b=bg.getContext('2d');b.scale(dpr,dpr);
 const g=b.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*.7);g.addColorStop(0,'#0b2142');g.addColorStop(1,'#030712');b.fillStyle=g;b.fillRect(0,0,cw,ch);
 b.strokeStyle='rgba(0,229,255,.06)';for(let i=0;i<cw;i+=40){b.beginPath();b.moveTo(i,0);b.lineTo(i,ch);b.stroke()}for(let j=0;j<ch;j+=40){b.beginPath();b.moveTo(0,j);b.lineTo(cw,j);b.stroke()}}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,250));if(window.visualViewport)visualViewport.addEventListener('resize',resize);resize();
const sp=(ax,ay)=>{const m=V.m;return{x:m.a*ax+m.c*ay+m.e,y:m.b*ax+m.d*ay+m.f}};
const toArena=e=>{const m=V.m,px=e.clientX-m.e,py=e.clientY-m.f,det=m.a*m.d-m.b*m.c;return{x:(m.d*px-m.c*py)/det,y:(-m.b*px+m.a*py)/det}};

/* ---------- lógica ---------- */
const dpos=i=>({x:P[i].fx*PW,y:P[i].s?PH+85:-85});
const dirv=(i,a)=>({x:Math.sin(a),y:Math.cos(a)*(P[i].s?-1:1)});
const clampA=a=>Math.max(-MAXA,Math.min(MAXA,a));
function burst(a,b,c,n){for(let i=0;i<n;i++){const r=Math.random()*6.28,v=60+Math.random()*240;parts.push({x:a,y:b,vx:Math.cos(r)*v,vy:Math.sin(r)*v,l:.5+Math.random()*.5,c})}}
function newGame(n){G={n,sc:Array(n).fill(0),cd:Array(n).fill(0),aim:Array(n).fill(0),t:0,sh:[],ev:[],b:{x:PW/2,y:PH/2,vx:0,vy:0,r:0},last:-1,ph:'play',pt:0,win:-1,fl:'',tint:[-1,-1]};parts=[];$('end').classList.remove('show')}
function reset(){const g=G;g.b.x=PW/2;g.b.y=PH/2;g.b.vx=g.b.vy=0;g.sh=[];g.tint=[-1,-1];g.last=-1;g.ph='play';g.fl=''}
function fire(i){if(!G||G.ph!=='play'||i<0||i>=G.n||G.cd[i]>0)return;G.cd[i]=CD;const p=dpos(i),d=dirv(i,G.aim[i]);G.sh.push({x:p.x+d.x*52,y:p.y+d.y*52,vx:d.x*1000,vy:d.y*1000,o:i})}
function goal(top){const g=G,o=g.last,ok=o>=0&&P[o].s===(top?1:0);g.ph='goal';g.pt=1.3;const c=Math.max(o,0),gy=top?GH/2:PH-GH/2;
 g.ev.push([g.b.x|0,gy,c,40]);burst(g.b.x,gy,P[c].c,40);
 if(ok){g.sc[o]++;g.fl='Ponto do '+P[o].n+'!';if(g.sc[o]>=WIN){g.ph='end';g.win=o}}else g.fl='Gol contra!'}
function step(dt){const g=G,b=g.b;g.t+=dt;g.cd=g.cd.map(v=>Math.max(0,v-dt));
 if(g.ph!=='play'){if(g.ph==='goal'&&(g.pt-=dt)<=0)reset();return}
 for(const s of g.sh){s.x+=s.vx*dt;s.y+=s.vy*dt;const dx=b.x-s.x,dy=b.y-s.y,dist=Math.hypot(dx,dy);
  if(dist<BR+10){const m=Math.hypot(s.vx,s.vy),px=s.vx/m*.7+dx/dist*.3,py=s.vy/m*.7+dy/dist*.3,l=Math.hypot(px,py);
   b.vx+=px/l*300;b.vy+=py/l*300;const sp2=Math.hypot(b.vx,b.vy);if(sp2>520){b.vx*=520/sp2;b.vy*=520/sp2}
   g.last=s.o;g.tint[P[s.o].s?0:1]=s.o;s.dead=1;g.ev.push([s.x|0,s.y|0,s.o,16]);burst(s.x,s.y,P[s.o].c,16)}}
 g.sh=g.sh.filter(s=>!s.dead&&s.x>RL&&s.x<PW-RL&&s.y>-250&&s.y<PH+250);
 b.x+=b.vx*dt;b.y+=b.vy*dt;const f=Math.pow(.35,dt);b.vx*=f;b.vy*=f;b.r+=b.vx*dt*.02;
 const l=RL+BR,r=PW-RL-BR;if(b.x<l){b.x=l;b.vx=Math.abs(b.vx)*.9}if(b.x>r){b.x=r;b.vx=-Math.abs(b.vx)*.9}
 if(b.y<GH+8)goal(true);else if(b.y>PH-GH-8)goal(false)}
// convidado: só prevê o movimento entre um snapshot e outro
function ext(dt){const b=G.b,f=Math.pow(.35,dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=f;b.vy*=f;b.r+=b.vx*dt*.02;G.sh.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt})}

/* ---------- rede: estado ---------- */
const snap=()=>({t:'s',n:G.n,sc:G.sc,cd:G.cd,am:G.aim.map(v=>+v.toFixed(2)),tm:G.t,sh:G.sh.map(s=>[s.x|0,s.y|0,s.o,s.vx|0,s.vy|0]),b:[G.b.x|0,G.b.y|0,G.b.r,G.b.vx|0,G.b.vy|0],ph:G.ph,win:G.win,fl:G.fl,tint:G.tint,ev:G.ev.splice(0)});
function apply(d){if(!G||G.n!==d.n)newGame(d.n);const b=G.b,mine=G.aim[me];Object.assign(G,{sc:d.sc,cd:d.cd,t:d.tm,ph:d.ph,win:d.win,fl:d.fl,tint:d.tint,aim:d.am.slice(),sh:d.sh.map(a=>({x:a[0],y:a[1],o:a[2],vx:a[3],vy:a[4]}))});
 if(me>=0&&mine!==undefined)G.aim[me]=mine;b.x=d.b[0];b.y=d.b[1];b.r=d.b[2];b.vx=d.b[3];b.vy=d.b[4];d.ev.forEach(e=>burst(e[0],e[1],P[e[2]].c,e[3]))}

/* ---------- desenho ---------- */
const rr=(a,b,w,h,r)=>{x.beginPath();x.roundRect(a,b,w,h,r)};
const dot=(a,b,r)=>{x.beginPath();x.arc(a,b,r,0,7)};
const ln=(a,b,c,d)=>{x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke()};
function draw(){const g=G,t=g.t,m=V.m,k=Math.max(.75,Math.min(1.5,V.s));x.setTransform(dpr,0,0,dpr,0,0);x.textAlign='center';x.textBaseline='middle';x.drawImage(bg,0,0,cw,ch);
 for(let i=0;i<g.n;i++){const p=dpos(i),q=sp(p.x,p.y),gr=x.createRadialGradient(q.x,q.y,0,q.x,q.y,V.s*300);gr.addColorStop(0,P[i].c+'44');gr.addColorStop(1,P[i].c+'00');x.fillStyle=gr;x.fillRect(0,0,cw,ch)}
 x.save();x.transform(m.a,m.b,m.c,m.d,m.e,m.f);
 // piscina holográfica
 x.shadowColor='#00e5ff';x.shadowBlur=30;x.fillStyle='#021428';rr(-12,-12,PW+24,PH+24,16);x.fill();x.shadowBlur=0;x.strokeStyle='#00e5ff';x.lineWidth=3;x.stroke();
 const wg=x.createLinearGradient(0,0,0,PH);wg.addColorStop(0,'#08335e');wg.addColorStop(1,'#04213f');x.fillStyle=wg;x.fillRect(0,0,PW,PH);
 x.save();x.beginPath();x.rect(0,0,PW,PH);x.clip();
 x.strokeStyle='rgba(0,229,255,.07)';x.lineWidth=1;for(let i=0;i<=PW;i+=40)ln(i,0,i,PH);for(let j=0;j<=PH;j+=40)ln(0,j,PW,j);
 x.strokeStyle='rgba(120,230,255,.13)';x.lineWidth=2;for(let q=0;q<8;q++){x.beginPath();for(let px=0;px<=PW;px+=16){const yy=q*70+20+Math.sin(px*.03+t*1.5+q)*6;px?x.lineTo(px,yy):x.moveTo(px,yy)}x.stroke()}
 x.strokeStyle='rgba(0,229,255,.25)';x.setLineDash([10,10]);ln(0,PH/2,PW,PH/2);x.setLineDash([]);dot(PW/2,PH/2,60);x.stroke();x.restore();
 x.fillStyle='rgba(0,229,255,.18)';x.fillRect(0,0,RL,PH);x.fillRect(PW-RL,0,RL,PH);x.strokeStyle='#00e5ff';x.lineWidth=2;x.shadowColor='#00e5ff';x.shadowBlur=10;ln(RL,0,RL,PH);ln(PW-RL,0,PW-RL,PH);x.shadowBlur=0;
 [0,1].forEach(q=>{const y0=q?PH-GH:0,tn=g.tint[q],c=tn>=0?P[tn].c:'#00e5ff',off=(t*40)%24;x.save();x.beginPath();x.rect(0,y0,PW,GH);x.clip();x.fillStyle='rgba(2,10,24,.9)';x.fillRect(0,y0,PW,GH);
  x.fillStyle=c+(tn>=0?'cc':'44');for(let i=-3;i<PW/24+3;i++){const a=i*24+off;x.beginPath();x.moveTo(a,y0);x.lineTo(a+12,y0);x.lineTo(a+12-GH,y0+GH);x.lineTo(a-GH,y0+GH);x.fill()}x.restore();
  x.strokeStyle=c;x.lineWidth=3;x.shadowColor=c;x.shadowBlur=14;ln(0,q?y0:y0+GH,PW,q?y0:y0+GH);x.shadowBlur=0});
 // bola (orbe de energia)
 const b=g.b;for(let q=4;q>=1;q--){x.globalAlpha=.07*(5-q);x.fillStyle='#7df9ff';dot(b.x-b.vx*q*.018,b.y-b.vy*q*.018,BR*(1-q*.08));x.fill()}x.globalAlpha=1;
 x.save();x.translate(b.x,b.y);x.shadowColor='#00e5ff';x.shadowBlur=28;const bg2=x.createRadialGradient(-10,-10,3,0,0,BR);bg2.addColorStop(0,'#fff');bg2.addColorStop(.45,'#5af0ff');bg2.addColorStop(1,'#0a6fa8');x.fillStyle=bg2;dot(0,0,BR);x.fill();x.shadowBlur=0;
 x.rotate(b.r);x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=2.5;for(let i=0;i<3;i++){x.beginPath();x.arc(0,0,BR-7,i*2.094,i*2.094+1.2);x.stroke()}x.strokeStyle='#e6ffff';dot(0,0,BR);x.stroke();x.restore();
 // tiros de plasma
 x.lineCap='round';g.sh.forEach(s=>{const mm=Math.hypot(s.vx,s.vy)||1,ux=s.vx/mm,uy=s.vy/mm,c=P[s.o].c,tg=x.createLinearGradient(s.x,s.y,s.x-ux*80,s.y-uy*80);tg.addColorStop(0,c);tg.addColorStop(1,c+'00');
  x.strokeStyle=tg;x.lineWidth=10;ln(s.x,s.y,s.x-ux*80,s.y-uy*80);x.shadowColor=c;x.shadowBlur=18;x.fillStyle='#fff';dot(s.x,s.y,8);x.fill();x.shadowBlur=0;x.strokeStyle=c;x.lineWidth=3;dot(s.x,s.y,8);x.stroke()});
 // torres
 for(let i=0;i<g.n;i++){const p=dpos(i),d=dirv(i,g.aim[i]),c=P[i].c,mine=i===me||mode==='local',cd=g.cd[i]/CD;
  x.setLineDash([3,12]);x.strokeStyle=c+(mine?'cc':'66');x.lineWidth=4;ln(p.x+d.x*64,p.y+d.y*64,p.x+d.x*(mine?260:170),p.y+d.y*(mine?260:170));x.setLineDash([]);
  x.shadowColor=c;x.shadowBlur=16;x.fillStyle='#06182e';x.strokeStyle=c;x.lineWidth=3;x.beginPath();for(let q=0;q<6;q++){const a=q*1.047+.52;q?x.lineTo(p.x+Math.cos(a)*36,p.y+Math.sin(a)*36):x.moveTo(p.x+Math.cos(a)*36,p.y+Math.sin(a)*36)}x.closePath();x.fill();x.stroke();
  x.lineWidth=16;ln(p.x,p.y,p.x+d.x*46,p.y+d.y*46);x.shadowBlur=0;x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=5;ln(p.x,p.y,p.x+d.x*44,p.y+d.y*44);
  x.fillStyle=c;x.strokeStyle='#06182e';x.lineWidth=3;dot(p.x,p.y,14);x.fill();x.stroke();
  if(cd>0){x.strokeStyle='#fff';x.lineWidth=5;x.beginPath();x.arc(p.x,p.y,48,-1.57,-1.57+6.283*(1-cd));x.stroke()}
  else if(g.ph==='play'){x.globalAlpha=.4+.3*Math.sin(t*6);x.strokeStyle=c;x.lineWidth=3;dot(p.x,p.y,48);x.stroke();x.globalAlpha=1}}
 parts.forEach(q=>{x.globalAlpha=Math.min(1,q.l*2);x.fillStyle=q.c;dot(q.x,q.y,3.5);x.fill()});x.globalAlpha=1;
 x.restore();
 // placares (sempre de pé na tela)
 for(let i=0;i<g.n;i++){const p=dpos(i),q=sp(p.x+(P[i].fx<.5?-92:92),p.y);x.save();x.translate(q.x,q.y);x.scale(k,k);
  x.fillStyle='rgba(4,12,28,.92)';x.strokeStyle=P[i].c;x.lineWidth=2;x.shadowColor=P[i].c;x.shadowBlur=12;rr(-34,-20,68,40,20);x.fill();x.stroke();x.shadowBlur=0;
  x.fillStyle=P[i].c;x.font='900 24px '+FONT;x.fillText(g.sc[i],0,2);if(mode&&mode!=='local'&&i===me){x.font='700 10px '+FONT;x.fillText('VOCÊ',0,32)}x.restore()}
 const cc=sp(PW/2,PH/2);
 if(g.fl&&(g.ph==='goal'||g.ph==='end')){x.font='900 '+Math.round(34*V.s)+'px '+FONT;x.lineWidth=7;x.strokeStyle='#020a18';x.lineJoin='round';x.shadowColor='#00e5ff';x.shadowBlur=20;x.fillStyle='#fff';x.strokeText(g.fl,cc.x,cc.y);x.fillText(g.fl,cc.x,cc.y);x.shadowBlur=0}
 if(t<6&&g.ph==='play'){const q=sp(PW/2,PH/2+130);x.globalAlpha=Math.min(1,(6-t)/1.5);x.fillStyle='#fff';x.shadowColor='#00e5ff';x.shadowBlur=12;x.font='700 '+Math.round(15*k)+'px '+FONT;x.fillText('ARRASTE PARA MIRAR',q.x,q.y);x.fillText('SOLTE PARA ATIRAR',q.x,q.y+22*k);x.shadowBlur=0;x.globalAlpha=1}
 x.strokeStyle='rgba(0,229,255,.6)';x.lineWidth=1.5;x.fillStyle='rgba(4,12,28,.8)';rr(10,10,68,28,14);x.fill();x.stroke();x.fillStyle='#00e5ff';x.font='700 11px '+FONT;x.fillText('SAIR',44,25)}

/* ---------- laço principal ---------- */
function loop(ts){const dt=Math.min(.05,(ts-lastT)/1000||0);lastT=ts;
 parts=parts.filter(q=>(q.l-=dt)>0);parts.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96});
 if(G){if(mode!=='local')keyAim(dt);
  if(mode==='guest'){G.t+=dt;G.cd=G.cd.map(v=>Math.max(0,v-dt));if(G.ph==='play')ext(dt)}
  else{step(dt);if(mode==='host'&&(acc+=dt)>=.033){acc=0;const s=snap();conns.forEach(c=>c&&c.open&&c.send(s))}else if(mode!=='host')G.ev.length=0}
  draw();const e=G.ph==='end';if(e){$('et').textContent=P[G.win].n+' venceu!';$('again').style.display=mode==='guest'?'none':''}$('end').classList.toggle('show',e)}
 else{x.setTransform(dpr,0,0,dpr,0,0);x.drawImage(bg,0,0,cw,ch)}
 requestAnimationFrame(loop)}
requestAnimationFrame(loop);

/* ---------- controles: arrastar para mirar, soltar para atirar ---------- */
const act=new Map(),keys={};
function setAim(i,a){a=clampA(a);G.aim[i]=a;if(mode==='guest'&&i===me){const n=performance.now();if(n-lastSend>40&&conn&&conn.open){lastSend=n;conn.send({t:'a',a:+a.toFixed(3)})}}}
function shoot(i){if(!G||G.ph!=='play')return;if(mode==='guest'){if(G.cd[me]>0||!conn||!conn.open)return;conn.send({t:'fire',a:+G.aim[me].toFixed(3)});G.cd[me]=CD}else fire(i)}
function aimAt(i,e){const p=toArena(e),t=dpos(i);return Math.atan2(p.x-t.x,P[i].s?t.y-p.y:p.y-t.y)}
function who(e){if(mode!=='local')return me;const p=toArena(e),s=p.y>PH/2?1:0;let best=-1,bd=1e9;for(let i=0;i<G.n;i++)if(P[i].s===s){const d=Math.abs(dpos(i).x-p.x);if(d<bd){bd=d;best=i}}return best}
cv.addEventListener('pointerdown',e=>{if(!G)return;e.preventDefault();if(e.clientX<90&&e.clientY<50){leave();return}
 const i=who(e);if(i<0)return;act.set(e.pointerId,i);try{cv.setPointerCapture(e.pointerId)}catch(_){}setAim(i,aimAt(i,e))});
cv.addEventListener('pointermove',e=>{if(!G)return;const i=act.get(e.pointerId);if(i!==undefined)setAim(i,aimAt(i,e));else if(e.pointerType==='mouse'&&mode!=='local'&&me>=0)setAim(me,aimAt(me,e))});
const up=e=>{const i=act.get(e.pointerId);if(i===undefined)return;act.delete(e.pointerId);if(G&&e.type==='pointerup')shoot(i)};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
// teclado (online): setas giram a torre, Espaço/Enter atira
addEventListener('keydown',e=>{keys[e.code]=1;if(G&&mode!=='local'&&!e.repeat&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();shoot(me)}});
addEventListener('keyup',e=>{keys[e.code]=0});
function keyAim(dt){if(me<0||!G)return;const m=V.m,h=(keys.ArrowRight|0)-(keys.ArrowLeft|0),v=(keys.ArrowDown|0)-(keys.ArrowUp|0),dd=h*Math.sign(m.a)+v*Math.sign(m.b);if(dd)setAim(me,G.aim[me]+dd*1.6*dt)}

/* ---------- menus ---------- */
const ovs=document.querySelectorAll('.ov'),msg=t=>$('om').textContent=t;
const show=id=>ovs.forEach(o=>o.classList.toggle('show',o.id===id));
function cleanup(){try{peer&&peer.destroy()}catch(e){}peer=conn=null;conns=[];slots=[];G=null;mode='';me=-1;parts=[];act.clear();$('end').classList.remove('show')}
function leave(m){cleanup();show(m?'online':'menu');msg(m||'')}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='menu')leave();else show(b.dataset.go)});
document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{cleanup();mode='local';newGame(+b.dataset.n);show('')});
$('bm').onclick=()=>leave();
$('again').onclick=()=>mode==='host'?startNet():newGame(G.n);
const h0=location.hash.slice(1).toUpperCase();if(/^[A-Z]{4}$/.test(h0)){$('code').value=h0;show('online')}

/* ---------- online (salas via PeerJS, funciona entre PC e celular) ---------- */
function lobby(){show('lobby');$('rc').textContent=code;const n=slots.filter(Boolean).length;
 $('pl').innerHTML=slots.map((v,i)=>`<li class="${v?'on':''}">${v?'Jogador '+(i+1)+(i?'':' (anfitrião)'):'Aguardando...'}</li>`).join('');
 $('st').style.display=mode==='host'?'':'none';$('st').disabled=n<2;
 $('lm').textContent=mode==='host'?'Mande o código ou o link para os amigos (2 a 4 jogadores).':'Aguardando o anfitrião iniciar...'}
function bl(){lobby();conns.forEach(c=>c&&c.open&&c.send({t:'lobby',sl:slots}))}
function startNet(){const m=[-1,-1,-1,-1];let k=0;slots.forEach((v,s)=>{if(v)m[s]=k++});if(k<2){G=null;bl();return}
 map=m;me=0;newGame(k);show('');conns.forEach((c,s)=>c&&c.open&&c.send({t:'start',n:k,s:m[s]}))}
$('st').onclick=startNet;
$('cp').onclick=async()=>{const u=location.href.split('#')[0]+'#'+code;try{if(navigator.share)await navigator.share({title:'Ponto Aquático',text:'Entre na minha sala!',url:u});else{await navigator.clipboard.writeText(u);$('cp').textContent='Link copiado!'}}catch(e){if(e.name!=='AbortError')prompt('Copie o link:',u)}};
function startHost(){cleanup();if(typeof Peer==='undefined')return msg('Sem conexão com o serviço online.');
 code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('');
 peer=new Peer('pa-'+code,ICE);
 peer.on('error',e=>{if(e.type==='unavailable-id')startHost();else leave('Erro de conexão. Tente de novo.')});
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});
 peer.on('open',()=>{mode='host';me=0;slots=[1,0,0,0];conns=[];$('cp').textContent='Copiar link de convite';bl()});
 peer.on('connection',c=>{const s=slots.indexOf(0);
  if(s<0||G){c.on('open',()=>{c.send({t:'full'});setTimeout(()=>c.close(),400)});return}
  slots[s]=1;conns[s]=c;
  c.on('open',()=>{c.send({t:'you',s});bl()});
  c.on('data',d=>{const i=map[s];if(!G||i===undefined||i<0)return;if(d.t==='a'||d.t==='fire'){G.aim[i]=clampA(+d.a||0);if(d.t==='fire')fire(i)}});
  c.on('close',()=>{slots[s]=0;conns[s]=null;if(!G)bl()})})}
function startGuest(c){cleanup();if(typeof Peer==='undefined')return msg('Sem conexão com o serviço online.');msg('Entrando...');
 peer=new Peer(ICE);
 peer.on('error',()=>{if(mode!=='guest')msg('Sala não encontrada ou sem conexão.')});
 peer.on('open',()=>{conn=peer.connect('pa-'+c,{reliable:true,serialization:'json'});
  conn.on('open',()=>{mode='guest';code=c});
  conn.on('data',onData);
  conn.on('close',()=>{if(mode==='guest')leave('A sala foi encerrada.')})})}
function onData(d){
 if(d.t==='lobby'){slots=d.sl;lobby()}
 else if(d.t==='start'){me=d.s;newGame(d.n);show('')}
 else if(d.t==='s'){apply(d)}
 else if(d.t==='full'){leave('Sala cheia ou partida em andamento.')}}
$('mk').onclick=()=>{msg('Criando sala...');startHost()};
$('jn').onclick=()=>{const c=$('code').value.trim().toUpperCase();if(c.length!==4)return msg('Digite o código de 4 letras.');startGuest(c)};
