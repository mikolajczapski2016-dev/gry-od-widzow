'use strict';
// Locally stored photographic surfaces and smooth, articulated game models.
const CityVisuals = (() => {
 const mats = new Map(), geometry = new Map();
 let concrete, asphalt, paving, cloth, glass, rubber, metal, shadowTexture, foliage;
 const sphere = new THREE.SphereGeometry(1, 16, 12);
 const unitBox = new THREE.BoxGeometry(1, 1, 1);
 function mat(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({color, roughness: .85, ...options}));
  return mats.get(key);
 }
 function canvasTexture(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
 }
 function init(renderer, scene, changed) {
  const loader = new THREE.TextureLoader();
  function photo(path, repeat) {
   const t = loader.load(path, changed, undefined, () => { console.warn('Nie wczytano tekstury: ' + path); changed(); });
   t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
   t.repeat.set(repeat, repeat); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  asphalt = photo('assets/asphalt_02.jpg', 4); concrete = photo('assets/concrete_wall_006.jpg', 5);
  paving = canvasTexture((ctx, s) => {
   ctx.fillStyle = '#9c9b95'; ctx.fillRect(0, 0, s, s);
   for (let y = 0; y < s; y += 64) for (let x = 0; x < s; x += 64) {
    const v = 155 + Math.floor(Math.random() * 17); ctx.fillStyle = `rgb(${v},${v},${v-4})`; ctx.fillRect(x+1,y+1,62,62);
   }
   for (let i = 0; i < 9000; i++) { ctx.fillStyle = Math.random()>.5?'#ffffff10':'#00000010';ctx.fillRect(Math.random()*s,Math.random()*s,1,1); }
  });
  cloth = canvasTexture((ctx,s) => {ctx.fillStyle='#bcbcbc';ctx.fillRect(0,0,s,s);for(let i=0;i<s;i+=3){ctx.fillStyle='#8f8f8f';ctx.fillRect(i,0,1,s);ctx.fillStyle='#ffffff45';ctx.fillRect(0,i,s,1);}}); cloth.repeat.set(3,3);
  const leafMap=canvasTexture((ctx,size)=>{
   for(let i=0;i<850;i++){
    const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*size*.47,x=size/2+Math.cos(a)*r,y=size/2+Math.sin(a)*r;
    ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.random());
    ctx.fillStyle=['#425538','#5c6d45','#718354','#394d32','#7d8c5c'][i%5];
    ctx.beginPath();ctx.ellipse(0,0,4+Math.random()*3,8+Math.random()*5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#93a17855';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();ctx.restore();
   }
  },512);
  foliage=new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.5,side:THREE.DoubleSide,roughness:1});
  shadowTexture = canvasTexture((ctx,s)=>{const gradient=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gradient.addColorStop(0,'#00000075');gradient.addColorStop(.5,'#00000040');gradient.addColorStop(1,'#00000000');ctx.fillStyle=gradient;ctx.fillRect(0,0,s,s);});
  glass = mat(0x365262,{roughness:.16,metalness:.65}); rubber=mat(0x151719,{roughness:.94});metal=mat(0x88939a,{metalness:.9,roughness:.28});
  // A subdued sky and ground reflection gives glass and paint a natural response.
  const envScene = new THREE.Scene();envScene.background = new THREE.Color(0xb6c4d0);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.MeshBasicMaterial({color:0xd6e0e5,side:THREE.BackSide}));envScene.add(dome);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:0x555a54}));floor.rotation.x=-Math.PI/2;floor.position.y=-10;envScene.add(floor);
  for(let i=0;i<12;i++){const b=new THREE.Mesh(unitBox,new THREE.MeshBasicMaterial({color:i%2?0x79818a:0xa6a8a5}));b.position.set(Math.sin(i)*40,0,Math.cos(i)*40);b.scale.set(7,12+i%5,8);envScene.add(b);}
  const generator = new THREE.PMREMGenerator(renderer);const env=generator.fromScene(envScene,.08,.1,200);scene.environment=env.texture;generator.dispose();
  envScene.traverse(o=>{if(o.isMesh){if(o.geometry!==unitBox)o.geometry.dispose();o.material.dispose();}});
 }
 function surface(color,w,h,d) {
  if(color===0x476777)return glass;
  let texture = null, repeatX=1, repeatY=1;
  if(color===0x465963){texture=asphalt;repeatX=w/3;repeatY=d/3;}
  if(color===0xb5c0b5||color===0xc0bca6){texture=paving;repeatX=w/3;repeatY=d/3;}
  const walls=[0xdfb18c,0xc2cbc3,0x7da8b4,0xd4c090,0xaeafb6,0xc78e76];
  if(walls.includes(color)&&h>4){texture=concrete;repeatX=Math.max(w,d)/4;repeatY=h/4;}
  if(!texture)return mat(color);
  const key='surface'+color+':'+repeatX+':'+repeatY;
  if(!mats.has(key)) {
   const map=texture.clone();map.repeat.set(repeatX,repeatY);
   const material=new THREE.MeshStandardMaterial({color:color===0x465963?0x757a7d:walls.includes(color)?new THREE.Color(color).lerp(new THREE.Color(0xe2ded5),.55):0xb8b6b0,map,roughness:.95,bumpMap:map,bumpScale:color===0x465963?.035:.055});
   mats.set(key,material);
  }
  return mats.get(key);
 }
 function mesh(parent, geo, material, x,y,z,sx=1,sy=1,sz=1) {
  const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 }
 function ellipsoid(parent,x,y,z,sx,sy,sz,material){return mesh(parent,sphere,material,x,y,z,sx,sy,sz);}
 function capsule(parent,x,y,z,radius,length,material) {
  const key='cap'+radius+':'+length;
  if(!geometry.has(key))geometry.set(key,new THREE.CapsuleGeometry(radius,length,5,12));
  return mesh(parent,geometry.get(key),material,x,y,z);
 }
 function rounded(parent,x,y,z,w,h,d,radius,material) {
  const key='round'+[w,h,d,radius].join(':');
  if(!geometry.has(key)) {
   const shape=new THREE.Shape(),a=-w/2,b=-h/2,r=radius;
   shape.moveTo(a+r,b);shape.lineTo(a+w-r,b);shape.quadraticCurveTo(a+w,b,a+w,b+r);shape.lineTo(a+w,b+h-r);shape.quadraticCurveTo(a+w,b+h,a+w-r,b+h);shape.lineTo(a+r,b+h);shape.quadraticCurveTo(a,b+h,a,b+h-r);shape.lineTo(a,b+r);shape.quadraticCurveTo(a,b,a+r,b);
   const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.01,d-radius*2),bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:radius/2,bevelThickness:radius,curveSegments:5});g.center();g.computeVertexNormals();geometry.set(key,g);
  }
  return mesh(parent,geometry.get(key),material,x,y,z);
 }
 function shadow(parent,x,z,w,d) {
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.x=-Math.PI/2;m.position.set(x,.325,z);parent.add(m);return m;
 }
 function person(scene,color,isPolice) {
  const g=new THREE.Group(), skin=mat(0xc59c81,{roughness:.72}),hair=mat(0x302722),shirt=new THREE.MeshStandardMaterial({color:isPolice?0x233647:color,map:cloth,roughness:.98}),pants=mat(isPolice?0x202932:0x293442);
  const torsoProfile=[[.15,0],[.18,.08],[.175,.22],[.23,.43],[.23,.5],[.12,.57]].map(p=>new THREE.Vector2(...p));
  const torso=new THREE.Mesh(new THREE.LatheGeometry(torsoProfile,20),shirt);torso.position.y=.93;torso.scale.z=.65;torso.castShadow=true;g.add(torso);
  ellipsoid(g,0,.94,0,.18,.13,.12,pants);
  capsule(g,0,1.52,0,.075,.12,skin);
  ellipsoid(g,0,1.74,.015,.135,.195,.137,skin);
  ellipsoid(g,0,1.87,-.007,.139,.105,.138,hair);
  for(const side of [-1,1]) {
   ellipsoid(g,side*.135,1.745,0,.028,.046,.027,skin);
   ellipsoid(g,side*.049,1.776,.128,.022,.012,.011,mat(0xe0d8cc));
   ellipsoid(g,side*.05,1.776,.139,.009,.01,.007,mat(0x332f2a));
  }
  ellipsoid(g,0,1.735,.143,.023,.04,.033,skin);
  ellipsoid(g,0,1.668,.115,.051,.009,.013,mat(0x8d5f50));
  const legs=[],arms=[],knees=[];
  for(const side of [-1,1]) {
   const leg=new THREE.Group();leg.position.set(side*.105,.94,0);g.add(leg);legs.push(leg);
   capsule(leg,0,-.22,0,.091,.28,pants);
   const knee=new THREE.Group();knee.position.y=-.43;leg.add(knee);knees.push(knee);
   capsule(knee,0,-.19,0,.073,.27,pants);
   ellipsoid(knee,0,-.43,.072,.092,.065,.175,mat(0x28282a));
   ellipsoid(knee,0,-.477,.07,.096,.023,.176,mat(0x8a8981));
   const arm=new THREE.Group();arm.position.set(side*.23,1.44,0);g.add(arm);arms.push(arm);
   capsule(arm,side*.027,-.16,0,.079,.19,shirt);
   const forearm=new THREE.Group();forearm.position.set(side*.03,-.31,0);forearm.rotation.x=-.13;arm.add(forearm);
   capsule(forearm,0,-.12,.005,.059,.17,isPolice?shirt:skin);
   ellipsoid(forearm,0,-.275,.01,.057,.09,.044,skin);
  }
  if(isPolice){rounded(g,0,1.93,0,.3,.08,.29,.025,mat(0x172537));rounded(g,0,1.91,.14,.24,.025,.14,.012,mat(0x172537));mesh(g,unitBox,mat(0xd5b76d,{metalness:.5}),-.105,1.35,.16,.06,.08,.016);}
  g.userData={legs,arms,knees};shadow(g,0,0,1.1,.85);scene.add(g);return g;
 }
 function animatePerson(g,walking,phase,punch=0,shoot=0) {
  const swing=walking?Math.sin(phase)*.48:0;
  g.userData.legs[0].rotation.x=swing;g.userData.legs[1].rotation.x=-swing;
  g.userData.knees[0].rotation.x=Math.max(0,-swing)*.8;g.userData.knees[1].rotation.x=Math.max(0,swing)*.8;
  g.userData.arms[0].rotation.x=-swing*.65;g.userData.arms[1].rotation.x=swing*.65;
  if(punch>0){g.userData.arms[1].rotation.x=-Math.sin(punch*Math.PI)*1.7;g.userData.arms[0].rotation.x=-.7;}
  if(shoot>0){g.userData.arms[1].rotation.x=-1.45;g.userData.arms[0].rotation.x=-1.25;}
 }
 function car(scene,x,z,angle,color,patrol) {
  const g=new THREE.Group(),paint=mat(color,{metalness:.65,roughness:.26}),dark=mat(0x222a30,{metalness:.4,roughness:.4});
  rounded(g,0,.68,0,1.9,.49,4.3,.13,paint);
  rounded(g,0,.95,.16,1.82,.3,3.9,.10,paint);
  // Sloping bonnet, windshield, roof and rear window form one sedan silhouette.
  const profile=new THREE.Shape();profile.moveTo(-1.7,.98);profile.lineTo(-.92,1.49);profile.quadraticCurveTo(-.7,1.6,-.5,1.6);profile.lineTo(.53,1.6);profile.quadraticCurveTo(.68,1.59,.84,1.46);profile.lineTo(1.4,1.0);profile.closePath();
  const cabinGeo=new THREE.ExtrudeGeometry(profile,{depth:1.6,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,steps:1});
  const cabin=new THREE.Mesh(cabinGeo,glass);cabin.rotation.y=-Math.PI/2;cabin.position.x=.8;cabin.castShadow=true;g.add(cabin);
  rounded(g,0,1.61,-.02,1.57,.07,1.22,.03,paint);
  for(const side of [-1,1]) {
   rounded(g,side*.815,1.28,-.03,.04,.61,.085,.016,paint);
   for(const axle of [-1.28,1.28]) {
    const tire=new THREE.Mesh(new THREE.TorusGeometry(.285,.1,8,24),rubber);tire.rotation.y=Math.PI/2;tire.position.set(side*.94,.44,axle);g.add(tire);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.215,.215,.05,20),metal);rim.rotation.z=Math.PI/2;rim.position.set(side*1.025,.44,axle);g.add(rim);
    for(let spoke=0;spoke<5;spoke++){const bar=mesh(g,unitBox,dark,side*1.056,.44,axle,.015,.035,.36);bar.rotation.x=spoke*Math.PI/5;}
   }
   rounded(g,side*.98,1.18,.63,.23,.11,.24,.04,paint);
   rounded(g,side*.93,.97,-.44,.035,.045,.24,.015,metal);
   rounded(g,side*.63,.91,2.08,.43,.16,.06,.035,mat(0xdce9ef,{emissive:0x82949c,emissiveIntensity:.25,roughness:.15}));
   rounded(g,side*.67,.88,-2.08,.37,.12,.05,.025,mat(0x801814,{emissive:0x6f1610,emissiveIntensity:.4}));
  }
  rounded(g,0,.61,2.14,.95,.18,.07,.025,dark);rounded(g,0,.6,-2.14,1.72,.1,.08,.025,dark);
  rounded(g,0,.8,-2.15,.43,.12,.025,.008,mat(0xe2e0d3));
  if(patrol){rounded(g,-.32,1.78,0,.5,.12,.3,.025,mat(0x327bbb,{emissive:0x1b59dd}));rounded(g,.32,1.78,0,.5,.12,.3,.025,mat(0xb82224,{emissive:0xff2020}));}
  shadow(g,0,0,2.6,5.2);g.position.set(x,0,z);g.rotation.y=angle;scene.add(g);return {x,z,angle,speed:0,mesh:g,stolen:false,patrol};
 }
 function tree(scene,x,z) {
  const bark=mat(0x655846);capsule(scene,x,2.3,z,.16,4.3,bark);
  for(let i=0;i<5;i++){
   const angle=i*2.4,branch=capsule(scene,x+Math.sin(angle)*.4,3.6+i*.17,z+Math.cos(angle)*.4,.07,1.7,bark);branch.rotation.z=Math.sin(angle)*.7;branch.rotation.x=Math.cos(angle)*.7;
   if(!geometry.has('leaf-card'))geometry.set('leaf-card',new THREE.PlaneGeometry(3.5,3.3));
   const crown=mesh(scene,geometry.get('leaf-card'),foliage,x+Math.sin(angle)*.8,4.6+i*.15,z+Math.cos(angle)*.8);
   crown.rotation.y=angle;crown.rotation.x=(i%2?1:-1)*.35;
   const cross=crown.clone();cross.rotation.y+=Math.PI/2;scene.add(cross);

  }
  shadow(scene,x,z,5,5);
 }
 function decorateBuilding(scene,b,h,index) {
  const trim=mat(0xaaa79e),frame=mat(0x41494c,{metalness:.4,roughness:.4});
  for(let y=3;y<h-1;y+=3.4)for(let off=-8;off<=8;off+=4)for(const side of [-1,1]) {
   // Recessed frames, sills and mullions give windows actual depth.
   mesh(scene,unitBox,trim,b.x+off,y-.97,b.z+side*(b.d/2+.15),2.25,.14,.35);
   mesh(scene,unitBox,frame,b.x+off,y,b.z+side*(b.d/2+.065),.07,1.85,.09);
   mesh(scene,unitBox,trim,b.x+side*(b.w/2+.15),y-.97,b.z+off,.35,.14,2.25);
   mesh(scene,unitBox,frame,b.x+side*(b.w/2+.065),y,b.z+off,.09,1.85,.07);
  }
  // Entrance and a shopfront at street level.
  const doorX=b.x+b.w/2+.055;
  mesh(scene,unitBox,glass,doorX,1.55,b.z,.08,2.6,1.35);
  mesh(scene,unitBox,frame,doorX+.08,1.55,b.z,.06,2.7,.07);
  mesh(scene,unitBox,metal,doorX+.12,1.4,b.z+.36,.06,.35,.045);
  const canopy=mesh(scene,unitBox,mat(index%2?0x3b4b4d:0x65514a),doorX+.65,3.1,b.z,1.5,.13,3.4);canopy.castShadow=true;
  for(const off of [-5,5])mesh(scene,unitBox,glass,doorX,1.6,b.z+off,.05,2.1,3.1);
  for(let off=-8;off<=8;off+=4)mesh(scene,unitBox,trim,b.x+off,h+.8,b.z+b.d/2,.22,.5,.22);
 }
 return {init,mat,surface,person,animatePerson,car,tree,decorateBuilding,rounded,shadow,glass:()=>glass};
})();
