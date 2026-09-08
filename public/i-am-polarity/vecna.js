'use strict';
let curse=null,realm=null,vecnaBuffer=null,vecnaSource=null,vecnaLoading=null;
async function prepareVecnaMusic(){
 try{
  if(!audio||audio.state==='closed')audio=new(window.AudioContext||window.webkitAudioContext)();
  if(!vecnaLoading)vecnaLoading=fetch('assets/mr-vecna.m4a').then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(b=>audio.decodeAudioData(b)).then(b=>vecnaBuffer=b).catch(()=>{vecnaLoading=null;return null;});
  return await vecnaLoading;
 }catch{return null;}
}
function syncVecnaMusic(){
 const shouldPlay=!!curse&&mode==='play'&&sound&&!document.hidden;
 if(!shouldPlay){if(vecnaSource){vecnaSource.stop();vecnaSource=null;}return;}
 if(vecnaSource||!vecnaBuffer)return;
 audio.resume().catch(()=>{});
 const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=vecnaBuffer;source.loop=true;gain.gain.value=.45;source.connect(gain);gain.connect(audio.destination);source.onended=()=>{source.disconnect();gain.disconnect();if(vecnaSource===source)vecnaSource=null;};vecnaSource=source;source.start(0,curse.elapsed%vecnaBuffer.duration);
}
function createRealm(){
 const world=new THREE.Scene();world.background=new THREE.Color(0x36141e);world.fog=new THREE.FogExp2(0x442335,.009);
 world.add(new THREE.HemisphereLight(0xebc4ff,0x655779,3.4));const sun=new THREE.DirectionalLight(0xff8699,4);sun.position.set(-10,30,-20);world.add(sun);
 PolarityWorld.box(world,0,-.15,0,144,.3,144,0x49344d);
 const ruins=new THREE.Group();ruins.name='upside-down-ruins';world.add(ruins);
 for(const [index,b] of colliders.entries()){
  const house=new THREE.Group();house.position.set(b.x,0,b.z);ruins.add(house);
  PolarityWorld.box(house,0,b.h/2,0,b.w,b.h,b.d,index%2?0x393542:0x49333b);
  // Recessed-looking black windows, broken shutters and cracked masonry on all sides.
  for(let side=0;side<4;side++){
   const wall=new THREE.Group();wall.rotation.y=side*Math.PI/2;house.add(wall);
   const width=side%2?b.d:b.w,depth=side%2?b.w:b.d;
   for(let y=2;y<b.h-1;y+=3.4)for(let x=-width/2+1.4;x<width/2-1;x+=3){
    PolarityWorld.box(wall,x,y,depth/2+.02,1.15,1.7,.06,0x110f1a);
    PolarityWorld.box(wall,x,y-.9,depth/2+.13,1.4,.12,.3,0x74616b);
    const board=PolarityWorld.box(wall,x,y,depth/2+.12,1.45,.16,.13,0x69505a);board.rotation.z=(index%2?1:-1)*.5;
   }
   for(let j=0;j<3;j++){
    const crack=PolarityWorld.box(wall,(j-1)*width*.28,b.h*.45,depth/2+.06,.045,b.h*.6,.04,0x1d1523);crack.rotation.z=(j-1)*.18;
   }
   PolarityWorld.box(wall,0,.9,depth/2+.04,1.3,1.8,.08,0x170e1b);
  }
  // Crooked roof slabs and exposed beams break the simple rectangular silhouette.
  for(const sign of [-1,1]){
   const roof=PolarityWorld.box(house,sign*b.w*.24,b.h+.65,0,b.w*.55,.23,b.d+.5,0x282431);roof.rotation.z=-sign*.22;
  }
  for(let j=0;j<4;j++){
   const beam=PolarityWorld.box(house,(j-1.5)*b.w*.2,b.h+1.2,-b.d*.3,.18,2+(j%2),.18,0x55414d);beam.rotation.z=(j-1.5)*.13;
  }
 }

 // The downloaded still wraps around the distant scenery; nearby geometry provides parallax.
 const backdropTexture=new THREE.TextureLoader().load('assets/upside-down.jpg');
 // Sample the forest floor in the photo, then tile it across the walkable surface.
 const floorTexture=backdropTexture.clone();floorTexture.colorSpace=THREE.SRGBColorSpace;
 floorTexture.repeat.set(.2,.08);floorTexture.offset.set(.72,.01);
 // TextureLoader completes asynchronously; share its image with the cropped material.
 backdropTexture.onUpdate=()=>{if(backdropTexture.image&&floorTexture.image!==backdropTexture.image){floorTexture.image=backdropTexture.image;floorTexture.needsUpdate=true;}};
 const floor=new THREE.InstancedMesh(new THREE.PlaneGeometry(6,6),new THREE.MeshStandardMaterial({map:floorTexture,bumpMap:floorTexture,bumpScale:.04,color:0xffffff,roughness:1}),576);
 floor.name='upside-down-walkable-photo';const tile=new THREE.Object3D();
 for(let i=0;i<576;i++){tile.position.set(-69+(i%24)*6,.012,-69+Math.floor(i/24)*6);tile.rotation.set(-Math.PI/2,0,(i%2)*Math.PI);tile.updateMatrix();floor.setMatrixAt(i,tile.matrix);}world.add(floor);
 backdropTexture.colorSpace=THREE.SRGBColorSpace;backdropTexture.wrapS=THREE.MirroredRepeatWrapping;backdropTexture.repeat.x=6;
 const backdrop=new THREE.Mesh(new THREE.SphereGeometry(140,96,40),new THREE.MeshBasicMaterial({map:backdropTexture,side:THREE.BackSide,fog:false,color:0xbba0aa}));
 backdrop.name='upside-down-photo';backdrop.position.y=0;world.add(backdrop);
 const vineMaterial=new THREE.MeshStandardMaterial({color:0x69404c,roughness:.9});
 const growth=new THREE.Group();growth.name='upside-down-growth';world.add(growth);
 function tendril(points,radius){const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,radius,5,false),vineMaterial);growth.add(mesh);return mesh;}
 // Attach roots to existing walls so the chase paths stay passable.
 for(const b of colliders){
  for(let j=0;j<3;j++){
   const x=b.x+(j-1)*b.w*.28,z=b.z+b.d/2+.16;
   tendril([new THREE.Vector3(x+1,.06,z+1),new THREE.Vector3(x,.6,z),new THREE.Vector3(x-.5,b.h*.5,z),new THREE.Vector3(x+.4,b.h,z)],.09);
  }
 }
 // Low roots and stones lie directly along the chase routes.
 const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x40303c,roughness:1}),120);stones.name='upside-down-ground-stones';
 const pebble=new THREE.Object3D();
 for(let i=0;i<120;i++){
  const x=Math.sin(i*7.31)*65,z=Math.cos(i*3.17)*65;
  pebble.position.set(x,.04,z);pebble.scale.set(.12+(i%4)*.08,.07+(i%3)*.035,.18+(i%5)*.05);pebble.rotation.set(i,.3*i,0);pebble.updateMatrix();stones.setMatrixAt(i,pebble.matrix);
  if(i%3===0&&!solid(x,z,2,0))tendril([new THREE.Vector3(x-2,.04,z),new THREE.Vector3(x-.5,.11,z+.5),new THREE.Vector3(x+1,.08,z-.4),new THREE.Vector3(x+2,.03,z+.2)],.07);
 }
 world.add(stones);
 // Bare trees outside the playable boundary add depth against the photographed forest.
 for(let i=0;i<28;i++){
  const a=i/28*Math.PI*2,x=Math.sin(a)*86,z=Math.cos(a)*86,h=8+(i%5)*1.4;
  tendril([new THREE.Vector3(x,0,z),new THREE.Vector3(x+.4,h*.5,z),new THREE.Vector3(x-.7,h,z+.4)],.24);
  for(let j=0;j<4;j++){
   const direction=a+j*2.4,dx=Math.sin(direction),dz=Math.cos(direction),y=h*(.35+j*.12);
   const end=new THREE.Vector3(x+dx*4,y+3,z+dz*4);
   tendril([new THREE.Vector3(x,y,z),new THREE.Vector3(x+dx*2,y+.7,z+dz*2),end],.09);
   tendril([end.clone().add(new THREE.Vector3(-dx*1.5,-1.3,-dz*1.5)),end.clone().add(new THREE.Vector3(dz,1,-dx))],.045);
  }
 }
 for(let i=0;i<38;i++){
  const x=Math.sin(i*4.7)*60,z=Math.cos(i*2.7)*60;
  const pts=[new THREE.Vector3(x,.1,z),new THREE.Vector3(x+3,.4,z-3),new THREE.Vector3(x-1,3,z-5),new THREE.Vector3(x+2,6,z-7)];world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.12,6,false),vineMaterial));
 }
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(600*3);for(let i=0;i<600;i++){positions[i*3]=(Math.random()-.5)*136;positions[i*3+1]=Math.random()*25;positions[i*3+2]=(Math.random()-.5)*136;}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const spores=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xe9b7c9,size:.09,transparent:true,opacity:.7}));world.add(spores);
 const view=new THREE.PerspectiveCamera(65,1,.05,300),observer=new THREE.PerspectiveCamera(55,1,.1,200);world.add(view);const claws=PolarityWorld.hands(view);applyGlove(claws,'vecna');claws.pistol.visible=false;
 const clock=new THREE.Group();world.add(clock);PolarityWorld.box(clock,0,1.6,0,1.2,3.2,.5,0x382337);
 const face=new THREE.Mesh(new THREE.CircleGeometry(.48,32),new THREE.MeshBasicMaterial({color:0xd49caa}));face.position.set(0,2.4,.27);clock.add(face);PolarityWorld.box(clock,0,2.55,.29,.035,.3,.02,0x231426);PolarityWorld.box(clock,.13,2.4,.3,.26,.035,.02,0x231426);
 return {scene:world,camera:view,observer,hands:claws,spores,clock,ghosts:new Map()};
}
function beginCurse(e,saved=null){
 if(curse||!e.person||e.removed||e.safe)return false;
 if(!realm)realm=createRealm();
 let ghost=realm.ghosts.get(e.id);if(!ghost){ghost=PolarityWorld.character(realm.scene,e.modelIndex||0);PolarityWorld.label(ghost,'OFIARA',0,2.25,0,'#fff0c9',2.4);realm.ghosts.set(e.id,ghost);}for(const g of realm.ghosts.values())g.visible=false;ghost.visible=true;
 if(held){held.vx=held.vy=held.vz=0;held=null;}
 const hero=saved?{...saved.hero}:{x:player.x,y:0,z:player.z,yaw:player.yaw,pitch:player.pitch};
 if(solid(hero.x,hero.z,.35,0)){hero.x=e.x;hero.z=e.z+3;if(solid(hero.x,hero.z,.35,0)){hero.x=spawnPoint.x;hero.z=spawnPoint.z;}}
 curse={victim:e,ghost,hero,preY:saved?.preY??e.y,preAngle:e.angle,elapsed:saved?.elapsed||0,health:saved?.health??75,enemy:saved?{...saved.enemy}:{x:e.x,y:0,z:e.z},hitTime:0,strikeCooldown:0};
 if(solid(curse.enemy.x,curse.enemy.z,.38,0)){curse.enemy.x=hero.x;curse.enemy.z=hero.z;}
 curse.pose=[];e.mesh.traverse(b=>{if(b.isBone&&/^(UpperArm|LowerArm|UpperLeg|LowerLeg|Wrist|Head)/.test(b.name))curse.pose.push({bone:b,rotation:b.quaternion.clone()});});
 if(!e.curseEyes){e.curseEyes=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),new THREE.MeshBasicMaterial({color:0x100b19,transparent:true,opacity:0}));e.curseEyes.scale.set(1.2,.45,.8);e.curseEyes.position.set(0,1.66,.1);e.mesh.add(e.curseEyes);}e.curseEyes.visible=true;
 e.cursed=true;e.vx=e.vy=e.vz=0;e.frozen=0;hands.root.visible=false;
 realm.clock.position.set(hero.x-3,0,hero.z-7);document.body.classList.add('in-curse');$('curseHUD').hidden=false;releaseInputs();updateCurse(0);updateUI();syncVecnaMusic();
 if(!saved)toast('Druga Strona! Ścigaj ofiarę po prawej. Klik / F / Użyj mocy — uderz.');return true;
}
function endCurse(won=false){
 if(!curse)return;const old=curse;curse=null;const e=old.victim;e.cursed=false;e.y=old.preY;e.angle=old.preAngle;e.mesh.rotation.set(0,e.angle,0);e.mesh.position.set(e.x,e.y,e.z);old.ghost.visible=false;
 for(const p of old.pose)p.bone.quaternion.copy(p.rotation);if(e.curseEyes)e.curseEyes.visible=false;PolarityWorld.animate(e.mesh,'Idle',0);hands.root.visible=true;document.body.classList.remove('in-curse');$('curseHUD').hidden=true;syncVecnaMusic();releaseInputs();resize();
 if(won){hurt(e,75);points(50);toast('Vecna dopadł ofiarę! +50 monet. Postać odrodzi się przy starcie.');}
 else toast('Trans przerwany. Wracasz do normalnego świata.');
 updateUI();saveProgress();
}
function curseStrike(){
 if(!curse||curse.strikeCooldown>0)return;const c=curse;c.strikeCooldown=.45;
 const dx=c.enemy.x-c.hero.x,dz=c.enemy.z-c.hero.z,d=Math.hypot(dx,dz),dot=d?((dx/d)*Math.sin(c.hero.yaw)-(dz/d)*Math.cos(c.hero.yaw)):1;
 const origin=new THREE.Vector3(c.hero.x,1.66,c.hero.z),end=new THREE.Vector3(c.enemy.x,1,c.enemy.z),dir=end.clone().sub(origin).normalize();
 if(d>4.8||dot<.65||wallDistance(origin,dir,5)<origin.distanceTo(end)-.3){toast('Podejdź bliżej ofiary i wyceluj w nią po prawej.');return;}
 c.health=Math.max(0,c.health-25);c.hitTime=.3;beep(90,.15,'triangle');
 if(c.health===0)endCurse(true);
}
function updateCurse(dt){
 if(!curse)return;const c=curse,e=c.victim;if(e.removed){endCurse(false);return;}
 c.elapsed+=dt;c.strikeCooldown=Math.max(0,c.strikeCooldown-dt);c.hitTime=Math.max(0,c.hitTime-dt);
 let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stickState.x;
 let z=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stickState.y;const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;
 move(c.hero,(Math.cos(c.hero.yaw)*x+Math.sin(c.hero.yaw)*z)*dt*7,(Math.sin(c.hero.yaw)*x-Math.cos(c.hero.yaw)*z)*dt*7);
 const dx=c.enemy.x-c.hero.x,dz=c.enemy.z-c.hero.z,d=Math.hypot(dx,dz)||1;move(c.enemy,dx/d*dt*2,dz/d*dt*2,.38);
 c.ghost.position.set(c.enemy.x,0,c.enemy.z);c.ghost.rotation.y=Math.atan2(dx,dz);PolarityWorld.animate(c.ghost,c.hitTime>0?'HitRecieve':'Run',dt);
 e.y=c.preY+Math.min(2.8,c.elapsed*.6)+Math.sin(c.elapsed*2)*.08;e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.z=Math.sin(c.elapsed*1.8)*.08;e.mesh.rotation.x=-(1-c.health/75)*.22;
 PolarityWorld.animate(e.mesh,'Wave',dt);
 // Begin the contorted pose during the trance itself, intensifying with each hit.
 const bend=Math.min(1,c.elapsed/2),damage=1-c.health/75;
 const snap=at=>THREE.MathUtils.smoothstep(c.elapsed,at,at+.14);
 for(const p of c.pose){
  const b=p.bone,side=b.name.endsWith('L')?1:-1,armSnap=snap(side===1?2:3.5),legSnap=snap(side===1?5:6.5);b.quaternion.copy(p.rotation);
  if(/^UpperArm/.test(b.name)){b.rotateZ(side*bend*(.85+damage*.4));b.rotateX(-bend*.3);}
  if(/^LowerArm/.test(b.name)){b.rotateX(-bend*.25-armSnap*(1.9+damage*.25));b.rotateZ(side*armSnap*.55);}
  if(/^Wrist/.test(b.name))b.rotateX(bend*.15+armSnap*1.2);
  if(/^UpperLeg/.test(b.name)){b.rotateZ(side*bend*.2);b.rotateX(side*bend*.2);}
  if(/^LowerLeg/.test(b.name))b.rotateX(-bend*.1-legSnap*(1.65+damage*.2));
  if(b.name==='Head')b.rotateZ(bend*(.18+damage*.2));
 }
 e.curseEyes.material.opacity=damage*.9;
 realm.camera.position.set(c.hero.x,1.66,c.hero.z);realm.camera.rotation.set(c.hero.pitch,-c.hero.yaw,0,'YXZ');
 if(!c.observerPosition){
  const focus=new THREE.Vector3(e.x,c.preY+2,e.z);
  for(const offset of [0,.7,-.7,1.4,-1.4,Math.PI]){const angle=e.angle+offset,position=new THREE.Vector3(e.x+Math.sin(angle)*7,c.preY+3.7,e.z+Math.cos(angle)*7),direction=focus.clone().sub(position),distance=direction.length();if(!solid(position.x,position.z,.1,position.y)&&wallDistance(position,direction.normalize(),distance+.1)>=distance){c.observerPosition=position;break;}}
  if(!c.observerPosition)c.observerPosition=new THREE.Vector3(e.x,c.preY+8,e.z+1);
 }
 realm.observer.position.copy(c.observerPosition);realm.observer.lookAt(e.x,e.y+.9,e.z);realm.spores.rotation.y=c.elapsed*.008;
 realm.hands.left.rotation.x=-.2-c.hitTime;realm.hands.root.position.y=Math.sin(c.elapsed*4)*.012;
 $('curseHealth').textContent='Ofiara: '+c.health+'/75 · '+Math.round(d)+' m';
 if(keys.has('KeyF')||keys.has('Mouse0')||[...actionPointers.values()].some(a=>a==='use'||a==='throw'))curseStrike();
}
function renderWorld(){
 if(!curse){renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(scene,camera);return;}
 const half=Math.floor(innerWidth/2);realm.observer.aspect=half/innerHeight;realm.observer.updateProjectionMatrix();realm.camera.aspect=(innerWidth-half)/innerHeight;realm.camera.updateProjectionMatrix();
 renderer.setScissorTest(true);renderer.setViewport(0,0,half,innerHeight);renderer.setScissor(0,0,half,innerHeight);renderer.render(scene,realm.observer);
 renderer.setViewport(half,0,innerWidth-half,innerHeight);renderer.setScissor(half,0,innerWidth-half,innerHeight);renderer.render(realm.scene,realm.camera);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
}
document.getElementById('endCurse').onclick=()=>{if(mode==='play')endCurse(false);};
