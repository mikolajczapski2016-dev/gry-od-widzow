'use strict';
const gloveCatalog=[
 {id:'magnet',name:'Magnetyczna',price:0,color:0x64d5d3,description:'Chwytaj ludzi i przedmioty. Rzucaj nimi i odpychaj impulsem.',symbol:'◎'},
 {id:'ice',name:'Lodowa',price:150,color:0x91dfff,description:'Zamraża trafioną postać na 5 sekund. Zadaje 15 obrażeń.',symbol:'❄'},
 {id:'storm',name:'Elektryczna',price:300,color:0xe0bcff,description:'Piorun przeskakuje na maksymalnie 3 pobliskie cele. Zadaje 30 obrażeń.',symbol:'ϟ'},
 {id:'vecna',name:'Ręka Vecny',price:500,color:0xe48592,description:'Uderz człowieka, aby wejść do Drugiej Strony. Ścigaj go, gdy jego ciało lewituje w normalnym świecie.',symbol:'✋'}
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
function makeVecnaHand(parent){
 const group=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:0x803e42,roughness:.9}),vein=new THREE.MeshStandardMaterial({color:0x351e2d,roughness:.7});parent.add(group);
 const palm=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),skin);palm.scale.set(.13,.07,.19);group.add(palm);
 for(let i=0;i<5;i++){
  const x=(i-2)*.052,length=i===0?.23:.33+(2-Math.abs(i-2))*.035;
  const pts=[new THREE.Vector3(x,0,-.07),new THREE.Vector3(x*1.4,.055,-.18),new THREE.Vector3(x*1.55,.07,-length),new THREE.Vector3(x*1.5,.01,-length-.045)];
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.022,7,false),skin));
  const tendon=[new THREE.Vector3(x*.4,.065,.14),new THREE.Vector3(x,.08,-.07),new THREE.Vector3(x*1.4,.075,-.2)];group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tendon),8,.008,5,false),vein));
 }
 group.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.depthTest=false;m.material.depthWrite=false;m.renderOrder=101;}});return group;
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
for(const g of gloveCatalog){const card=document.createElement('article');card.className='glove-card';card.style.setProperty('--glove-color','#'+g.color.toString(16).padStart(6,'0'));card.innerHTML='<div class="glove-art" aria-hidden="true">'+g.symbol+'</div><h3>'+g.name+'</h3><p>'+g.description+'</p><button data-glove="'+g.id+'"></button>';document.getElementById('gloveCards').append(card);card.querySelector('button').onclick=()=>buyGlove(g.id);}
document.getElementById('openShop').onclick=()=>{if(!curse){screen('shop');updateShop();}};
document.getElementById('closeShop').onclick=()=>screen('play');
