'use strict';
const PolarityWorld = (() => {
 const materials=new Map(), shapes=new Map(), cube=new THREE.BoxGeometry(1,1,1), sphere=new THREE.SphereGeometry(1,16,12);
 const bounds={x:68,z:68};
 let templates;
 function material(color,metalness=0,roughness=.75){const k=[color,metalness,roughness].join(':');if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color,metalness,roughness}));return materials.get(k);}
 function mesh(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(parent,x,y,z,w,h,d,color){return mesh(parent,cube,material(color),x,y,z,w,h,d);}
 function round(parent,x,y,z,w,h,d,color,r=.08){
  const key=[w,h,d,r].join(':');if(!shapes.has(key)){
   const shape=new THREE.Shape(),a=-w/2,b=-h/2;shape.moveTo(a+r,b);shape.lineTo(a+w-r,b);shape.quadraticCurveTo(a+w,b,a+w,b+r);shape.lineTo(a+w,b+h-r);shape.quadraticCurveTo(a+w,b+h,a+w-r,b+h);shape.lineTo(a+r,b+h);shape.quadraticCurveTo(a,b+h,a,b+h-r);shape.lineTo(a,b+r);shape.quadraticCurveTo(a,b,a+r,b);
   const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.01,d-2*r),bevelEnabled:true,bevelSize:r*.4,bevelThickness:r,bevelSegments:3,curveSegments:6,steps:1});g.center();shapes.set(key,g);
  }return mesh(parent,shapes.get(key),material(color,.15,.5),x,y,z);
 }
 function label(parent,text,x,y,z,color='#ecfaf8',width=4){
  const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#193845';ctx.fillRect(0,0,512,96);ctx.font='bold 40px Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,50,490);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t}));sp.scale.set(width,width*96/512,1);sp.position.set(x,y,z);parent.add(sp);return sp;
 }
 async function load(){
  const loader=new CityGLTF.GLTFLoader();templates=await Promise.all(['casual','hoodie','worker'].map(name=>loader.loadAsync('assets/'+name+'.glb')));
 }
 function character(scene,type=0){
  const template=templates[type%templates.length],root=new THREE.Group(),model=CitySkeleton.clone(template.scene);
  model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model,true),height=bounds.max.y-bounds.min.y;const normalized=new THREE.Group();normalized.scale.setScalar(1.85/height);normalized.position.y=-bounds.min.y*(1.85/height);normalized.add(model);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});root.add(normalized);scene.add(root);
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of template.animations)if(['Idle','Walk','Run','HitRecieve','Death','Wave'].includes(clip.name)){actions[clip.name]=mixer.clipAction(clip);if(['Death','HitRecieve'].includes(clip.name)){actions[clip.name].setLoop(THREE.LoopOnce,1);actions[clip.name].clampWhenFinished=true;}}
  root.userData={mixer,actions,current:null,model};animate(root,'Idle',0);return root;
 }
 function animate(root,name,dt){const data=root.userData,action=data.actions[name]||data.actions.Idle;if(data.current!==action){if(data.current)data.current.fadeOut(.15);action.reset().fadeIn(.15).play();data.current=action;}data.mixer.update(dt);}
 function object(scene,type,color=0x507989){const g=new THREE.Group();
  if(type==='crate'){round(g,0,.55,0,1.1,1.1,1.1,color);for(const x of [-.43,.43])box(g,x,.56,.57,.055,.86,.04,0xa9c4ca);box(g,0,.82,.58,.42,.08,.025,0x89e2dd);}
  else if(type==='cell'){mesh(g,new THREE.CylinderGeometry(.25,.25,.8,24),material(0x263a43,.65,.3),0,.45,0);mesh(g,new THREE.CylinderGeometry(.27,.27,.45,24),new THREE.MeshStandardMaterial({color:0x6bddd5,emissive:0x207a72,emissiveIntensity:.7}),0,.45,0);}
  else if(type==='beam'){round(g,0,.35,0,4.4,.6,.7,0x536878);for(const x of [-1.8,1.8])round(g,x,.36,0,.2,.7,.8,0xe7b665);}
  else if(type==='bench'){round(g,0,.55,0,2.6,.16,.7,0x916c4d);round(g,0,1.0,-.26,2.6,.55,.12,0x916c4d);for(const x of [-1,1])box(g,x,.25,0,.11,.5,.6,0x3d565c);}
  else {mesh(g,new THREE.CylinderGeometry(.42,.42,1.2,20),material(color,.5,.4),0,.6,0);round(g,0,1.24,0,.65,.1,.65,0x82959b);}
  scene.add(g);return g;
 }
 function hands(camera){const root=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group();root.add(left,right);left.position.set(-.36,-.36,-.57);right.position.set(.37,-.34,-.57);
  for(const [group,color] of [[left,0x64d5d3],[right,0xe99072]]){
   const arm=mesh(group,new THREE.CapsuleGeometry(.083,.38,6,16),material(0x263a48),0,-.16,.16);arm.rotation.x=.65;
   mesh(group,sphere,material(0x364c58,.4,.4),0,.03,0,.11,.055,.145);
   for(let i=0;i<4;i++){const finger=mesh(group,new THREE.CapsuleGeometry(.022,.12,4,10),material(0x3e5662,.25,.5),(i-1.5)*.043,.035,-.15);finger.rotation.x=Math.PI/2;}
   const thumb=mesh(group,new THREE.CapsuleGeometry(.028,.075,4,10),material(0x3e5662),-.1,.02,-.015);thumb.rotation.z=.7;
   const plate=round(group,0,.09,.015,.14,.04,.16,color,.015);plate.material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.3,roughness:.35});
  }
  const pistol=new THREE.Group();round(pistol,0,.16,-.17,.14,.16,.46,0x34424e,.025);round(pistol,0,.015,-.025,.12,.27,.13,0x1d2a31,.025);round(pistol,0,.255,-.15,.08,.035,.33,0x8a9ba2,.008);right.add(pistol);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});camera.add(root);return {root,left,right,pistol};
 }
 function create(scene){
  scene.background=new THREE.Color(0xb7d6e1);scene.fog=new THREE.Fog(0xb7d6e1,80,200);scene.add(new THREE.HemisphereLight(0xe1f5ff,0x738b81,2));
  const sun=new THREE.DirectionalLight(0xffead2,2.8);sun.position.set(-20,40,24);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:95});sun.shadow.normalBias=.035;scene.add(sun);
  const colliders=[];const ground=box(scene,0,-.16,0,144,.3,144,0xa1b9ac);ground.castShadow=false;
  box(scene,0,-.005,8,75,.08,12,0x53656b).castShadow=false;box(scene,0,0,-7,35,.12,22,0xc5c8b9).castShadow=false;
  for(let z=-20;z<21;z+=3)for(let x=-17;x<18;x+=3){if(z>2&&z<15)continue;box(scene,x,.08,z,2.97,.02,.035,0xb7bcb0).castShadow=false;}
  for(let x=-32;x<35;x+=6)box(scene,x,.06,8,3,.03,.15,0xf2e3b5);
  const defs=[[-29,-10,16,15,14,0xd2b7a0],[-29,12,16,17,12,0xaac6c9],[29,-10,16,15,18,0xdccbb2],[29,12,16,17,11,0xb5b9ce],[-13,-29,24,12,15,0xc6c6b8],[13,-29,24,12,11,0xcaa995]];
  // Outer streets connect the original square to the new neighborhoods.
  for(const x of [-43,43])box(scene,x,.015,0,10,.08,136,0x53656b).castShadow=false;
  for(const z of [-42,32,57])box(scene,0,.02,z,136,.08,9,0x53656b).castShadow=false;
  for(let n=-63;n<=63;n+=6){
   for(const x of [-43,43])box(scene,x,.07,n,.15,.03,3,0xf2e3b5);
   for(const z of [-42,32,57])box(scene,n,.08,z,3,.03,.15,0xf2e3b5);
  }
  for(const x of [-57,57])for(const z of [-55,-25,4,43])defs.push([x,z,14,16,12+(Math.abs(z)%4)*3,0xb8c8ce]);
  for(const x of [-24,0,24])defs.push([x,-56,18,14,14+Math.abs(x)/4,0xd2b7a0]);
  box(scene,0,.06,44,65,.12,14,0x789c73).castShadow=false;
  box(scene,0,.14,44,65,.04,3,0xd3c6ac).castShadow=false;
  label(scene,'PARK POLARITY',0,4,44,'#a8efb7',6);
  for(const x of [-27,-15,15,27])for(const z of [39,49]){
   mesh(scene,new THREE.CylinderGeometry(.2,.3,3,10),material(0x77624d),x,1.5,z);
   mesh(scene,sphere,material(0x688e68),x,4,z,2,2.4,2);
  }
  // A visible boundary keeps the playable area easy to recognize from the air.
  for(const x of [-69,69])box(scene,x,.5,0,1,1,140,0x9bafa9);
  for(const z of [-69,69])box(scene,0,.5,z,140,1,1,0x9bafa9);
  for(const [x,z,w,d,h,color] of defs){box(scene,x,h/2,z,w,h,d,color);colliders.push({x,z,w:w+.3,d:d+.3,h:h+.4});round(scene,x,h+.2,z,w+.3,.3,d+.3,0xe6e4d6,.1);
   for(let y=3;y<h-1;y+=3.1)for(let off=-w/2+2;off<w/2-1;off+=3.4){const window=box(scene,x+off,y,z+d/2+.05,1.8,1.9,.07,0x577e8b);window.material=material(0x577e8b,.35,.3);box(scene,x+off,y-1,z+d/2+.15,2.05,.12,.3,0xe3e0d2);box(scene,x+off,y,z+d/2+.1,.055,1.9,.05,0xc6d1d0);}
   for(let y=3;y<h-1;y+=3.1)for(let off=-d/2+2;off<d/2-1;off+=3.4)for(const sign of [-1,1]){box(scene,x+sign*(w/2+.05),y,z+off,.07,1.8,1.8,0x577e8b);box(scene,x+sign*(w/2+.15),y-.97,z+off,.3,.12,2,0xe4e1d2);}
  }
  for(const [x,z,color,text] of [[-21,-8,0x417475,'KAWIARNIA'],[21,-8,0xd6a866,'WARSZTAT']]){round(scene,x,3,z,1.5,.25,6,color,.1);label(scene,text,x+(x<0?1:-1),3.4,z,'#fff1cf',4);}
  for(const x of [-18,18])for(const z of [-17,19]){
   mesh(scene,new THREE.CylinderGeometry(.17,.25,3,12),material(0x77624d),x,1.5,z);
   for(let i=0;i<6;i++)mesh(scene,sphere,material([0x688e68,0x759c72,0x86a77b][i%3]),x+Math.sin(i*2.4)*.9,3.9+i%2*.5,z+Math.cos(i*2.4)*.8,1.15,1.3,1.05);
   round(scene,x,.3,z,3.3,.6,3.3,0xb8b5a6,.2);colliders.push({x,z,w:3.3,d:3.3,h:.6});
  }
  for(const x of [-18,18])for(const z of [-5,10]){mesh(scene,new THREE.CylinderGeometry(.065,.09,5,10),material(0x425c64,.5),x,2.5,z);round(scene,x,5,z,.6,.12,.6,0xe4dcc2,.04);}
  function zone(x,z,color,text){const ring=new THREE.Mesh(new THREE.RingGeometry(2.2,2.4,48),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.16,z);scene.add(ring);label(scene,text,x,3.1,z,'#'+color.toString(16),4.5);}
  zone(-12,-14,0x79cfeb,'RECYKLING · 3 SKRZYNIE');zone(12,-14,0x8bd7a2,'STREFA RATUNKOWA');zone(0,-17,0xf2d284,'GENERATOR · 2 OGNIWA');
  round(scene,0,1,-19,2,2,1.2,0x395661,.15);round(scene,0,1.35,-18.32,1.2,.65,.08,0x6cb4b8,.05);
  // Batch all static meshes while keeping the imported animated characters separate.
  const batches=new Map();for(const m of [...scene.children])if(m.isMesh){const key=m.geometry.uuid+m.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);}
  for(const list of batches.values()){if(list.length<2)continue;const batch=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);scene.remove(m);});batch.castShadow=list.some(m=>m.castShadow);batch.receiveShadow=true;batch.computeBoundingSphere();scene.add(batch);}
  return colliders;
 }
 return {bounds,load,character,animate,create,object,hands,material,round,box,label};
})();
