'use strict';
const $=id=>document.getElementById(id), canvas=$('game');
const kids=[
{id:'blue',name:'Blue',price:0,body:'#70acd0',dark:'#30597e',light:'#d5eaf0'},
{id:'bingo',name:'Bingo',price:120,body:'#e8a65b',dark:'#ba733b',light:'#ffe4af'},
{id:'chloe',name:'Chloe',price:220,body:'#f2eee3',dark:'#444858',light:'#fff9ee',spots:true},
{id:'rusty',name:'Rusty',price:300,body:'#b85b43',dark:'#74382e',light:'#e8b280'},
{id:'mackenzie',name:'Mackenzie',price:380,body:'#464b56',dark:'#242b36',light:'#f4eee3'},
{id:'coco',name:'Coco',price:450,body:'#ec9bc0',dark:'#b76197',light:'#ffdaeb',fluffy:true},
{id:'snickers',name:'Snickers',price:520,body:'#b98144',dark:'#593d2c',light:'#efd198',floppy:true},
{id:'honey',name:'Honey',price:600,body:'#d3aa6d',dark:'#8b693f',light:'#ffe6b2',glasses:true}];
const adults=[{id:'bandit',name:'Tata Blue',price:0,body:'#6d99b3',dark:'#27496a',light:'#c4dce6'},
{id:'chilli',name:'Mama Blue',price:220,body:'#db9650',dark:'#a76033',light:'#ffe1a5'},
{id:'stripe',name:'Wujek Stripe',price:400,body:'#819fae',dark:'#415e7c',light:'#d5e7e8'},
{id:'trixie',name:'Ciocia Trixie',price:520,body:'#aab5bc',dark:'#6b7c8c',light:'#edf0e9'},
{id:'pat',name:'Tata Lucky’ego',price:650,body:'#e5bd6c',dark:'#b28a42',light:'#ffebae',floppy:true},
{id:'rad',name:'Wujek Rad',price:800,body:'#b9cfda',dark:'#b67b4c',light:'#f4e3c8'}];
let save={coins:0,best:0,kid:'blue',adult:'bandit',owned:['blue','bandit'],sound:true};
try{const old=JSON.parse(localStorage.getItem('blue-bingo-run-v1'));if(old&&typeof old==='object'){save={...save,...old};save.coins=Math.max(0,Number(save.coins)||0);save.best=Math.max(0,Number(save.best)||0);save.owned=Array.isArray(save.owned)?[...new Set(['blue','bandit',...save.owned])]:['blue','bandit'];if(!kids.some(x=>x.id===save.kid&&save.owned.includes(x.id)))save.kid='blue';if(!adults.some(x=>x.id===save.adult&&save.owned.includes(x.id)))save.adult='bandit';}}catch{}
function persist(){try{localStorage.setItem('blue-bingo-run-v1',JSON.stringify(save));}catch{toast('Przeglądarka nie pozwala zapisać postępów.');}}
let mode='home',tab='kids',W=0,H=0,dpr=1,last=0,time=0,run=null,toastTime=0,audio=null;
function resize(){W=innerWidth;H=innerHeight;Run3D.resize()}addEventListener('resize',resize);resize();
function preview(id,p){const c=$(id);if(c)Run3D.portrait(c,p.id)}
function refreshHome(){preview('heroPreview',kids.find(x=>x.id===save.kid));preview('adultPreview',adults.find(x=>x.id===save.adult),true);$('intro').textContent=kids.find(x=>x.id===save.kid).name+' biegnie, a '+adults.find(x=>x.id===save.adult).name+' rusza w pościg!';$('homeBalance').textContent='● '+save.coins+' monet  ·  Rekord: '+save.best+' m';document.querySelectorAll('.sound').forEach(b=>b.textContent=save.sound?'♫':'♫ wył.')}
function panels(show){['home','shop','pause','over'].forEach(x=>$(x).classList.toggle('hidden',x!==show));$('hud').classList.toggle('hidden',!['play','pause'].includes(show));$('touch').classList.toggle('hidden',show!=='play')}
function toast(s){$('toast').textContent=s;$('toast').style.opacity=1;toastTime=3}
function beep(f=700,d=.08,type='sine'){if(!save.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch{}}
function renderShop(){const list=tab==='kids'?kids:adults,key=tab==='kids'?'kid':'adult';$('shopBalance').textContent='● '+save.coins+' monet';$('kidsTab').classList.toggle('active',tab==='kids');$('adultsTab').classList.toggle('active',tab==='adults');$('cards').replaceChildren();list.forEach(p=>{let owned=save.owned.includes(p.id),selected=save[key]===p.id;const card=document.createElement('div');card.className='card'+(selected?' chosen':'');const cv=document.createElement('canvas');cv.width=180;cv.height=220;Run3D.portrait(cv,p.id);card.append(cv);const name=document.createElement('h3');name.textContent=p.name;card.append(name);const b=document.createElement('button');b.dataset.character=p.id;b.textContent=selected?'✓ Wybrana postać':owned?'Wybierz':'● '+p.price+' · Odblokuj';b.disabled=selected;b.onclick=()=>{if(!owned){if(save.coins<p.price){$('shopMessage').textContent='Brakuje '+(p.price-save.coins)+' monet. Zbierzesz je w biegu!';beep(200);return}save.coins-=p.price;save.owned.push(p.id);$('shopMessage').textContent=p.name+' dołącza do ekipy!';beep(980,.15)}save[key]=p.id;persist();renderShop();refreshHome()};card.append(b);$('cards').append(card)})}
function start(){if(!Run3D.ready()){toast('Jeszcze chwila — wczytuję postacie.');return}run={distance:0,coins:0,lane:0,x:0,jump:0,vy:0,slide:0,speed:21,items:[{type:"boots",lane:0,z:45},{type:"jetpack",lane:0,z:110}],next:10,shield:0,magnet:0,boots:0,jetpack:0,flight:0,ground:0,rows:0,invincible:0,particles:[],ended:false};mode='play';panels('play');beep(520);toast('↑ Skacz nad barierkami · ↓ Ślizg pod belką');updateHUD()}
function finish(){if(!run||run.ended)return;run.ended=true;save.best=Math.max(save.best,Math.floor(run.distance));persist();mode='over';panels('over');$('power').classList.add('hidden');$('caught').textContent=adults.find(p=>p.id===save.adult).name+' cię dogania!';$('endDistance').textContent=Math.floor(run.distance);$('endCoins').textContent=run.coins;$('record').textContent='Twój rekord: '+save.best+' m · Skarbonka: '+save.coins+' monet';beep(150,.35,'triangle')}
function pause(){if(mode==='play'){mode='pause';panels('pause')}else if(mode==='pause'){mode='play';panels('play')}}
const powerTypes=['shield','magnet','boots','jetpack'];
function act(a){
 if(mode!=='play')return;
 if(a==='left')run.lane=Math.max(-1,run.lane-1);
 if(a==='right')run.lane=Math.min(1,run.lane+1);
 if(run.jetpack>0||run.flight>.1)return;
 if(a==='jump'&&run.jump<=run.ground+.02&&run.vy===0){run.slide=0;run.vy=run.boots>0?15.5:9.5;beep(run.boots>0?620:420,.09,'triangle')}
 if(a==='slide'){run.slide=.8;run.jump=run.ground;run.vy=0}
}
function activatePower(type){
 const durations={shield:18,magnet:12,boots:18,jetpack:10};run[type]=durations[type];
 const messages={shield:'★ Tarcza! Jedno zderzenie bez złapania.',magnet:'🧲 Magnes przyciąga monety ze wszystkich torów!',boots:'👟 Superbuty! ↑ Skacz wysoko nad pociągami!',jetpack:'🚀 Jetpack! Lataj ← → i zbieraj monety w powietrzu!'};
 if(type==='jetpack'){
  run.jump=0;run.vy=0;run.slide=0;
  // A dedicated trail above the tracks. Ground coins stay on the ground.
  run.items=run.items.filter(o=>!o.air);
  for(let i=0;i<42;i++)run.items.push({type:'coin',lane:[0,-1,0,1][Math.floor(i/7)%4],z:15+i*5,y:6.5,air:true});
 }
 toast(messages[type]);beep(1200,.2);
}
function spawnRow(){
 const lane=Math.floor(Math.random()*3)-1,types=['train','barrier','arch'];
 if(run.rows%4===0){run.items.push({type:'ramp',lane,z:155},{type:'train',lane,z:165,length:42});for(let i=0;i<7;i++)run.items.push({type:'coin',lane,z:171+i*3.5,y:3.3});run.rows++;run.next=64;return;}
 run.items.push({z:155,lane,type:types[Math.floor(Math.random()*types.length)]});
 let safe=[-1,0,1].filter(l=>l!==lane);
 if(run.distance>550&&Math.random()<.4){run.items.push({z:155,lane:safe[0],type:types[Math.floor(Math.random()*3)]});safe=safe.slice(1)}
 const coinLane=safe[Math.floor(Math.random()*safe.length)];
 for(let i=0;i<6;i++)run.items.push({z:155+i*3.5,lane:coinLane,type:'coin'});
 run.rows++;
 if(run.rows%3===0)run.items.push({z:164,lane:coinLane,type:['boots','jetpack','magnet','shield'][(run.rows/3-1)%4]});
 run.next=20+Math.random()*10;
}
function updateHUD(){
 $('distance').textContent=Math.floor(run.distance)+' m';$('coins').textContent='● '+run.coins;
 const powers=[],labels={shield:'★ Tarcza',magnet:'🧲 Magnes',boots:'👟 Superbuty',jetpack:'🚀 Jetpack'};
 for(const type of powerTypes)if(run[type]>0)powers.push(labels[type]+' '+Math.ceil(run[type])+' s');
 $('power').textContent=powers.join(' · ');$('power').classList.toggle('hidden',!powers.length||mode==='over');
}
function update(dt){
 if(mode!=='play')return;
 run.distance+=run.speed*dt;run.speed=Math.min(43,21+run.distance/150);
 run.next-=run.speed*dt;if(run.next<=0)spawnRow();run.x+=(run.lane-run.x)*Math.min(1,dt*15);
 run.slide=Math.max(0,run.slide-dt);run.invincible=Math.max(0,run.invincible-dt);
 for(const o of run.items){o.prevZ=o.z;o.z-=run.speed*dt;}
 const support=run.items.find(o=>o.type==='train'&&!o.hit&&Math.abs(o.lane-run.x)<.53&&o.z<=3&&o.z>3-(o.length||8));
 run.ground=support&&run.jump>=3.12?3.3:0;
 const hadJet=run.jetpack>0;
 for(const type of powerTypes)run[type]=Math.max(0,run[type]-dt);
 if(hadJet&&run.jetpack===0){run.invincible=Math.max(run.invincible,2);toast('Lądowanie! Przez chwilę chroni cię tarcza.');}
 if(run.jetpack>0||run.flight>.01){
  const target=6.5*Math.min(1,run.jetpack/1.2);
  run.flight+=(target-run.flight)*Math.min(1,dt*7);
  if(run.jetpack===0&&run.flight<.05)run.flight=0;
  run.jump=0;run.vy=0;run.slide=0;
 }else if(run.vy!==0||run.jump>run.ground){
  run.jump+=run.vy*dt;run.vy-=24*dt;if(run.jump<=run.ground){run.jump=run.ground;run.vy=0}
 }
 for(const o of run.items){
  const old=o.prevZ;if(o.hit)continue;
  const near=Math.abs(o.lane-run.x)<.53,altitude=run.flight+run.jump;
  if(o.type==='coin'&&o.z<4&&o.z>-2&&(near||run.magnet>0)&&Math.abs((o.y||0)-altitude)<1.9){
   o.hit=true;run.coins++;save.coins++;persist();beep(900+(run.coins%6)*100,.045);continue;
  }
  if((old>3&&o.z<=3)||(o.type==='train'&&o.z<=3&&o.z>3-(o.length||8))){
   if(o.type==='ramp'&&near&&run.jetpack===0&&run.flight<.2&&run.jump<1.6){o.hit=true;run.slide=0;run.jump=1.35;run.vy=14;toast('↗ Rampa! Wskakujesz na dach pociągu!');beep(650,.2)}
   else if(powerTypes.includes(o.type)&&near&&altitude<1.2){o.hit=true;activatePower(o.type)}
   else if(near&&['train','barrier','arch'].includes(o.type)){
    const safe=run.jetpack>0||run.flight>.2||(o.type==='barrier'?run.jump>1.05:o.type==='arch'?run.slide>0||run.jump>3.25:run.jump>=3.25);
    if(!safe&&run.invincible<=0){
     if(run.shield>0){run.shield=0;run.invincible=1.5;o.hit=true;toast('Tarcza uratowała bieg!');beep(220,.2)}else{finish();break}
    }
   }
  }
 }
 run.items=run.items.filter(o=>o.z>-(o.length||10)&&!o.hit);updateHUD();
}
function draw(){Run3D.render({mode,time,run,kid:save.kid,adult:save.adult})}
function frame(t){const dt=Math.min((t-last)/1000||0,.04);last=t;if(mode!=='pause'){time+=dt;update(dt)}if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').style.opacity=0}draw();requestAnimationFrame(frame)}
$('start').onclick=$('again').onclick=start;$('pauseBtn').onclick=$('resume').onclick=pause;$('leave').onclick=finish;
$('openShop').onclick=()=>{mode='shop';panels('shop');$('shopMessage').textContent='';renderShop()};$('closeShop').onclick=$('endHome').onclick=()=>{mode='home';panels('home');refreshHome()};$('kidsTab').onclick=()=>{tab='kids';renderShop()};$('adultsTab').onclick=()=>{tab='adults';renderShop()};
$('full').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>toast('Użyj F11, aby włączyć pełny ekran.'));else document.exitFullscreen?.()};
 document.querySelectorAll('.sound').forEach(b=>b.onclick=()=>{save.sound=!save.sound;persist();refreshHome();beep()});
addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(key))e.preventDefault();if(e.repeat)return;if(key==='escape'||key==='p'){pause();return}if((key===' '||key==='enter')&&mode==='home'){start();return}const a={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'jump',w:'jump',' ':'jump',arrowdown:'slide',s:'slide'}[key];if(a)act(a)});
let touchStart=null;canvas.addEventListener('pointerdown',e=>{touchStart={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointerup',e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))>20)act(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');else act('jump');touchStart=null});canvas.addEventListener('pointercancel',()=>touchStart=null);document.querySelectorAll('[data-action]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();act(b.dataset.action)});addEventListener('blur',()=>{if(mode==='play')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause()});
document.addEventListener('charactersready',()=>{refreshHome();if(mode==='shop')renderShop()});
refreshHome();panels('home');requestAnimationFrame(frame);

window.addEventListener('game-orientation-change', event => { if (event.detail.blocked && mode === 'play') pause(); });
