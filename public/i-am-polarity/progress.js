'use strict';
const progressKey='i-am-polarity-progress-v1';
const entityNumbers={x:[-100,100],y:[-5,110],z:[-100,100],startX:[-100,100],startZ:[-100,100],vx:[-1000,1000],vy:[-1000,1000],vz:[-1000,1000],health:[0,75],knocked:[0,20],scared:[0,20],hit:[0,2],thrown:[0,10],spin:[-100,100],angle:[-1e6,1e6],phase:[0,7],respawnTime:[0,3],attackTime:[0,3]};
const entityFlags=['removed','defeated','rescueDefeated','retired','safe'];
function snapshotEntity(e){
 const record={id:e.id,type:e.type};
 for(const key of Object.keys(entityNumbers))record[key]=e[key]||0;
 for(const key of entityFlags)record[key]=!!e[key];
 return record;
}
function saveProgress(){
 if(!ready)return;
 try{
  const data={version:1,score,recycled,rescued,charged,missionAnnounced,time,tool,ammo,reloadTime,player:{...player},held:held?.id||null,entities:entities.map(snapshotEntity),missions:rescueMissions.map(m=>({id:m.id,state:m.state,started:!!m.started,casualty:!!m.casualty,hasActors:!!m.actors.length}))};
  localStorage.setItem(progressKey,JSON.stringify(data));
  $('saveStatus').textContent='Postępy zapisane automatycznie na tym urządzeniu.';
 }catch{$('saveStatus').textContent='Zapis jest niedostępny. Sprawdź, czy przeglądarka pozwala zapisywać dane strony.';}
}
function loadProgress(){
 try{
  const raw=localStorage.getItem(progressKey);if(!raw)return false;
  const s=JSON.parse(raw),number=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b,flag=v=>typeof v==='boolean';
  if(s.version!==1||!s.player||!Array.isArray(s.entities)||!Array.isArray(s.missions))throw Error('Format zapisu');
  if(!number(s.score,0,1e9)||!Number.isInteger(s.recycled)||!number(s.recycled,0,3)||!Number.isInteger(s.charged)||!number(s.charged,0,2)||!flag(s.rescued)||!flag(s.missionAnnounced)||!number(s.time,0,1e9)||!['magnet','pistol'].includes(s.tool)||!Number.isInteger(s.ammo)||!number(s.ammo,0,12)||!number(s.reloadTime,0,1.1))throw Error('Postępy');
  for(const [key,a,b] of [['x',-68,68],['z',-68,68],['y',0,110],['yaw',-1e6,1e6],['pitch',-1.1,1.1],['vy',-1000,1000]])if(!number(s.player[key],a,b))throw Error('Pozycja');
  if(!flag(s.player.flying)||!flag(s.player.grounded))throw Error('Lot');
  const records=new Map();for(const e of s.entities){if(!e||typeof e.id!=='string'||records.has(e.id))throw Error('Postać');for(const [key,[a,b]] of Object.entries(entityNumbers))if(!number(e[key],a,b))throw Error('Stan postaci');for(const key of entityFlags)if(!flag(e[key]))throw Error('Stan postaci');records.set(e.id,e);}
  if(s.missions.length!==rescueMissions.length||s.missions.filter(m=>m.state==='active').length>1)throw Error('Misje');
  const expected=new Map(entities.map(e=>[e.id,e.type]));
  for(const m of rescueMissions){const data=s.missions.find(d=>d.id===m.id);if(!data||!['available','active','success','failed'].includes(data.state)||!flag(data.started)||!flag(data.casualty)||!flag(data.hasActors)||(data.state!=='available'&&!data.hasActors))throw Error('Misja');
   if(data.hasActors)for(const [role,positions] of [['attacker',m.enemies],['civilian',m.civilians]])positions.forEach((_,i)=>expected.set(m.id+'-'+role+'-'+i,'person'));
  }
  if(records.size!==expected.size||[...expected].some(([id,type])=>records.get(id)?.type!==type))throw Error('Mapa zapisu');
  if(s.held!==null&&(!records.has(s.held)||records.get(s.held).removed))throw Error('Trzymany przedmiot');
  // Validate everything before applying a snapshot to the live world.
  for(const m of rescueMissions){const data=s.missions.find(d=>d.id===m.id);if(data.hasActors)prepareRescue(m);m.state=data.state;m.started=data.started;m.casualty=data.casualty;if(m.marker)m.marker.visible=m.safeMarker.visible=m.state==='active';}
  activeRescue=rescueMissions.find(m=>m.state==='active')||null;
  for(const e of entities){const data=records.get(e.id);for(const key of [...Object.keys(entityNumbers),...entityFlags])e[key]=data[key];e.mesh.visible=!e.removed;e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.set(0,e.angle,0);if(e.badge)e.badge.visible=!e.retired&&!e.safe&&!e.removed&&e.rescue===activeRescue;}
  score=s.score;best=Math.max(best,score);recycled=s.recycled;charged=s.charged;rescued=s.rescued;missionAnnounced=s.missionAnnounced;time=s.time;tool=s.tool;ammo=s.ammo;reloadTime=s.reloadTime;
  for(const key of ['x','y','z','yaw','pitch','vy','grounded','flying'])player[key]=s.player[key];
  if(solid(player.x,player.z,.35,player.y)){player.x=spawnPoint.x;player.z=spawnPoint.z;player.y=0;player.vy=0;player.grounded=true;player.flying=false;}
  held=entities.find(e=>e.id===s.held)||null;
  $('flyButton').textContent=player.flying?'Ląduj':'Lataj';$('flyButton').setAttribute('aria-pressed',String(player.flying));
  $('saveStatus').textContent='Wczytano zapis. Możesz kontynuować grę.';return true;
 }catch{$('saveStatus').textContent='Nie udało się wczytać zapisu. Możesz rozpocząć nową rozgrywkę.';return false;}
}
window.addEventListener('pagehide',saveProgress);
