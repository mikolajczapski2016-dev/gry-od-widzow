'use strict';
const gloveCatalog=[
 {id:'magnet',name:'Magnetyczna',price:0,color:0x64d5d3,description:'Chwytaj ludzi i przedmioty. Rzucaj nimi i odpychaj impulsem.',symbol:'◎'},
 {id:'ice',name:'Lodowa',price:150,color:0x91dfff,description:'Zamraża trafioną postać na 5 sekund. Zadaje 15 obrażeń.',symbol:'❄'},
 {id:'storm',name:'Elektryczna',price:300,color:0xe0bcff,description:'Piorun przeskakuje na maksymalnie 3 pobliskie cele. Zadaje 30 obrażeń.',symbol:'ϟ'},
 {id:'vecna',name:'Ręka Vecny',price:2000,color:0xe48592,description:'Uderz człowieka, aby wejść do Drugiej Strony. Ścigaj go, gdy jego ciało lewituje w normalnym świecie.',symbol:'✋'}
];
let wallet=0,equippedGlove='magnet',ownedGloves=new Set(['magnet']);
function glove(){return gloveCatalog.find(g=>g.id===equippedGlove)||gloveCatalog[0];}
function updateShop(){
 $('shopWallet').textContent=wallet+' monet';
 for(const g of gloveCatalog){const b=document.querySelector('[data-glove="'+g.id+'"]');b.textContent=equippedGlove===g.id?'Założona':ownedGloves.has(g.id)?'Załóż':g.price+' monet · Kup';b.disabled=equippedGlove===g.id||(!ownedGloves.has(g.id)&&wallet<g.price);b.closest('article').classList.toggle('equipped',equippedGlove===g.id);}
}
function buyGlove(id){
 if(mode!=='shop'||curse)return;const g=gloveCatalog.find(g=>g.id===id);if(!g)return;
 if(!ownedGloves.has(id)){if(wallet<g.price)return;wallet-=g.price;ownedGloves.add(id);}
 equippedGlove=id;tool='magnet';applyGlove(hands,id);updateShop();saveProgress();beep(650,.1);
}
let vecnaSkinTexture=null;
function makeVecnaHand(parent){
 if(!vecnaSkinTexture){
  vecnaSkinTexture=new THREE.TextureLoader().load('assets/vecna-hand-reference.jpg');
  vecnaSkinTexture.colorSpace=THREE.SRGBColorSpace;
  // Use a skin-only patch of the photographed prosthetic, without its background.
  vecnaSkinTexture.repeat.set(.065,.07);vecnaSkinTexture.offset.set(.80,.66);
 }
 const group=new THREE.Group();parent.add(group);
 const skin=new THREE.MeshStandardMaterial({color:0xd5b9ad,map:vecnaSkinTexture,bumpMap:vecnaSkinTexture,bumpScale:.009,roughness:.82});
 const tendon=new THREE.MeshStandardMaterial({color:0x70535a,roughness:.85}),nail=new THREE.MeshStandardMaterial({color:0x9d8972,roughness:.6});
 function ellipsoid(position,scale,material=skin){const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),material);m.position.copy(position);m.scale.set(...scale);group.add(m);return m;}
 function tube(points,radius,tipRadius,material=skin){
  const curve=new THREE.CatmullRomCurve3(points),segments=20,sides=9,geometry=new THREE.TubeGeometry(curve,segments,radius,sides,false),vertices=geometry.attributes.position;
  for(let i=0;i<=segments;i++){const center=curve.getPointAt(i/segments),factor=1+(tipRadius/radius-1)*i/segments;for(let j=0;j<=sides;j++){const index=i*(sides+1)+j;vertices.setXYZ(index,center.x+(vertices.getX(index)-center.x)*factor,center.y+(vertices.getY(index)-center.y)*factor,center.z+(vertices.getZ(index)-center.z)*factor);}}
  geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);group.add(mesh);return curve;
 }
 ellipsoid(new THREE.Vector3(0,0,.025),[.14,.067,.20]);
 tube([new THREE.Vector3(0,-.12,.48),new THREE.Vector3(0,-.045,.28),new THREE.Vector3(0,0,.1)],.083,.09);
 const fingers=[[-.105,.34],[-.042,.45],[.026,.47],[.09,.40]];
 for(const [x,length] of fingers){
  const points=[new THREE.Vector3(x,.005,-.08),new THREE.Vector3(x*1.35,.04,-.21),new THREE.Vector3(x*1.55,.055,-length),new THREE.Vector3(x*1.6,.005,-length-.08)];
  const curve=tube(points,.033,.016);
  for(const t of [.33,.66])ellipsoid(curve.getPointAt(t),[.03,.033,.039]);
  const end=curve.getPointAt(1),direction=curve.getTangentAt(1),claw=new THREE.Mesh(new THREE.ConeGeometry(.019,.09,9),nail);claw.position.copy(end).addScaledVector(direction,.03);claw.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(claw);
  tube([new THREE.Vector3(x*.3,.068,.23),new THREE.Vector3(x,.074,-.06),new THREE.Vector3(x*1.35,.069,-.22)],.007,.004,tendon);
 }
 const thumb=tube([new THREE.Vector3(.10,-.02,.09),new THREE.Vector3(.20,0,-.005),new THREE.Vector3(.26,.025,-.12),new THREE.Vector3(.26,0,-.20)],.037,.018);
 ellipsoid(thumb.getPointAt(.5),[.036,.033,.034]);
 const claw=new THREE.Mesh(new THREE.ConeGeometry(.02,.075,9),nail),direction=thumb.getTangentAt(1);claw.position.copy(thumb.getPointAt(1)).addScaledVector(direction,.025);claw.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(claw);
 group.rotation.set(.15,-.1,-.06);
 group.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.depthTest=true;m.material.depthWrite=true;m.renderOrder=101;}});return group;
}
function applyGlove(h,id=equippedGlove){
 if(!h)return;const g=gloveCatalog.find(g=>g.id===id)||gloveCatalog[0];
 if(!h.organic)h.organic=makeVecnaHand(h.left);
 for(const m of h.left.children)m.visible=m===h.organic?id==='vecna':id!=='vecna';
 for(const root of [h.left,h.right])root.traverse(m=>{if(!m.isMesh||h.organic===m.parent||h.pistol===m.parent)return;if(m.userData.originalColor===undefined)m.userData.originalColor=m.material.color.getHex();m.material.color.set(id==='magnet'?m.userData.originalColor:g.color);});
}
function glovePower(){
 if(equippedGlove==='magnet'||held)return false;
 if(cooldown>0)return true;
 const e=aim(true,12);if(!e||!e.person){toast('Wyceluj w człowieka w zasięgu 12 metrów.');cooldown=.3;return true;}
 cooldown=.7;recoil=.25;
 if(equippedGlove==='vecna'){beginCurse(e);return true;}
 if(equippedGlove==='ice'){
  hurt(e,15);if(!e.removed){e.frozen=5;e.vx=e.vy=e.vz=0;const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0x9be5ff,transparent:true,opacity:.3,wireframe:true}));shell.scale.set(.7,1.2,.7);shell.position.copy(center(e));scene.add(shell);effects.push({mesh:shell,life:5,total:5});}
  beam(eye(),center(e),0xa9edff);toast('Zamrożenie na 5 sekund!');
 }else{
  const targets=[e,...entities.filter(o=>o!==e&&o.person&&!o.removed&&!o.safe&&!o.cursed&&center(o).distanceTo(center(e))<6&&wallDistance(center(e),center(o).sub(center(e)).normalize(),6)>=center(o).distanceTo(center(e))-.1).slice(0,2)];
  let origin=eye();for(const victim of targets){const end=center(victim);beam(origin,end,0xdac0ff,.3);hurt(victim,30);origin=end;}
  toast('Piorun! Trafione cele: '+targets.length);
 }
 beep(equippedGlove==='ice'?900:140,.2,'triangle');return true;
}
for(const g of gloveCatalog){const card=document.createElement('article');card.className='glove-card';card.style.setProperty('--glove-color','#'+g.color.toString(16).padStart(6,'0'));card.innerHTML='<div class="glove-art" aria-hidden="true">'+(g.id==='vecna'?'<img class="vecna-reference" src="assets/vecna-hand-reference.jpg" alt="Rekwizyt ręki Vecny">':g.symbol)+'</div><h3>'+g.name+'</h3><p>'+g.description+'</p><button data-glove="'+g.id+'"></button>';document.getElementById('gloveCards').append(card);card.querySelector('button').onclick=()=>buyGlove(g.id);}
document.getElementById('openShop').onclick=()=>{if(!curse){screen('shop');updateShop();}};
document.getElementById('closeShop').onclick=()=>screen('play');
