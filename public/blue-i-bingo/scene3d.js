/* Real flat 3D world; official character textures animated on a flexible mesh.
   Sources and credits: assets/sources.json. Three.js: vendor/LICENSE-three.txt. */
'use strict';
window.Run3D=(()=>{
 const T=THREE, scene=new T.Scene();scene.background=new T.Color('#b9e6ef');scene.fog=new T.Fog('#b9e6ef',72,180);
 const renderer=new T.WebGLRenderer({canvas:document.getElementById('game'),antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,210);
 // The high camera looks down at a flat railway. No vertex bending or fake perspective.
 camera.position.set(0,23,20);camera.lookAt(0,0,-11);
 scene.add(new T.HemisphereLight('#e1f6ff','#9c8e79',2.6));const sun=new T.DirectionalLight('#fff2d2',2.3);sun.position.set(-18,35,16);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-24,right:24,top:35,bottom:-35,near:1,far:100});sun.shadow.bias=-.001;sun.target.position.set(0,0,-12);scene.add(sun,sun.target);
 const matCache=new Map(),boxGeo=new T.BoxGeometry(1,1,1),sphereGeo=new T.SphereGeometry(1,10,8),cylinderGeo=new T.CylinderGeometry(1,1,1,12);
 function mat(color){if(!matCache.has(color))matCache.set(color,new T.MeshStandardMaterial({color,roughness:.82}));return matCache.get(color)}
 function box(parent,w,h,d,x,y,z,color){const m=new T.Mesh(boxGeo,mat(color));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 function ball(parent,x,y,z,sx,sy,sz,color){const m=new T.Mesh(sphereGeo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m}
 function cylinder(parent,r,h,x,y,z,color){const m=new T.Mesh(cylinderGeo,mat(color));m.scale.set(r,h,r);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
 function label(text,bg='#245475',fg='#fff6da',w=512,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.font='900 '+Math.floor(h*.55)+'px Trebuchet MS';x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2,w*.93);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:texture})}
 function sign(parent,text,x,y,z,w=4,h=.85,bg){const m=new T.Mesh(new T.PlaneGeometry(w,h),label(text,bg));m.position.set(x,y,z);parent.add(m);return m}
 const ground=box(scene,180,.5,280,0,-.53,-100,'#a9d98e');ground.castShadow=false;
 box(scene,11,.25,260,0,-.22,-105,'#8e9696');
 for(let lane=-1;lane<=1;lane++){
  box(scene,2.7,.12,260,lane*3,-.035,-105,'#667a80');
  for(let side of [-1,1]){box(scene,.11,.15,260,lane*3+side*.86,.12,-105,'#d6e2e2');box(scene,.22,.07,260,lane*3+side*.86,.05,-105,'#596571')}
 }
 for(const side of [-1,1]){box(scene,3.6,.38,260,side*7.2,-.03,-105,'#e8c4a0');box(scene,.25,.52,260,side*5.3,.04,-105,'#fce4b7');box(scene,.14,.06,260,side*5.65,.19,-105,'#fff5d0')}
 // Instanced sleepers are translated on the ground plane, always at exactly the same height.
 const ties=new T.InstancedMesh(boxGeo,mat('#a88e70'),240),dummy=new T.Object3D();ties.receiveShadow=true;scene.add(ties);
 const markings=new T.InstancedMesh(boxGeo,mat('#d6b996'),100);scene.add(markings);
 // Batch repeated solid meshes to keep the high view smooth on integrated GPUs.
 function batch(g){const groups=new Map();for(const m of [...g.children]){if(!m.isMesh||m.geometry.type==='PlaneGeometry')continue;const key=m.geometry.uuid+':'+m.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)}for(const meshes of groups.values()){if(meshes.length<2)continue;const inst=new T.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);meshes.forEach((m,i)=>{m.updateMatrix();inst.setMatrixAt(i,m.matrix);g.remove(m)});inst.castShadow=true;inst.receiveShadow=true;g.add(inst)}}
 const blocks=[];
 for(let i=0;i<16;i++){
  const g=new T.Group();scene.add(g);blocks.push(g);
  for(const side of [-1,1]){
   const color=['#f4b897','#e6c570','#9ecddd','#c4b5dd','#efaa9e','#a8d5b3'][(i+(side===1?2:0))%6],height=4.3+(i%4)*1.4,x=side*(11.3+(i%2)*1.2);
   box(g,5.3,height,10,x,height/2,0,color);box(g,5.65,.4,10.4,x,height+.08,0,'#f8e5ca');box(g,5.1,.22,9.8,x,height+.38,0,'#b37562');
   for(let k=0;k<3;k++)for(let floor=0;floor<Math.floor(height/2);floor++){
    box(g,.06,1.05,1.25,x-side*2.69,1.5+floor*1.85,-3.2+k*3.1,'#eef1d6');box(g,.07,.78,.99,x-side*2.74,1.5+floor*1.85,-3.2+k*3.1,'#478ba5');
   }
   for(let k=0;k<3;k++)box(g,1,1.1,.06,x-1.6+k*1.6,2,5.04,'#4b8398');
   const awning=box(g,1.35,.14,3.9,x-side*3.18,2.35,1,'#db6f66');awning.rotation.z=side*.15;
   for(let k=0;k<5;k++)box(g,1.37,.16,.3,x-side*3.18,2.36,-.55+k*.75,'#ffe5bb');
   if(i%3===0){sign(g,['BLUEY TOWN','BINGO PARK','BRISBANE'][i%3],x,3.5,5.06,4.2,.8,'#2e6874')}
   // Trees and station furniture leave the three lanes unobstructed.
   cylinder(g,.14,2.4,side*7.6,1.2,-3,'#a8794f');ball(g,side*7.6,3.2,-3,1.2,1.5,1.2,'#43aa7f');ball(g,side*7.25,3.7,-3.1,.9,1.1,.9,'#62bd87');
   cylinder(g,.065,4.5,side*6.15,2.3,3.5,'#356477');box(g,.9,.15,.45,side*5.83,4.6,3.5,'#f9df9d');
   box(g,.5,.35,1.8,side*7,.5,2,'#b37555');box(g,.15,.85,1.8,side*7.25,.8,2,'#c28e61');
  }
 }
 blocks.forEach(batch);
 const gateways=[];for(let i=0;i<3;i++){const g=new T.Group();scene.add(g);gateways.push(g);for(const side of [-1,1]){box(g,.36,5.7,.45,side*5.05,2.85,0,'#508698');box(g,.72,.2,.85,side*5.05,.15,0,'#eddec0')}box(g,10.5,.32,.5,0,5.6,0,'#76a5b1');box(g,5.1,1,.25,0,5.7,.2,'#275976');sign(g,i===1?'BINGO PARK':'BLUEY STATION',0,5.7,.34,4.8,.8);}
 gateways.forEach(batch);
 function shoes(g,scale=1){
  for(const side of [-1,1]){const boot=new T.Group();boot.position.x=side*.36;g.add(boot);box(boot,.48,.32,.78,0,.22,.06,'#fa6355');box(boot,.5,.1,.83,0,.07,.06,'#ffeab1');box(boot,.36,.37,.38,0,.51,-.11,'#ffd24e');for(let i=0;i<3;i++)box(boot,.3,.04,.045,0,.4,.04+i*.12,'#ffffff');}
  g.scale.setScalar(scale);
 }
 function pack(g,flames=false){
  box(g,.95,.85,.32,0,1.05,0,'#ee744f');
  for(const side of [-1,1]){cylinder(g,.23,1.25,side*.57,1.1,0,'#82dce8');ball(g,side*.57,1.75,0,.23,.2,.23,'#ffda59');cylinder(g,.28,.25,side*.57,.42,0,'#3d6586');if(flames){const f=ball(g,side*.57,.05,0,.18,.48,.18,'#ff9a36');f.userData.flame=true;const core=ball(g,side*.57,.18,.04,.1,.3,.1,'#fff1a0');core.userData.flame=true;}}
 }
 function obstacle(type){const g=new T.Group();g.userData.type=type;
  if(type==='train'){
   box(g,2.48,2.5,8,0,1.65,-4,'#e8b947');box(g,2.58,.3,8.1,0,3,-4,'#faf1c9');box(g,2.5,.43,8.05,0,.7,-4,'#397f9d');box(g,2.25,.35,8,0,.32,-4,'#354d62');
   box(g,2.2,.9,.07,0,2.28,.045,'#2b526a');for(const side of [-1,1]){box(g,.92,.72,.075,side*.53,2.29,.09,'#8de1ed');box(g,.38,.22,.12,side*.81,1.15,.09,'#fff9c5');box(g,.075,1,7.4,side*1.26,2.13,-4,'#315a70');for(let j=0;j<5;j++)box(g,.09,.75,1.1,side*1.31,2.15,-.95-j*1.45,'#86d9e6');for(let j=0;j<2;j++){const wheel=cylinder(g,.37,.18,side*1.17,.36,-1.2-j*5.6,'#293f52');wheel.rotation.z=Math.PI/2}}
   box(g,2.4,.18,.12,0,1.51,.1,'#f07862');box(g,1,.16,.12,0,.68,.15,'#182e41');sign(g,'BRISBANE',0,2.89,.11,1.5,.18);
   for(let j=0;j<3;j++)box(g,1.2,.18,.65,0,3.22,-2-j*1.8,'#b9c8c4');
  }else if(type==='barrier'||type==='arch'){
   const high=type==='arch';for(const side of [-1,1]){box(g,.14,high?2.9:1.05,.2,side*1.1,high?1.45:.525,0,'#f4e5c5');box(g,.5,.12,.8,side*1.1,.08,0,'#506773')}
   box(g,2.5,high?1.2:.62,.24,0,high?2.3:.85,0,'#f47758');
   for(let i=0;i<7;i++){let m=box(g,.19,high?1.17:.58,.015,-1.02+i*.34,high?2.3:.85,.129,'#fff4d5');m.rotation.z=-.32}
   if(high)sign(g,'↓  ŚLIZG',0,2.42,.15,1.5,.4,'#2d6884');
  }else if(type==='coin'){
   const coin=cylinder(g,.34,.1,0,.75,0,'#ffce46');coin.rotation.x=Math.PI/2;g.userData.spin=coin;
   const face=new T.Mesh(new T.TorusGeometry(.24,.025,6,16),mat('#fff0a0'));face.position.set(0,.75,.062);g.add(face);const mark=box(g,.06,.29,.02,0,.75,.072,'#fff0a0');
  }else if(type==='boots'){shoes(g,1.4);sign(g,'BUTY ↑',0,1.25,.15,1.4,.4,'#b64749');
  }else if(type==='jetpack'){pack(g);g.rotation.x=-Math.PI/2;g.position.y=.5;
  }else if(type==='ramp'){
   const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute([-1.25,.07,0,1.25,.07,0,-1.25,1.35,-5,1.25,.07,0,1.25,1.35,-5,-1.25,1.35,-5],3));geom.computeVertexNormals();const surface=new T.Mesh(geom,new T.MeshStandardMaterial({color:'#38cda8',side:T.DoubleSide}));surface.receiveShadow=true;g.add(surface);for(const side of [-1,1]){const rail=box(g,.1,.15,5.16,side*1.24,.75,-2.5,'#ffe26e');rail.rotation.x=.25;}for(let i=0;i<3;i++){const arrow=sign(g,'↑',0,.35+i*.34,-1-i*1.25,.7,.8,'#209780');arrow.rotation.x=-Math.PI/2+.25;}
  }else{
   const orb=ball(g,0,1.15,0,.55,.55,.55,type==='shield'?'#76edcf':'#ee8bd5');g.userData.orb=orb;
   sign(g,type==='shield'?'★':'U',0,1.16,.56,.6,.6,type==='shield'?'#39a68f':'#a24598');
  }
  if(type==='train'||type==='barrier'||type==='arch')batch(g);scene.add(g);return g;
 }
 const pools={train:[],barrier:[],arch:[],coin:[],shield:[],magnet:[],boots:[],jetpack:[],ramp:[]};
 const images={},textures={};const loading=Object.entries(window.CHARACTER_ART).map(([id,src])=>new Promise(resolve=>{const img=new Image();img.onload=()=>{images[id]=img;const texture=new T.Texture(img);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;textures[id]=texture;resolve()};img.onerror=()=>resolve();img.src=src}));
 let isReady=false;Promise.all(loading).then(()=>{isReady=true;document.dispatchEvent(new Event('charactersready'))});
 function makeActor(){
  const geometry=new T.PlaneGeometry(1,1,24,32);geometry.translate(0,.5,0);
  const m=new T.Mesh(geometry,new T.MeshBasicMaterial({transparent:true,alphaTest:.03,depthWrite:false,side:T.DoubleSide}));
  m.userData.rest=Float32Array.from(geometry.attributes.position.array);m.frustumCulled=false;scene.add(m);return m;
 }
 const hero=makeActor(),chaser=makeActor();
 const shadowMaterial=new T.MeshBasicMaterial({color:'#263c56',transparent:true,opacity:.2,depthWrite:false});function shadow(){const m=new T.Mesh(new T.CircleGeometry(.65,24),shadowMaterial);m.rotation.x=-Math.PI/2;m.position.y=.22;scene.add(m);return m}const heroShadow=shadow(),adultShadow=shadow();
 const shield=new T.Mesh(new T.SphereGeometry(1,20,12),new T.MeshBasicMaterial({color:'#73f1dc',transparent:true,opacity:.17,depthWrite:false}));scene.add(shield);
 const ring=new T.Mesh(new T.TorusGeometry(.78,.045,8,32),new T.MeshBasicMaterial({color:'#ffdc52'}));ring.rotation.x=-Math.PI/2;ring.position.y=.24;scene.add(ring);
 const wornBoots=new T.Group(),wornPack=new T.Group();shoes(wornBoots);pack(wornPack,true);scene.add(wornBoots,wornPack);
 function actor(s,id,height,x,z,jump,phase,slide,running=true,flying=false){
  const img=images[id];if(!img){s.visible=false;return}s.visible=true;
  if(s.userData.id!==id){s.material.map=textures[id];s.material.needsUpdate=true;s.userData.id=id}
  const squish=slide?.48:1;s.scale.set(height*img.width/img.height*(slide?1.12:1),height*squish,1);
  s.position.set(x,.22+jump+(running&&!flying?Math.abs(Math.sin(phase))*.12:Math.sin(phase*.3)*.025),z);
  s.quaternion.copy(camera.quaternion);s.rotateZ(slide?-.32:Math.sin(phase)*(flying?.025:running?.045:.008));
  const pos=s.geometry.attributes.position,rest=s.userData.rest;
  for(let i=0;i<pos.count;i++){
   const bx=rest[i*3],by=rest[i*3+1],side=bx<0?-1:1,step=Math.sin(phase+ (side<0?Math.PI:0));
   const leg=1-T.MathUtils.smoothstep(by,.02,.3),arm=T.MathUtils.smoothstep(Math.abs(bx),.16,.34)*(1-T.MathUtils.smoothstep(by,.68,.78))*T.MathUtils.smoothstep(by,.25,.4);
   const motion=running&&!slide&&!flying?1:0;
   pos.setXYZ(i,bx+motion*(leg*step*.045+arm*step*.018),by+motion*(leg*Math.max(0,step)*.068+arm*step*.03),0);
  }
  pos.needsUpdate=true;
 }
 function portrait(c,id){const image=images[id],x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);if(!image)return;const scale=Math.min(c.width/image.width,c.height/image.height);x.drawImage(image,(c.width-image.width*scale)/2,c.height-image.height*scale,image.width*scale,image.height*scale)}
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<600?59:48;camera.updateProjectionMatrix()}
 resize();
 function render({mode,time,run,kid,adult}){
  const active=run&&['play','pause','over'].includes(mode),distance=active?run.distance:time*9;
  for(let i=0;i<240;i++){const lane=i%3-1,z=16-Math.floor(i/3)*2.7+(distance%2.7);dummy.position.set(lane*3,.04,z);dummy.scale.set(2.32,.1,.32);dummy.updateMatrix();ties.setMatrixAt(i,dummy.matrix)}ties.instanceMatrix.needsUpdate=true;
  for(let i=0;i<100;i++){const side=i%2?1:-1,z=18-Math.floor(i/2)*4.3+distance%4.3;dummy.position.set(side*7.2,.18,z);dummy.scale.set(3.3,.016,.04);dummy.updateMatrix();markings.setMatrixAt(i,dummy.matrix)}markings.instanceMatrix.needsUpdate=true;
  blocks.forEach((g,i)=>g.position.z=20-i*13+distance%13);gateways.forEach((g,i)=>g.position.z=24-i*58+distance%58);
  const used={train:0,barrier:0,arch:0,coin:0,shield:0,magnet:0,boots:0,jetpack:0,ramp:0};const items=active?run.items:[{type:'train',lane:-1,z:26},{type:'train',lane:1,z:44},...Array.from({length:10},(_,i)=>({type:'coin',lane:0,z:5+i*3.5}))];
  for(const o of items){if(o.hit||o.z>125||o.z<-(o.length||10))continue;const list=pools[o.type];if(!list)continue;const idx=used[o.type]++;if(!list[idx])list[idx]=obstacle(o.type);const m=list[idx];m.visible=true;m.position.set(o.lane*3,o.y||0,3-o.z);if(o.type==='train')m.scale.z=(o.length||8)/8;if(o.type==='jetpack')m.position.y=.4;if(o.type==='coin'){m.rotation.y=time*2.5;m.position.y=(o.y||0)+Math.sin(time*4+o.z*.1)*.07}if(m.userData.orb)m.userData.orb.scale.setScalar(.55+Math.sin(time*5)*.035)}
  Object.entries(pools).forEach(([type,list])=>list.forEach((m,i)=>{if(i>=used[type])m.visible=false}));
  const x=active?run.x*3:0,jump=active?run.jump+(run.flight||0):0,slide=active&&run.slide>0,phase=time*(active?16:2);
  actor(hero,kid,3.9,x,0,jump,phase,slide,active&&mode!=='over',active&&run.jetpack>0);actor(chaser,adult,4.1,x+.95,mode==='over'?1.4:5.5,0,phase+1,false,active&&mode!=='over');
  wornBoots.visible=!!(active&&run.boots>0);wornBoots.position.set(x,.22+jump,.35);wornBoots.children.forEach((b,i)=>b.position.y=Math.max(0,Math.sin(phase+i*Math.PI))*.19);
  wornPack.visible=!!(active&&(run.jetpack>0||run.flight>.15));wornPack.position.set(x,1.1+jump,-.15);wornPack.children.forEach(f=>{if(f.userData.flame)f.scale.y=.3+Math.abs(Math.sin(time*35))*.35;});
  heroShadow.position.x=x;heroShadow.position.z=.1;heroShadow.scale.set(1+Math.min(jump*.15,.3),1,1);adultShadow.position.x=x+.95;adultShadow.position.z=chaser.position.z;
  shield.visible=!!(active&&run.shield>0);shield.position.set(x,1.7+jump,-.3);shield.scale.set(1.45,2.2,1.1);
  ring.visible=!!(active&&run.magnet>0);ring.position.x=x;ring.scale.setScalar(1+Math.sin(time*6)*.1);
  if(active&&run.invincible>0)hero.visible=Math.floor(time*14)%2===0;
  renderer.render(scene,camera);
 }
 return {render,resize,portrait,ready:()=>isReady,renderer,scene,camera,images,pools,hero,chaser,wornBoots,wornPack};
})();
