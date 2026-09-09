'use strict';
const $=id=>document.getElementById(id), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const spawnPoint={x:0,z:16};
const player={x:0,y:0,z:16,yaw:0,pitch:-.04,vy:0,grounded:true,flying:false};
const entities=[],keys=new Set(),actionPointers=new Map(),stickState={x:0,y:0,id:null};
let renderer,scene,camera,hands,colliders=[],ready=false,mode='menu',settingsFrom='menu',held=null,target=null;
let tool='magnet',ammo=12,reloadTime=0,cooldown=0,time=0,score=0,best=0,sound=true,sensitivity=1,toastTime=0,recoil=0,needsRender=true,audio;
let recycled=0,rescued=false,charged=0,missionAnnounced=false,districtRound=1,lookPointer=null;
const effects=[],storageKey='i-am-polarity-v1';
try{const s=JSON.parse(localStorage.getItem(storageKey));if(s){best=clamp(Number(s.best)||0,0,9999999);sound=s.sound!==false;sensitivity=clamp(Number(s.sensitivity)||1,.5,2);}}catch{}
function save(){try{localStorage.setItem(storageKey,JSON.stringify({best,sound,sensitivity}));}catch{}}
function points(n){score+=n;wallet+=n;if(score>best){best=score;save();}}
function toast(s){$('toast').textContent=s;$('toast').style.opacity=1;toastTime=3;}
async function beep(f=450,length=.12,type='sine'){
 if(!sound)return;try{try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}if(!audio||audio.state==='closed')audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state!=='running')await audio.resume();if(!sound||document.hidden)return;
 const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(45,f*.4),audio.currentTime+length);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);o.onended=()=>{o.disconnect();g.disconnect();};}catch{}
}
let knockoutBuffer=null,knockoutLoading=null,knockoutSource=null,knockoutRequest=0;
async function prepareKnockoutSound(){
 try{
  if(!audio||audio.state==='closed')audio=new(window.AudioContext||window.webkitAudioContext)();
  if(!knockoutLoading)knockoutLoading=fetch('assets/teletubisie-papa.m4a').then(r=>{if(!r.ok)throw new Error('Audio '+r.status);return r.arrayBuffer();}).then(bytes=>audio.decodeAudioData(bytes)).then(buffer=>{// Remove quiet lead-in so the effect is audible from the first moment.
   let first=0;const samples=buffer.getChannelData(0),windowSize=Math.ceil(buffer.sampleRate*.01);
   for(let i=0;i<samples.length;i+=windowSize){let energy=0;for(let j=i;j<Math.min(i+windowSize,samples.length);j++)energy+=samples[j]*samples[j];if(Math.sqrt(energy/windowSize)>.012){first=Math.max(0,i-windowSize);break;}}
   const trimmed=audio.createBuffer(buffer.numberOfChannels,buffer.length-first,buffer.sampleRate);
   for(let c=0;c<buffer.numberOfChannels;c++)trimmed.copyToChannel(buffer.getChannelData(c).subarray(first),c);
   knockoutBuffer=trimmed;return trimmed;}).catch(error=>{knockoutLoading=null;console.warn('Nie udało się wczytać efektu pa-pa',error);return null;});
  return await knockoutLoading;
 }catch{return null;}
}
function stopKnockoutSound(){knockoutRequest++;if(knockoutSource){knockoutSource.stop();knockoutSource=null;}}
async function playKnockoutSound(){
 if(!sound||mode!=='play'||document.hidden)return;
 const request=++knockoutRequest,buffer=knockoutBuffer||await prepareKnockoutSound();
 if(!buffer||request!==knockoutRequest||!sound||mode!=='play'||document.hidden)return;
 if(knockoutSource)knockoutSource.stop();
 const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;gain.gain.value=.65;source.connect(gain);gain.connect(audio.destination);knockoutSource=source;
 source.onended=()=>{source.disconnect();gain.disconnect();if(knockoutSource===source)knockoutSource=null;};source.start();
}
function forward(){return new THREE.Vector3(Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch));}
function eye(){return new THREE.Vector3(player.x,player.y+1.66,player.z);}
function solid(x,z,r=.35,y=0){return Math.abs(x)>PolarityWorld.bounds.x-r||Math.abs(z)>PolarityWorld.bounds.z-r||colliders.some(b=>y<b.h-.01&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
function floorAt(body){return colliders.reduce((h,b)=>Math.abs(body.x-b.x)<b.w/2+(body.radius||.35)&&Math.abs(body.z-b.z)<b.d/2+(body.radius||.35)?Math.max(h,b.h):h,0);}
function move(body,dx,dz,r=.35){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));let hit=false;for(let i=0;i<steps;i++){if(!solid(body.x+dx/steps,body.z,r,body.y))body.x+=dx/steps;else hit=true;if(!solid(body.x,body.z+dz/steps,r,body.y))body.z+=dz/steps;else hit=true;}return hit;}
function wallDistance(origin,dir,max=100){const ray=new THREE.Ray(origin,dir);let nearest=max;for(const b of colliders){const hit=ray.intersectBox(new THREE.Box3(new THREE.Vector3(b.x-b.w/2,0,b.z-b.d/2),new THREE.Vector3(b.x+b.w/2,b.h,b.z+b.d/2)),new THREE.Vector3());if(hit)nearest=Math.min(nearest,origin.distanceTo(hit));}return nearest;}
function center(e){return new THREE.Vector3(e.x,e.y+(e.person?.95:e.height/2),e.z);}
function aim(assist=true,range=24){
 const origin=eye(),direction=forward(),wall=wallDistance(origin,direction,range);let result=null,bestDistance=range;
 for(const e of entities){if(e===held||e.removed||e.defeated||e.safe||e.cursed)continue;const c=center(e),delta=c.clone().sub(origin),d=delta.length();if(d>range)continue;
  const dot=delta.normalize().dot(direction),radius=e.person?.48:Math.max(.35,e.radius*.75),along=c.clone().sub(origin).dot(direction),miss=c.distanceTo(origin.clone().addScaledVector(direction,along));
  if(along<0||(!assist&&miss>radius)||(assist&&miss>radius&&dot<.96))continue;
  if(wallDistance(origin,c.clone().sub(origin).normalize(),d+.1)<d-.3)continue;
  if(d<bestDistance&&along<wall+.5){result=e;bestDistance=d;}
 }
 return result;
}
function beam(a,b,color=0x79f0e5,life=.18){const geometry=new THREE.BufferGeometry().setFromPoints([a,b]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true}));scene.add(line);effects.push({mesh:line,life,total:life});}
function flash(position,color=0xffdf9d){const m=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),new THREE.MeshBasicMaterial({color,transparent:true}));m.position.copy(position);scene.add(m);effects.push({mesh:m,life:.16,total:.16});}
function scare(){for(const e of entities)if(e.person&&!e.worker&&Math.hypot(e.x-player.x,e.z-player.z)<18)e.scared=6;}
function hurt(e,amount){
 if(!e.person||e.removed||e.defeated||e.safe||e.cursed)return;
 const wasAlive=e.health>0;e.health=Math.max(0,e.health-amount);e.scared=6;e.hit=.3;
 if(e.health===0&&wasAlive){
  playKnockoutSound();e.respawnTime=2;e.removed=true;e.mesh.visible=false;e.vx=e.vy=e.vz=0;if(held===e)held=null;
  if(e.rescue&&!e.retired){if(e.role==='attacker')e.rescueDefeated=true;else if(e.rescue===activeRescue)e.rescue.casualty=true;}
  toast('Postać wróci za 2 sekundy przy miejscu startu.');
 }
 else e.knocked=Math.max(e.knocked,1.2);flash(center(e));
}
function grab(){
 if(held){held.vx=held.vz=held.vy=0;toast('Puszczasz: '+held.name);held=null;return;}
 const e=aim(true,18);if(!e){toast('Spójrz celownikiem na człowieka lub przedmiot.');return;}
 held=e;e.vx=e.vy=e.vz=0;e.scared=e.person?6:0;beam(eye(),center(e));toast('Trzymasz: '+e.name+' · F / Rzuć, aby odrzucić');beep(700,.15);
}
function toss(){
 if(tool==='magnet'&&glovePower())return;
 if(cooldown>0)return;cooldown=.35;recoil=.25;
 if(held){const e=held,dir=forward();e.vx=dir.x*18;e.vz=dir.z*18;e.vy=dir.y*12+5;e.thrown=2;e.spin=e.person?2.4:3.3;held=null;if(e.person){e.knocked=Math.max(e.knocked,2);scare();}points(5);toast('Rzut!');beep(190,.18,'triangle');return;}
 const e=aim(true,12);if(e){const dir=center(e).sub(eye()).normalize();e.vx=dir.x*13;e.vz=dir.z*13;e.vy=4;e.thrown=1.4;if(e.person)hurt(e,20);beam(eye(),center(e),0xefac88);toast(e.person?'Cios mocy!':'Impuls magnetyczny!');points(2);scare();}else{beam(eye(),eye().addScaledVector(forward(),7),0x82dfdc);toast('Wyceluj w pobliski przedmiot lub osobę.');}beep(170,.12,'triangle');
}
function shoot(){
 if(cooldown>0||reloadTime>0)return;if(ammo===0){reload();return;}ammo--;cooldown=.22;recoil=.15;const e=aim(true,45),origin=eye(),dir=forward();let end=origin.clone().addScaledVector(dir,wallDistance(origin,dir,45));
 if(e){end=center(e);if(e.person){hurt(e,25);toast(e.health>0?'Trafienie!':'Postać obezwładniona.');}else{e.vx+=dir.x*2;e.vz+=dir.z*2;e.vy+=1;e.thrown=.5;flash(end);}}
 beam(origin.clone().add(new THREE.Vector3(.15,-.15,0)),end,0xffe7a2,.09);beep(100,.07,'sawtooth');scare();
}
function reload(){if(tool==='pistol'&&reloadTime===0&&ammo<12){reloadTime=1.05;toast('Przeładowanie…');beep(330,.12);}}
function switchTool(){tool=tool==='magnet'?'pistol':'magnet';reloadTime=0;toast(tool==='pistol'?'Pistolet: klik / Użyj. R — przeładuj.':'Magnes: E — chwyć, F — rzuć / odepchnij.');beep(500,.06);}
function toggleFlight(){
 player.flying=!player.flying;player.vy=0;player.grounded=false;
 const button=$('flyButton');button.textContent=player.flying?'Ląduj':'Lataj';button.setAttribute('aria-pressed',String(player.flying));
 toast(player.flying?'Lot! Patrz w górę lub w dół i ruszaj do przodu. Przycisk Ląduj kończy lot.':'Lądowanie…');beep(650,.15);
}
function jump(){if(player.grounded){player.vy=5.4;player.grounded=false;}}
function action(name){if(mode!=='play'||vecnaFinale)return;if(curse){if(name==='use'||name==='throw')curseStrike();return;}if(realmVisit&&!['fly','jump'].includes(name))return;if(name==='fly')toggleFlight();if(name==='grab')grab();if(name==='throw')toss();if(name==='switch')switchTool();if(name==='jump')jump();if(name==='use')tool==='pistol'?shoot():toss();}
function addEntity(type,x,z,options={}){
 const person=type==='person',mesh=person?PolarityWorld.character(scene,options.model||0):PolarityWorld.object(scene,type,options.color),e={id:'world-'+entities.length,modelIndex:options.model||0,type,name:options.name||({crate:'Metalowa skrzynia',cell:'Ogniwo energii',beam:'Stalowa belka',bench:'Ławka',barrel:'Metalowa beczka'}[type]),person,mesh,x,y:0,z,vx:0,vy:0,vz:0,startX:x,startZ:z,radius:person?.38:type==='beam'?1.7:type==='bench'?1.1:.55,height:person?1.85:type==='beam'?.7:1.1,health:75,knocked:0,scared:0,hit:0,thrown:0,spin:0,angle:Math.PI,worker:!!options.worker,removed:false,phase:Math.random()*6};mesh.position.set(x,0,z);entities.push(e);return e;
}
function populateNeighborhoods(){
 // One resident in each outer map sector keeps every neighborhood populated.
 const margin=3,columns=5,rows=5;
 const width=(PolarityWorld.bounds.x-margin)*2/columns,depth=(PolarityWorld.bounds.z-margin)*2/rows;
 let index=0;
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  if(row===2&&column===2)continue; // The original square already has residents.
  const candidates=[],left=-PolarityWorld.bounds.x+margin+column*width,top=-PolarityWorld.bounds.z+margin+row*depth;
  for(let x=left+1;x<left+width-1;x+=2)for(let z=top+1;z<top+depth-1;z+=2){
   if(solid(x,z,1)||Math.hypot(x-player.x,z-player.z)<2)continue;
   if(entities.some(e=>Math.hypot(e.x-x,e.z-z)<e.radius+1))continue;
   candidates.push({x,z});
  }
  if(!candidates.length)continue;
  const {x,z}=candidates[Math.floor(Math.random()*candidates.length)];
  addEntity('person',x,z,{name:['Mieszkaniec','Przechodzień','Sąsiad'][index%3],model:index%2});index++;
 }
}
function build(){
 colliders=PolarityWorld.create(scene);
 for(const [x,z] of [[-4,2],[-7,-3],[-2,-6]])addEntity('crate',x,z);
 addEntity('cell',5,3);addEntity('cell',-9,7);addEntity('beam',8,-4);addEntity('bench',-12,1);addEntity('bench',12,1);addEntity('barrel',5,9);addEntity('barrel',-9,-9);
 addEntity('person',8,-6,{name:'Pracownik warsztatu',model:2,worker:true});
 for(const [i,p] of [[0,[0,8]],[1,[-5,7]],[2,[6,5]],[3,[-8,-5]],[4,[11,9]],[5,[-11,12]],[6,[5,-11]]])addEntity('person',p[0],p[1],{name:['Mieszkaniec','Przechodzień','Sąsiad'][i%3],model:i%2});
 for(const [x,z] of [[-34,32],[34,32],[-34,-42],[34,-42],[-20,44],[20,44]]){addEntity('barrel',x,z);addEntity('bench',x+3,z+2);}
 populateNeighborhoods();
 hands=PolarityWorld.hands(camera);scene.add(camera);
}
function updatePlayer(dt){
 let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stickState.x;
 let z=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stickState.y;
 const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}const speed=player.flying?12:keys.has('ShiftLeft')?7:4.7;
 move(player,(Math.cos(player.yaw)*x+Math.sin(player.yaw)*z)*dt*speed,(Math.sin(player.yaw)*x-Math.cos(player.yaw)*z)*dt*speed);
 const floor=floorAt(player);
 if(player.flying){player.vy=0;player.y=clamp(player.y+(Math.sin(player.pitch)*z*speed+(keys.has('Space')?6:0))*dt+Math.max(0,6-player.y)*Math.min(1,dt*3),floor,55);player.grounded=false;}
 else{player.vy-=13*dt;player.y+=player.vy*dt;player.grounded=false;if(player.y<=floor){player.y=floor;player.vy=0;player.grounded=true;}}
 camera.position.set(player.x,player.y+1.66,player.z);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
 // Three.js looks along local -Z; yaw must rotate right for positive mouse input.
 camera.rotation.y=-player.yaw;
 cooldown=Math.max(0,cooldown-dt);recoil=Math.max(0,recoil-dt);if(reloadTime>0){reloadTime=Math.max(0,reloadTime-dt);if(reloadTime===0)ammo=12;}
 if(!realmVisit&&(keys.has('KeyF')||[...actionPointers.values()].includes('throw')))toss();
 if(keys.has('Mouse0')||[...actionPointers.values()].includes('use'))action('use');
 if(held){const dir=forward(),origin=eye(),range=Math.min(3.1,Math.max(1.1,wallDistance(origin,dir,4)-held.radius-.25)),desired=origin.addScaledVector(dir,range);held.x+=(desired.x-held.x)*Math.min(1,dt*14);held.z+=(desired.z-held.z)*Math.min(1,dt*14);held.y+=(Math.max(.25,desired.y-held.height*.5)-held.y)*Math.min(1,dt*14);held.angle=-player.yaw;held.vx=held.vy=held.vz=0;}
 const sway=len>.1?Math.sin(time*9)*.013:Math.sin(time*2)*.004;hands.root.position.y=sway;hands.left.rotation.x=held?-.2:Math.sin(time*2)*.025;hands.right.position.z=-.57+recoil*.45;hands.pistol.visible=tool==='pistol';hands.right.rotation.x=reloadTime>0?-.65:0;
}
function resetEntity(e){e.x=e.startX;e.z=e.startZ;e.y=0;e.vx=e.vy=e.vz=0;e.health=75;e.knocked=0;e.thrown=0;e.spin=0;e.respawnTime=0;e.frozen=0;e.cursed=false;e.retired=false;e.scared=0;e.hit=0;e.mesh.rotation.set(0,Math.PI,0);if(held===e)held=null;}
function respawnPerson(e){
 let position=null;
 for(let ring=1;ring<=8&&!position;ring++)for(let i=0;i<ring*8;i++){
  const angle=i/(ring*8)*Math.PI*2,x=spawnPoint.x+Math.cos(angle)*ring*1.3,z=spawnPoint.z+Math.sin(angle)*ring*1.3;
  if(!solid(x,z,.5)&&Math.hypot(x-player.x,z-player.z)>1&& !entities.some(other=>other!==e&&!other.removed&&Math.hypot(other.x-x,other.z-z)<other.radius+.6)){position={x,z};break;}
 }
 if(!position){e.respawnTime=.25;return;}
 resetEntity(e);e.x=position.x;e.z=position.z;e.removed=false;e.defeated=false;e.safe=false;e.retired=!!e.rescue;e.mesh.visible=true;e.mesh.position.set(e.x,0,e.z);if(e.badge)e.badge.visible=false;
 PolarityWorld.animate(e.mesh,'Idle',0);
}
function updateEntities(dt){
 for(const e of entities){if(e.respawnTime>0){e.respawnTime=Math.max(0,e.respawnTime-dt);if(e.respawnTime===0)respawnPerson(e);continue;}if(e.removed||e.cursed)continue;if(e.frozen>0){e.frozen=Math.max(0,e.frozen-dt);PolarityWorld.animate(e.mesh,'Idle',dt);continue;}e.scared=Math.max(0,e.scared-dt);e.hit=Math.max(0,e.hit-dt);e.thrown=Math.max(0,e.thrown-dt);
  if(e!==held){
   if(e.rescue)rescueMotion(e,dt);
   if(e.person&&(!e.rescue||e.retired)&&e.knocked<=0&&e.y<.1&&!e.thrown&&!e.worker){let dx=Math.sin(time*.3+e.phase),dz=Math.cos(time*.3+e.phase);if(e.scared){const d=Math.hypot(e.x-player.x,e.z-player.z)||1;dx=(e.x-player.x)/d;dz=(e.z-player.z)/d;}const speed=e.scared?3.6:.65;move(e,dx*speed*dt,dz*speed*dt,e.radius);e.angle=Math.atan2(dx,dz);}
   const velocity=Math.hypot(e.vx,e.vz);if(move(e,e.vx*dt,e.vz*dt,e.radius)){e.vx*=-.3;e.vz*=-.3;if(e.person&&velocity>9)hurt(e,20);}
   e.vy-=12*dt;e.y+=e.vy*dt;if(e.y<=floorAt(e)){if(e.person&&e.vy<-10)hurt(e,15);e.y=floorAt(e);e.vy=Math.abs(e.vy)>2&&!e.person?-e.vy*.22:0;const friction=Math.exp(-dt*5);e.vx*=friction;e.vz*=friction;e.spin*=friction;}
   if(e.thrown&&velocity>4)for(const other of entities){if(other===e||other===held||other.removed||other.cursed||Math.abs(other.y-e.y)>2)continue;if(Math.hypot(other.x-e.x,other.z-e.z)<e.radius+other.radius){other.vx+=e.vx*.4;other.vz+=e.vz*.4;other.vy=2;if(other.person)hurt(other,20);e.vx*=-.25;e.vz*=-.25;e.thrown=0;break;}}
  }
  if(e.person){if(e.knocked>0){e.knocked=Math.max(0,e.knocked-dt);if(e.knocked<=0&&e!==held){if(!e.rescue)e.health=75;e.mesh.rotation.z=0;}}const state=e.knocked>0?(e.health===0?'Death':'HitRecieve'):e===held?'Wave':e.rescue&&!e.retired?(e.moving?'Run':'Idle'):e.worker?'Idle':e.scared?'Run':'Walk';PolarityWorld.animate(e.mesh,state,dt);}
  if(e.y>100||e.y<-5||!Number.isFinite(e.x+e.y+e.z))resetEntity(e);
  e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.y=e.angle;if(!e.person&&e.thrown)e.mesh.rotation.z+=e.spin*dt;
 }
}
function updateMissions(){
 updateRescueMissions();
 for(const e of entities){if(e.removed||e.cursed||e===held||e.y>1.2)continue;
  if(e.type==='crate'&&Math.hypot(e.x+12,e.z+14)<2.3){e.removed=true;e.mesh.visible=false;recycled++;points(100);toast('Skrzynia oddana do recyklingu! '+recycled+'/3');beep(850,.2);}
  if(e.type==='cell'&&Math.hypot(e.x,e.z+17)<2.3){e.removed=true;e.mesh.visible=false;charged++;points(150);toast('Generator: '+charged+'/2 ogniwa!');beep(950,.2);}
  if(e.worker&&!rescued&&e.health>0&&e.knocked<=0&&Math.hypot(e.x-12,e.z+14)<2.3){rescued=true;points(300);toast('Pracownik uratowany! +300 pkt');beep(1000,.3);}
 }
 if(recycled===3&&charged===2&&rescued&&!missionAnnounced){missionAnnounced=true;points(500);toast('DZIELNICA URATOWANA! +500 monet. Rusza kolejna runda zadań!');}
 if(missionAnnounced&&!curse&&!vecnaFinale){
  for(const e of entities)if(e.type==='crate'||e.type==='cell'||e.worker){resetEntity(e);e.removed=false;e.defeated=false;e.safe=false;e.mesh.visible=true;e.mesh.position.set(e.x,e.y,e.z);}
  recycled=0;charged=0;rescued=false;missionAnnounced=false;districtRound++;
 }
}
function updateUI(){
 $('realmButton').hidden=equippedGlove!=='vecna'||!!curse||!!vecnaFinale;
 $('realmButton').textContent=realmVisit?'Wróć do normalnego świata':'Przejdź na drugą stronę';
 $('realmButton').setAttribute('aria-pressed',String(realmVisit));
 updateRescueUI();
 $('districtRound').textContent='Zadania dzielnicy · runda '+districtRound;
 target=curse||realmVisit?null:aim(true,18);$('crosshair').classList.toggle('active',!!target);$('targetLabel').textContent=target?target.name+' · E / Chwyć':'';
 $('heldLabel').textContent=held?'TRZYMASZ: '+held.name+' · F / Rzuć':'';
 $('score').textContent=score+' pkt';$('toolLabel').textContent=curse?'VECNA':tool==='magnet'?glove().name.toUpperCase():reloadTime?'PRZEŁADOWANIE…':'PISTOLET · '+ammo+'/12';
 $('task1').textContent=(recycled===3?'✓':'○')+' Recykling: '+recycled+'/3 skrzynie';$('task2').textContent=(rescued?'✓':'○')+' Przenieś pracownika do zielonej strefy';$('task3').textContent=(charged===2?'✓':'○')+' Generator: '+charged+'/2 ogniwa';
 $('task1').classList.toggle('done',recycled===3);$('task2').classList.toggle('done',rescued);$('task3').classList.toggle('done',charged===2);document.querySelector('[data-action="use"]').textContent=tool==='pistol'?'STRZELAJ':'UŻYJ MOCY';
}
function releaseInputs(){keys.clear();actionPointers.clear();stickState.x=stickState.y=0;stickState.id=null;lookPointer=null;$('knob').style.transform='';}
function screen(name){if(mode==='play')saveProgress();mode=name;releaseInputs();needsRender=true;for(const id of ['menu','pause','settings','shop'])$(id).hidden=id!==name;$('hud').hidden=name!=='play';syncVecnaMusic();if(name!=='play'){stopKnockoutSound();if(document.pointerLockElement)document.exitPointerLock();$(name).querySelector('button')?.focus({preventScroll:true});}}
$('start').onclick=()=>{if(ready){screen('play');if(sound)prepareKnockoutSound();beep(600);}};$('resume').onclick=()=>{screen('play');};$('pauseButton').onclick=()=>screen('pause');$('menuButton').onclick=()=>{$('start').textContent='WRÓĆ DO DZIELNICY';screen('menu');};
for(const b of document.querySelectorAll('.open-settings'))b.onclick=()=>{settingsFrom=mode;screen('settings');};$('closeSettings').onclick=()=>screen(settingsFrom);
function soundLabel(){$('sound').textContent='Dźwięk: '+(sound?'włączony':'wyłączony');$('sound').setAttribute('aria-pressed',String(sound));}
$('sound').onclick=()=>{sound=!sound;if(!sound)stopKnockoutSound();syncVecnaMusic();soundLabel();save();if(sound)beep();};$('sensitivity').value=sensitivity;$('sensitivity').oninput=event=>{sensitivity=Number(event.target.value);save();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else $('fullscreen').textContent='Pełny ekran niedostępny';}catch{$('fullscreen').textContent='Pełny ekran niedostępny';}};
window.addEventListener('keydown',event=>{if(mode!=='play'){if(event.code==='KeyP'&&mode==='pause')screen('play');return;}if(event.ctrlKey||event.metaKey||event.altKey)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();keys.add(event.code);if(event.repeat)return;if(['Escape','KeyP'].includes(event.code)){screen('pause');return;}if(event.code==='KeyR')reload();const map={KeyE:'grab',KeyF:'throw',KeyG:'switch',Space:'jump',KeyV:'fly'};if(map[event.code])action(map[event.code]);});
window.addEventListener('keyup',event=>keys.delete(event.code));
function rotate(dx,dy){if(vecnaFinale)return;const viewer=curse?curse.hero:player;viewer.yaw+=dx*.0025*sensitivity;viewer.pitch=clamp(viewer.pitch-dy*.0025*sensitivity,-1.1,1.1);needsRender=true;}
document.addEventListener('mousemove',event=>{if(mode==='play'&&document.pointerLockElement===$('game'))rotate(event.movementX,event.movementY);});
$('game').addEventListener('contextmenu',event=>event.preventDefault());
$('game').addEventListener('pointerdown',event=>{if(mode!=='play'||(curse&&event.clientX<innerWidth/2))return;if(event.pointerType==='mouse'&&document.pointerLockElement===$('game')&&event.button===0){keys.add('Mouse0');action('use');}else{lookPointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,button:event.button};$('game').setPointerCapture(event.pointerId);}});
$('game').addEventListener('pointermove',event=>{if(lookPointer?.id===event.pointerId&&document.pointerLockElement!==$('game')){const dx=event.clientX-lookPointer.x,dy=event.clientY-lookPointer.y;if(Math.abs(dx)+Math.abs(dy)>1)lookPointer.moved=true;rotate(dx,dy);lookPointer.x=event.clientX;lookPointer.y=event.clientY;}});
function releaseLook(event){keys.delete('Mouse0');if(lookPointer?.id===event.pointerId){if(!lookPointer.moved&&event.pointerType==='mouse'&&lookPointer.button===0)action('use');lookPointer=null;}}
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])$('game').addEventListener(eventName,releaseLook);window.addEventListener('pointerup',()=>keys.delete('Mouse0'));
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='play')screen('pause');});
const stick=$('stick');function moveStick(e){const r=stick.getBoundingClientRect(),max=r.width*.32;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const d=Math.hypot(x,y);if(d>max){x*=max/d;y*=max/d;}stickState.x=x/max;stickState.y=y/max;$('knob').style.transform=`translate(${x}px,${y}px)`;}
stick.addEventListener('pointerdown',e=>{if(mode!=='play'||stickState.id!==null)return;e.preventDefault();stickState.id=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickState.id)moveStick(e);});for(const name of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,e=>{if(e.pointerId===stickState.id){stickState.id=null;stickState.x=stickState.y=0;$('knob').style.transform='';}});
for(const button of document.querySelectorAll('[data-action]')){const name=button.dataset.action;if(['throw','use'].includes(name)){button.addEventListener('pointerdown',e=>{if(mode!=='play')return;e.preventDefault();button.setPointerCapture(e.pointerId);actionPointers.set(e.pointerId,name);action(name);});for(const eventName of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(eventName,e=>actionPointers.delete(e.pointerId));button.addEventListener('click',e=>{if(e.detail===0)action(name);});}else button.addEventListener('click',()=>action(name));}
window.addEventListener('blur',()=>{if(mode==='play')screen('pause');else releaseInputs();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')screen('pause');});window.addEventListener('game-orientation-change',event=>{if(event.detail.blocked&&mode==='play')screen('pause');});
let last=0,hudTime=0,saveTime=0;function frame(now){const dt=Math.min((now-last)/1000||0,.08);last=now;if(mode==='play'){time+=dt;if(curse)updateCurse(dt);else if(!vecnaFinale)updatePlayer(dt);updateEntities(dt);if(vecnaFinale)updateVecnaFinale(dt);updateMissions();saveTime+=dt;if(saveTime>=1){saveProgress();saveTime=0;}toastTime-=dt;if(toastTime<=0)$('toast').style.opacity=0;for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.mesh.material.opacity=Math.max(0,e.life/e.total);if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);}}hudTime+=dt;if(hudTime>.08){updateUI();hudTime=0;}}
 if(ready&&(mode==='play'||needsRender)){renderWorld();needsRender=false;}requestAnimationFrame(frame);}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();needsRender=true;}
soundLabel();
(async()=>{try{renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.05,240);camera.position.set(player.x,1.66,player.z);camera.rotation.x=player.pitch;await Promise.all([PolarityWorld.load(),prepareKnockoutSound(),prepareVecnaMusic()]);build();const continued=loadProgress();resize();window.addEventListener('resize',resize);ready=true;$('start').disabled=false;for(const button of document.querySelectorAll('.save-exit'))button.disabled=false;$('start').textContent=continued?'KONTYNUUJ GRĘ ↗':'URUCHOM SWOJE MOCE ↗';applyGlove(hands);updateEntities(0);if(curse)updateCurse(0);else updatePlayer(0);updateUI();requestAnimationFrame(frame);$('game').addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;screen('menu');$('start').disabled=true;$('loadError').hidden=false;});}catch(error){console.error(error);$('loadError').hidden=false;$('start').disabled=true;}})();
