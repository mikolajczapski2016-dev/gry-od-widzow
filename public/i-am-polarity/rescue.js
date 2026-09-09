'use strict';
const rescueMissions=[
 {id:'bank',title:'Napad na bank',x:43,z:-25,safe:{x:43,z:-8},reward:800,enemies:[[40,-32],[46,-32],[43,-35]],civilians:[[41,-23],[45,-23]]},
 {id:'park',title:'Ratunek w parku',x:0,z:44,safe:{x:0,z:32},reward:600,enemies:[[-8,44],[8,44]],civilians:[[-2,44],[2,44]]},
 {id:'west',title:'Zasadzka na zachodniej ulicy',x:-43,z:-12,safe:{x:-43,z:4},reward:700,enemies:[[-46,-18],[-40,-18],[-43,-21]],civilians:[[-45,-10],[-41,-10]]},
 {id:'north',title:'Eskorta na północy',x:0,z:-42,safe:{x:16,z:-42},reward:900,enemies:[[-6,-44],[-6,-40],[-10,-42]],civilians:[[0,-44],[0,-42],[0,-40]]},
 {id:'south',title:'Ratunek na południu',x:0,z:57,safe:{x:16,z:57},reward:750,enemies:[[-7,55],[-7,59],[-10,57]],civilians:[[0,55],[0,59]]},
 {id:'east',title:'Patrol wschodniej dzielnicy',x:43,z:24,safe:{x:43,z:40},reward:1000,enemies:[[40,17],[46,17],[40,14],[46,14]],civilians:[[41,24],[43,24],[45,24]]}
].map(m=>({...m,state:'available',actors:[],started:false,completed:0}));
let activeRescue=null;
function rescueMarker(x,z,color,text){
 const group=new THREE.Group();scene.add(group);
 const ring=new THREE.Mesh(new THREE.RingGeometry(2.2,2.5,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.22,z);group.add(ring);
 PolarityWorld.label(group,text,x,5,z,'#'+color.toString(16),5);return group;
}
function prepareRescue(m){
 if(!m.marker){m.marker=rescueMarker(m.x,m.z,0xff9977,m.title.toUpperCase());m.safeMarker=rescueMarker(m.safe.x,m.safe.z,0x8bd7a2,'BEZPIECZNA STREFA');}
 if(!m.actors.length){
  for(const [role,positions] of [['attacker',m.enemies],['civilian',m.civilians]])for(const [index,[x,z]] of positions.entries()){
   const e=addEntity('person',x,z,{name:role==='attacker'?'Napastnik':'Osoba do uratowania',model:role==='attacker'?1:0});
   e.id=m.id+'-'+role+'-'+index;e.rescue=m;e.role=role;e.badge=PolarityWorld.label(e.mesh,role==='attacker'?'NAPASTNIK':'RATUJ MNIE',0,2.5,0,role==='attacker'?'#ff9977':'#8bd7a2',2);m.actors.push(e);
  }
 }
}
function startRescue(id){
 if(mode!=='play'||activeRescue||curse||vecnaFinale)return;
 const m=rescueMissions.find(m=>m.id===id);if(!m)return;
 prepareRescue(m);
 for(const e of m.actors){resetEntity(e);e.removed=false;e.mesh.visible=true;e.defeated=false;e.rescueDefeated=false;e.safe=false;e.attackTime=2;e.badge.visible=true;}
 m.state='active';m.started=false;m.casualty=false;m.marker.visible=m.safeMarker.visible=true;activeRescue=m;
 toast(m.title+': dotrzyj do znacznika. Pokonaj napastników i eskortuj ludzi do zielonego koła.');updateRescueUI();
}
function rescueMotion(e,dt){
 const m=e.rescue;e.moving=false;
 if(m!==activeRescue||!m.started||e.rescueDefeated||e.retired||e.safe||e===held||e.knocked>0||e.y>.2||e.thrown)return;
 let goal,speed;
 if(e.role==='attacker'){
  goal=m.actors.filter(v=>v.role==='civilian'&&!v.cursed&&!v.safe&&v.health>0&&v!==held&&v.y<1).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z))[0];speed=1.25;
  e.attackTime=Math.max(0,e.attackTime-dt);
  if(goal&&Math.hypot(goal.x-e.x,goal.z-e.z)<1.5&&e.attackTime===0){
   const origin=center(e),dir=center(goal).sub(origin),distance=dir.length();
   if(wallDistance(origin,dir.normalize(),distance+.1)>=distance){hurt(goal,8);beam(origin,center(goal),0xff9977,.12);e.attackTime=2;}
  }
 }else if(m.actors.filter(a=>a.role==='attacker').every(a=>a.rescueDefeated)){goal=m.safe;speed=2.2;}
 if(!goal)return;const dx=goal.x-e.x,dz=goal.z-e.z,d=Math.hypot(dx,dz);
 if(d>(e.role==='attacker'?1.2:.3)){const step=Math.min(d,speed*dt);move(e,dx/d*step,dz/d*step,e.radius);e.angle=Math.atan2(dx,dz);e.moving=true;}
}
function finishRescue(m,success){
 if(m!==activeRescue)return;
 if(success)m.completed++;
 m.state=success?'success':'failed';activeRescue=null;m.marker.visible=m.safeMarker.visible=false;
 for(const e of m.actors){if(e.respawnTime>0||e.retired)continue;if(held===e)held=null;e.vx=e.vy=e.vz=0;if(e.role==='attacker'||!success){e.removed=true;e.mesh.visible=false;}else{e.badge.visible=false;}}
 if(success){points(m.reward);beep(1000,.3);toast(m.title+': wszyscy uratowani! +'+m.reward+' monet. Czeka kolejne zgłoszenie!');}
 else toast('Misja nieudana — mieszkaniec został obezwładniony. Kliknij „Ponów”, aby spróbować jeszcze raz.');
 updateRescueUI();
}
function updateRescueMissions(){
 const m=activeRescue;if(!m)return;
 if(!m.started&&Math.hypot(player.x-m.x,player.z-m.z)<20){m.started=true;toast('Na ratunek! Czerwoni to napastnicy. Chroń osoby oznaczone na zielono.');}
 const civilians=m.actors.filter(e=>e.role==='civilian');
 if(m.casualty||civilians.some(e=>e.health===0)){finishRescue(m,false);return;}
 for(const e of civilians)if(!e.safe&&!e.cursed&&e!==held&&e.knocked<=0&&e.y<1&&Math.hypot(e.x-m.safe.x,e.z-m.safe.z)<2.1){e.safe=true;e.badge.visible=false;}
 if(civilians.every(e=>e.safe)&&m.actors.filter(e=>e.role==='attacker').every(e=>e.rescueDefeated))finishRescue(m,true);
}
function updateRescueUI(){
 for(const m of rescueMissions){const b=document.querySelector('[data-rescue="'+m.id+'"]');b.disabled=!!activeRescue;b.textContent=(m.state==='success'?'Nowe: ':m.state==='failed'?'Ponów: ':'')+m.title+' · #'+(m.completed+1);}
 const m=activeRescue,p=$('rescueStatus');
 if(!m){p.textContent='Zgłoszenia bez końca · ukończono: '+rescueMissions.reduce((sum,m)=>sum+m.completed,0)+'. Wybierz misję; walka zacznie się na miejscu.';return;}
 const enemies=m.actors.filter(e=>e.role==='attacker'),civilians=m.actors.filter(e=>e.role==='civilian'),goal=enemies.every(e=>e.rescueDefeated)?m.safe:m;
 const delta=Math.atan2(goal.x-player.x,-(goal.z-player.z))-player.yaw;
 const arrow=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(delta/(Math.PI/4))%8+8)%8];
 p.textContent=arrow+' '+Math.round(Math.hypot(goal.x-player.x,goal.z-player.z))+' m · '+(goal===m?'Miejsce napadu':'Zielona strefa')+' | Napastnicy: '+enemies.filter(e=>e.rescueDefeated).length+'/'+enemies.length+' | Uratowani: '+civilians.filter(e=>e.safe).length+'/'+civilians.length+' | Zdrowie: '+Math.min(...civilians.map(e=>Math.ceil(e.health/75*100)))+'%';
}
for(const m of rescueMissions){const b=document.createElement('button');b.dataset.rescue=m.id;b.textContent=m.title;b.addEventListener('click',()=>startRescue(m.id));document.querySelector('.rescue-buttons').append(b);}
