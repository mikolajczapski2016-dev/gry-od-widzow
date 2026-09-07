'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const roads = [-100, -50, 0, 50, 100];
const bounds = 118;
let mode = 'menu', settingsFrom = 'menu', ready = false, elapsed = 0, needsRender = true;
let renderer, scene, camera, playerMesh, aimRing, audio, sun, toastTime = 0;
let selectedTarget = null;
const heldActions = new Map();
let money = 120, deliveries = 0, sound = true;
try {
 const data = JSON.parse(localStorage.getItem('miejskie-zycie-v1'));
 if (data) {
  money = clamp(Number(data.money) || 0, 0, 9999999);
  deliveries = clamp(Number(data.deliveries) || 0, 0, 999999);
  sound = data.sound !== false;
 }
} catch {}
function save() {
 try { localStorage.setItem('miejskie-zycie-v1', JSON.stringify({money, deliveries, sound})); } catch {}
}
const player = {x: -9, z: 17, angle: Math.PI, health: 100, ammo: 36, car: null, cooldown: 0, hurt: 0, punchTime: 0, shootTime: 0};
let heat = 0, escapeTime = 0, policeTimer = 0, job = null, jobIndex = 0;
const buildings = [], cars = [], people = [], police = [], effects = [], markers = [];
const keys = new Set();
const joystick = {x: 0, y: 0, pointer: null};
const places = {
 work: {x: -9, z: 0, name: 'PRACA', color: 0xfbd06b},
 home: {x: -9, z: 25, name: 'DOM', color: 0x9cdbbe},
 shop: {x: 41, z: -25, name: 'SKLEP', color: 0xf4aa7c}
};
const destinations = [
 {x: 9, z: 25, name: 'Park Miejski'}, {x: -59, z: -25, name: 'Kawiarnia Róg'},
 {x: 59, z: 75, name: 'Apartamenty Słoneczne'}, {x: -9, z: -75, name: 'Biuro Północ'},
 {x: -91, z: 65, name: 'Warsztat Zachód'}
];
function material(color) { return CityVisuals.mat(color); }

let cube, cylinder, sphere;
function box(parent, x, y, z, w, h, d, color, shadow = false) {
 const mesh = new THREE.Mesh(cube, CityVisuals.surface(color, w, h, d));
 mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
 mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function label(text, color = '#ffffff', scale = 8) {
 const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
 const ctx = canvas.getContext('2d');
 ctx.fillStyle = '#17333fe8'; ctx.fillRect(0, 0, 512, 96);
 ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
 ctx.fillStyle = color; ctx.fillText(text, 256, 49, 480);
 const texture = new THREE.CanvasTexture(canvas);
 const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, depthTest: true}));
 sprite.scale.set(scale, scale * 96 / 512, 1); return sprite;
}
function person(color, isPolice = false) { return CityVisuals.person(scene, color, isPolice); }
function animatePerson(mesh, walking, phase) {
 CityVisuals.animatePerson(mesh, walking, phase, mesh === playerMesh ? player.punchTime / .4 : 0, mesh === playerMesh ? player.shootTime : 0);
}
function makeCar(x, z, angle, color, patrol = false) { return CityVisuals.car(scene, x, z, angle, color, patrol); }
function blocked(x, z, radius = .65) {
 return Math.abs(x) > bounds - radius || Math.abs(z) > bounds - radius || buildings.some(b => Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius);
}
function move(entity, dx, dz, radius = .65) {
 const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .7));
 let hit = false;
 for (let i = 0; i < steps; i++) {
  if (!blocked(entity.x + dx / steps, entity.z, radius)) entity.x += dx / steps; else hit = true;
  if (!blocked(entity.x, entity.z + dz / steps, radius)) entity.z += dz / steps; else hit = true;
 }
 return hit;
}
function clearLine(a, b) {
 const steps = Math.ceil(distance(a, b) / 1.5);
 for (let i = 1; i < steps; i++) if (blocked(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps, .1)) return false;
 return true;
}
function addTree(x, z) { CityVisuals.tree(scene, x, z); }
function createWorld() {
 scene.background = new THREE.Color(0xb3c2cc); scene.fog = new THREE.Fog(0xb3c2cc, 65, 185);
 scene.add(new THREE.HemisphereLight(0xe2edff, 0x676b61, 1.25));
 sun = new THREE.DirectionalLight(0xffeed6, 2.6); sun.position.set(-35, 55, 25); sun.castShadow = true;
 sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera, {left:-38,right:38,top:38,bottom:-38,near:1,far:140});
 sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);
 box(scene, 0, -.25, 0, 260, .4, 260, 0x727e60);
 for (const r of roads) {
  box(scene, r, .01, 0, 12, .1, 246, 0x465963); box(scene, 0, .02, r, 246, .1, 12, 0x465963);
  for (const s of [-1, 1]) {
   box(scene, r + s * 8.5, .13, 0, 5, .25, 246, 0xb5c0b5);
   box(scene, 0, .14, r + s * 8.5, 246, .25, 5, 0xb5c0b5);
  }
  for (let t = -117; t < 120; t += 9) if (roads.every(c => Math.abs(t - c) > 9)) {
   box(scene, r, .09, t, .16, .04, 3, 0xe8d6a0); box(scene, t, .1, r, 3, .04, .16, 0xe8d6a0);
  }
 }
 // Paint intersections over the crossing sidewalks, then add zebra crossings.
 for (const x of roads) for (const z of roads) {
  box(scene, x, .28, z, 22, .04, 22, 0x465963);
  for (const offset of [-8, 8]) for (let stripe = -4; stripe <= 4; stripe += 2) {
   box(scene, x + stripe, .31, z + offset, .9, .02, 2.3, 0xd8d9be);
   box(scene, x + offset, .31, z + stripe, 2.3, .02, .9, 0xd8d9be);
  }
 }
 const colors = [0xdfb18c, 0xc2cbc3, 0x7da8b4, 0xd4c090, 0xaeafb6, 0xc78e76];
 let blockIndex = 0;
 for (const x of [-75, -25, 25, 75]) for (const z of [-75, -25, 25, 75]) {
  const park = x === 25 && z === 25;
  box(scene, x, .18, z, 28, .3, 28, park ? 0x91b181 : 0xc0bca6);
  if (park) {
   box(scene, x, .37, z, 4, .08, 28, 0xdac99e); box(scene, x, .38, z, 28, .08, 4, 0xdac99e);
   for (const dx of [-9, 9]) for (const dz of [-9, 9]) addTree(x + dx, z + dz);
   box(scene, x, .7, z, 6, 1, 6, 0xa6b8b7); box(scene, x, 1.24, z, 5, .12, 5, 0x70c1ca);
   buildings.push({x, z, w: 6, d: 6});
   const sign = label('PARK MIEJSKI', '#c4edc8', 4); sign.position.set(x, 6, z); scene.add(sign);
   continue;
  }
  const h = 7 + ((blockIndex * 7) % 17), color = colors[blockIndex++ % colors.length];
  const w = 23, d = 24;
  buildings.push({x, z, w, d, h}); box(scene, x, h / 2 + .3, z, w, h, d, color, true);
  box(scene, x, h + .65, z, w + .7, .65, d + .7, 0xede1c3);
  box(scene, x - 4, h + 1.5, z - 3, 6, 1.7, 5, 0x7c8e91);
  for (let y = 3; y < h - 1; y += 3.4) for (let off = -8; off <= 8; off += 4) {
   for (const side of [-1, 1]) {
    box(scene, x + off, y, z + side * (d / 2 + .025), 2, 1.8, .04, 0x476777);
    box(scene, x + side * (w / 2 + .025), y, z + off, .04, 1.8, 2, 0x476777);
   }
  }
  CityVisuals.decorateBuilding(scene, {x,z,w,d}, h, blockIndex);
  if (x === -25 && z === 25) {
   const sign = label('TWOJE MIESZKANIE', '#b4efd1', 5); sign.position.set(x, 6, z + 12.5); scene.add(sign);
  }
  for (const dz of [-16, 16]) addTree(x + 15, z + dz);
 }
 for (const x of [-100, 0, 100]) for (const z of [-75, -25, 25, 75]) {
  box(scene, x - 7, 3, z, .18, 6, .18, 0x49616b); box(scene, x - 6.3, 6, z, 1.7, .2, .45, 0xd8d8cc);
 }
 for (const p of Object.values(places)) {
  const marker = makeMarker(p.color); marker.position.set(p.x, .4, p.z); scene.add(marker); markers.push(marker);
  const sign = label(p.name, '#' + p.color.toString(16), 3); sign.position.set(p.x, 3.4, p.z); scene.add(sign);
 }
 const carColors = [0x546271, 0x713c38, 0x3b5854, 0xc5c8c8, 0x283d54, 0x48484b];
 for (let i = 0; i < 18; i++) {
  const x = roads[i % 5] + (i % 2 ? 3.6 : -3.6);
  let z = -85 + Math.floor(i / 5) * 50 + (i % 3) * 8;
  if (Math.hypot(x + 3.6, z - 18) < 7) z += 12;
  cars.push(makeCar(x, z, i % 2 ? 0 : Math.PI, carColors[i % carColors.length]));
 }
 // An accessible first car next to the starting apartment.
 cars.push(makeCar(-3.6, 18, Math.PI, 0x364a60));
 for (let i = 0; i < 30; i++) {
  const x = roads[i % 5] + (i % 2 ? 8.5 : -8.5), z = -90 + (i * 17) % 180;
  people.push({x, z, startX: x, startZ: z, direction: i % 2 ? 1 : -1, health: 60, down: 0, scared: 0, mesh: person([0x684b44, 0x465967, 0x716d59, 0x42474c][i % 4])});
 }
 // Batch static city geometry so phones render the city with fewer draw calls.
 const batches = new Map();
 for (const mesh of [...scene.children]) {
  if (!mesh.isMesh) continue;
  const key = mesh.geometry.uuid + mesh.material.uuid;
  if (!batches.has(key)) batches.set(key, []);
  batches.get(key).push(mesh);
 }
 for (const meshes of batches.values()) {
  const batch = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
  meshes.forEach((mesh, i) => { mesh.updateMatrix(); batch.setMatrixAt(i, mesh.matrix); scene.remove(mesh); });
  batch.castShadow=meshes.some(m=>m.castShadow);batch.receiveShadow=true;batch.computeBoundingSphere(); scene.add(batch);
 }
 playerMesh = person(0x46525d);
 const gun = CityVisuals.rounded(playerMesh.userData.arms[1], .03, -.63, .10, .08, .10, .30, .018, material(0x242a2e)); gun.name = 'blaster';
 aimRing = new THREE.Mesh(new THREE.RingGeometry(.9, 1.08, 28), new THREE.MeshBasicMaterial({color: 0xffd477, side: THREE.DoubleSide, depthWrite: false}));
 aimRing.rotation.x = -Math.PI / 2; scene.add(aimRing);
 const playerRing = new THREE.Mesh(new THREE.RingGeometry(.39, .43, 28), new THREE.MeshBasicMaterial({color: 0xf7e8b8, side: THREE.DoubleSide}));
 playerRing.rotation.x = -Math.PI / 2; playerRing.position.y = .035; playerMesh.add(playerRing);
}
function makeMarker(color) {
 const group = new THREE.Group();
 const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2, 32), new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide}));
 ring.rotation.x = -Math.PI / 2; group.add(ring);
 const diamond = new THREE.Mesh(new THREE.SphereGeometry(.19,16,12), material(color)); diamond.position.y = 2.7; group.add(diamond);
 return group;
}
let jobMarker;
function toast(text) { $('toast').textContent = text; $('toast').style.opacity = 1; toastTime = 3.5; }
async function beep(frequency = 440, length = .09, type = 'sine') {
 if (!sound) return;
 try {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!audio || audio.state === 'closed') audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state !== 'running') await audio.resume();
  if (!sound || document.hidden) return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type; osc.frequency.setValueAtTime(frequency, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .4), audio.currentTime + length);
  gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + length);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + length);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
 } catch {}
}
function crime(amount) {
 heat = clamp(heat + amount, 0, 5); escapeTime = 0;
 for (const npc of people) if (!npc.down && distance(player, npc) < 24) npc.scared = 8;
}
function nearestCar() {
 let result = null, best = 5;
 for (const car of cars) { const d = distance(player, car); if (d < best) { best = d; result = car; } }
 return result;
}
function toggleCar() {
 if (player.car) {
  const car = player.car;
  const exits = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
  const exit = exits.map(a => ({x: car.x + Math.sin(car.angle + a) * 3.6, z: car.z + Math.cos(car.angle + a) * 3.6})).find(p => !blocked(p.x, p.z));
  if (!exit) { toast('Za ciasno! Odsuń auto od budynku.'); return; }
  player.x = exit.x; player.z = exit.z; car.speed = 0; player.car = null; playerMesh.visible = true;
  toast('Wysiadasz z auta.'); return;
 }
 const car = nearestCar();
 if (!car) { toast('Podejdź bliżej auta i naciśnij Auto / E.'); return; }
 player.car = car; player.x = car.x; player.z = car.z; player.angle = car.angle; playerMesh.visible = false;
 if (!car.stolen) { car.stolen = true; crime(1); toast('Kradzież auta! Policja szuka kierowcy.'); } else toast('Wsiadasz. Strzałki i joystick: jedź w kierunku na ekranie.');
 beep(210, .18, 'triangle');
}
function interact() {
 if (player.car) { toast('Wysiądź z auta, żeby załatwić sprawę.'); return; }
 if (job && distance(player, job) < 5) {
  if (heat) { toast('Najpierw zgub policję, potem oddaj paczkę.'); return; }
  money += job.reward; deliveries++; save(); toast('Dostawa gotowa! +' + job.reward + ' zł.'); beep(900, .25);
  job = null; jobMarker.visible = false; return;
 }
 if (distance(player, places.work) < 5) {
  if (job) { toast('Masz już paczkę. Jedź do żółtego punktu na mapie.'); return; }
  if (heat) { toast('Zgub policję, zanim rozpoczniesz pracę.'); return; }
  const destination = destinations[jobIndex++ % destinations.length];
  job = {...destination, reward: 100 + Math.round(distance(player, destination))};
  jobMarker.position.set(job.x, .5, job.z); jobMarker.visible = true;
  toast('Dostarcz paczkę: ' + job.name + '.'); beep(680, .15); return;
 }
 if (distance(player, places.home) < 5) {
  if (heat) { toast('Policja zna ten adres. Najpierw zgub pościg!'); return; }
  player.health = 100; save(); toast('Odpoczynek w domu. Zdrowie odnowione!'); beep(600, .2); return;
 }
 if (distance(player, places.shop) < 5) {
  if (heat) { toast('Sklep zamknięty dla poszukiwanych. Zgub pościg.'); return; }
  if (money < 40) { toast('Potrzebujesz 40 zł. Zarobisz na dostawach.'); return; }
  money -= 40; player.ammo += 36; player.health = Math.min(100, player.health + 30); save();
  toast('Zakupy: +36 nabojów i +30 zdrowia. −40 zł.'); beep(780, .15); return;
 }
 toast('Podejdź do punktu PRACA, DOM, SKLEP albo do celu dostawy.');
}
function targetInFront(range, cone) {
 if (selectedTarget && [...people, ...police].includes(selectedTarget) && !selectedTarget.down && distance(player, selectedTarget) < range && clearLine(player, selectedTarget)) return selectedTarget;
 let target = null, best = Infinity;
 for (const npc of [...people, ...police]) {
  if (npc.down) continue;
  const d = distance(player, npc);
  if (d > range || !clearLine(player, npc)) continue;
  const dot = ((npc.x-player.x)*Math.sin(player.angle)+(npc.z-player.z)*Math.cos(player.angle))/Math.max(.01,d);
  const score = d + (dot < cone ? range * .3 : 0);
  if (score < best) { best = score; target = npc; }
 }
 return target;
}
function flash(x, y, z, color, size = .6) {
 const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({color, transparent: true}));
 mesh.position.set(x, y, z); mesh.scale.setScalar(size); scene.add(mesh); effects.push({mesh, life: .2, total: .2});
}
function hitTarget(target, damage) {
 target.health -= damage; target.scared = 10; flash(target.x, 1.3, target.z, 0xffe6a4);
 if (target.health <= 0) {
  target.down = 14; target.mesh.rotation.z = Math.PI / 2; target.mesh.position.y = .5;
  toast(target.isPolice ? 'Patrol obezwładniony. Nadciągają posiłki!' : 'Przechodzień obezwładniony. Świadkowie wzywają policję!');
  if (target.isPolice) crime(1);
 }
}
function attack(shoot) {
 if (player.cooldown > 0) return;
 if (player.car && !shoot) { toast('Wysiądź z auta (Auto / E), żeby zadać cios.'); return; }
 if (shoot && player.ammo <= 0) { toast('Brak nabojów. Uzupełnij je w sklepie za 40 zł.'); return; }
 player.cooldown = shoot ? .3 : .5;
 const target = targetInFront(shoot ? 38 : 3.8, shoot ? .5 : -1);
 if (target && !player.car) { player.angle = Math.atan2(target.x-player.x,target.z-player.z); playerMesh.rotation.y=player.angle; }
 if (shoot) player.shootTime=.35; else player.punchTime=.4;
 if (shoot) {
  player.ammo--; crime(.55); beep(110, .1, 'sawtooth');
  const end = target || {x: player.x + Math.sin(player.angle) * 30, z: player.z + Math.cos(player.angle) * 30};
  let endpoint = end;
  if (!target) for (let d = 1; d < 30; d++) {
   const point = {x: player.x + Math.sin(player.angle) * d, z: player.z + Math.cos(player.angle) * d};
   if (blocked(point.x, point.z, .1)) { endpoint = point; break; }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(player.x, 1.4, player.z), new THREE.Vector3(endpoint.x, 1.4, endpoint.z)]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: 0xfff0b4, transparent: true})); scene.add(line); effects.push({mesh: line, life: .12, total: .12, ownGeometry: true});
  flash(player.x + Math.sin(player.angle), 1.4, player.z + Math.cos(player.angle), 0xffd375, .35);
 } else { beep(180, .09, 'triangle'); flash(player.x + Math.sin(player.angle) * 1.2, 1.3, player.z + Math.cos(player.angle) * 1.2, 0xf7e3b2, .4); }
 if (target) { crime(target.isPolice ? 1 : .7); hitTarget(target, shoot ? 35 : 30); if (!target.down) toast(shoot ? 'Trafienie!' : 'Cios trafił!'); }
 else if (!shoot) toast('Podejdź do osoby — zasięg ciosu to kilka kroków.');
}
function hurt(amount) {
 if (player.hurt > 0) return;
 player.health = Math.max(0, player.health - amount); player.hurt = .65; flash(player.x, 1.5, player.z, 0xf58c73);
 if (player.health <= 0) respawn();
}
function clearPolice() { for (const cop of police) scene.remove(cop.mesh); police.length = 0; }
function respawn() {
 const fine = Math.min(money, 80); money -= fine; save();
 if (player.car) player.car.speed = 0;
 Object.assign(player, {x: -9, z: 17, health: 100, ammo: Math.max(24, player.ammo), car: null, hurt: 2});
 playerMesh.visible = true; heat = 0; escapeTime = 0; clearPolice();
 toast('Trafiasz z powrotem pod dom. Koszty: ' + fine + ' zł.'); beep(180, .4);
}
// A small walkable grid lets patrols find a route around city blocks.
const gridSize = 47, gridStep = 5, gridOffset = -115;
let walkable;
const gridIndex = (x, z) => clamp(Math.round((z - gridOffset) / gridStep), 0, gridSize - 1) * gridSize + clamp(Math.round((x - gridOffset) / gridStep), 0, gridSize - 1);
const gridPoint = i => ({x: gridOffset + (i % gridSize) * gridStep, z: gridOffset + Math.floor(i / gridSize) * gridStep});
function buildGrid() {
 walkable = new Uint8Array(gridSize * gridSize);
 for (let i = 0; i < walkable.length; i++) { const p = gridPoint(i); walkable[i] = blocked(p.x, p.z, 1) ? 0 : 1; }
}
function pathTo(from, to) {
 const start = gridIndex(from.x, from.z); let end = gridIndex(to.x, to.z);
 if (!walkable[end]) {
  let best = Infinity;
  for (let i = 0; i < walkable.length; i++) if (walkable[i]) { const d = distance(gridPoint(i), to); if (d < best) { end = i; best = d; } }
 }
 const queue = [start], previous = new Int16Array(walkable.length); previous.fill(-1); previous[start] = start;
 for (let head = 0; head < queue.length; head++) {
  const current = queue[head]; if (current === end) break;
  for (const next of [current - gridSize, current + gridSize, ...(current % gridSize > 0 ? [current - 1] : []), ...(current % gridSize < gridSize - 1 ? [current + 1] : [])]) {
   if (next < 0 || next >= walkable.length || !walkable[next] || previous[next] !== -1) continue;
   previous[next] = current; queue.push(next);
  }
 }
 if (previous[end] === -1) return [];
 const path = []; for (let i = end; i !== start; i = previous[i]) path.push(gridPoint(i));
 return path.reverse();
}
function spawnPolice() {
 const candidates = [];
 for (const x of roads) for (const z of roads) {
  const d = distance({x, z}, player); if (d > 38 && d < 90) candidates.push({x, z});
 }
 if (!candidates.length) return;
 const p = candidates[Math.floor(Math.random() * candidates.length)];
 const mesh = person(0x355e8c, true);
 const cop = {...p, mesh, health: 85, down: 0, isPolice: true, path: [], replan: 0, attack: 1};
 police.push(cop); mesh.position.set(p.x, .3, p.z);
}
function updatePolice(dt) {
 if (!heat) return;
 policeTimer -= dt;
 const active = police.filter(c => !c.down);
 if (policeTimer <= 0 && active.length < Math.ceil(heat) + 1) { spawnPolice(); policeTimer = 2.5; }
 let seen = false;
 for (const cop of police) {
  if (cop.down) { cop.down -= dt; if (cop.down <= 0) { scene.remove(cop.mesh); cop.remove = true; } continue; }
  const d = distance(cop, player), visible = clearLine(cop, player);
  if (d < 38 && visible) seen = true;
  cop.replan -= dt; cop.attack -= dt;
  if (cop.replan <= 0) { cop.path = pathTo(cop, player); cop.replan = .8 + Math.random() * .3; }
  let target = visible ? player : cop.path[0];
  if (target && distance(cop, target) < 1.2 && target !== player) { cop.path.shift(); target = cop.path[0]; }
  if (target && d > 1.5) {
   const angle = Math.atan2(target.x - cop.x, target.z - cop.z), speed = 5.3 + Math.ceil(heat) * .32;
   move(cop, Math.sin(angle) * speed * dt, Math.cos(angle) * speed * dt);
   cop.mesh.rotation.y = angle;
  }
  if (d < (player.car ? 4 : 2.2) && cop.attack <= 0) { hurt(heat >= 3 ? 16 : 11); cop.attack = 1; }
  cop.mesh.position.set(cop.x, .3, cop.z); animatePerson(cop.mesh, d > 1.5, elapsed * 10);
 }
 for (let i = police.length - 1; i >= 0; i--) if (police[i].remove) police.splice(i, 1);
 if (seen) escapeTime = 0; else escapeTime += dt;
 if (escapeTime > 14) { heat = 0; escapeTime = 0; clearPolice(); toast('Pościg zgubiony. Znowu jesteś zwykłym mieszkańcem.'); beep(700, .3); }
}
function updatePeople(dt) {
 for (const npc of people) {
  if (npc.down > 0) {
   npc.down -= dt;
   if (npc.down <= 0) { npc.health = 60; npc.x = npc.startX; npc.z = npc.startZ; npc.mesh.rotation.z = 0; }
   continue;
  }
  npc.scared = Math.max(0, npc.scared - dt);
  const speed = npc.scared ? 5 : 1.6;
  let dx = 0, dz = npc.direction * speed * dt;
  if (npc.scared && distance(player, npc) < 20) {
   const angle = Math.atan2(npc.x - player.x, npc.z - player.z); dx = Math.sin(angle) * speed * dt; dz = Math.cos(angle) * speed * dt;
  }
  if (move(npc, dx, dz)) npc.direction *= -1;
  npc.mesh.position.set(npc.x, .3, npc.z); npc.mesh.rotation.y = Math.atan2(dx, dz); animatePerson(npc.mesh, true, elapsed * speed * 4);
  if (player.car && Math.abs(player.car.speed) > 5 && distance(player, npc) < 2) { crime(1); hitTarget(npc, 70); player.car.speed *= .65; }
 }
}
function updatePlayer(dt) {
 player.punchTime=Math.max(0,player.punchTime-dt);player.shootTime=Math.max(0,player.shootTime-dt);
 player.cooldown = Math.max(0, player.cooldown - dt); player.hurt = Math.max(0, player.hurt - dt);
 let x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joystick.x;
 let y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + joystick.y;
 const magnitude = Math.hypot(x, y); if (magnitude > 1) { x /= magnitude; y /= magnitude; }
 if (player.car) {
  const car = player.car;
  // All directions are screen-relative, exactly like walking.
  if (magnitude > .12) {
   const desiredAngle = Math.atan2(x, y);
   const turn = Math.atan2(Math.sin(desiredAngle-car.angle),Math.cos(desiredAngle-car.angle));
   if (Math.abs(turn)>Math.PI/2) car.speed *= .35;
   car.angle = desiredAngle;
   car.speed = Math.min(29,car.speed+dt*18);
  } else car.speed *= Math.exp(-dt*3);
  const impactSpeed = Math.abs(car.speed);
  if (move(car, Math.sin(car.angle) * car.speed * dt, Math.cos(car.angle) * car.speed * dt, 2.5)) {
   car.speed = 0; if (impactSpeed > 9) { hurt(9); beep(90, .15, 'triangle'); }
  }
  if (player.car !== car) return;
  for (const other of cars) if (other !== car && distance(car, other) < 3.3) {
   const angle = Math.atan2(car.x - other.x, car.z - other.z); move(car, Math.sin(angle) * .25, Math.cos(angle) * .25, 2.5); car.speed = 0;
   if (impactSpeed > 9) { hurt(6); crime(.4); }
  }
  if (player.car !== car) return;
  car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.angle;
  player.x = car.x; player.z = car.z; player.angle = car.angle;
 } else {
  if (magnitude > .12) {
   player.angle = Math.atan2(x, y); move(player, x * 8 * dt, y * 8 * dt);
  }
  playerMesh.position.set(player.x, .3, player.z); playerMesh.rotation.y = player.angle;
  animatePerson(playerMesh, magnitude > .12, elapsed * 12);
 }
 if (keys.has('Space') || [...heldActions.values()].includes('shoot')) attack(true);
 else if (keys.has('KeyF') || [...heldActions.values()].includes('punch')) attack(false);
 const target = targetInFront(38, .5);
 aimRing.visible = !!target;
 if (target) aimRing.position.set(target.x, .34, target.z);
 $('combatHint').textContent=target?(distance(player,target)<3.8?'Osoba w zasięgu ciosu':'Cel namierzony · '+Math.round(distance(player,target))+' m'):'Cios: podejdź do osoby · Strzał: automatyczne celowanie';
}
function updateUI() {
 $('money').textContent = Math.floor(money) + ' zł'; $('health').textContent = '♥ ' + Math.ceil(player.health);
 $('ammo').textContent = player.car ? Math.abs(Math.round(player.car.speed * 4)) + ' km/h' : player.ammo + ' nab.';
 const wanted = Math.ceil(heat);
 $('stars').textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted); $('stars').setAttribute('aria-label', 'Poziom pościgu: ' + wanted + ' z 5');
 $('pursuit').textContent = wanted ? escapeTime > 1 ? 'Ukryj się jeszcze ' + Math.ceil(14 - escapeTime) + ' s' : 'POLICJA W POŚCIGU · zgub patrole!' : 'Spokojnie. Miasto należy do ciebie.';
 $('missionTitle').textContent = job ? 'Dostawa: ' + job.name : 'Zwykły dzień, własne zasady.';
 $('missionText').textContent = job ? Math.round(distance(player, job)) + ' m do celu · zapłata ' + job.reward + ' zł. Na miejscu: Zajęcie / J.' : 'Żółty punkt: praca. Zielony: dom i odpoczynek. Pomarańczowy: sklep (40 zł).';
 let prompt = '';
 if (player.car) prompt = 'Auto / E — wysiądź';
 else if (job && distance(player, job) < 5) prompt = 'Zajęcie / J — dostarcz paczkę';
 else if (distance(player, places.work) < 5) prompt = 'Zajęcie / J — weź dostawę';
 else if (distance(player, places.home) < 5) prompt = 'Zajęcie / J — odpocznij w domu';
 else if (distance(player, places.shop) < 5) prompt = 'Zajęcie / J — zakupy za 40 zł\n36 nabojów + 30 zdrowia';
 else if (nearestCar()) prompt = 'Auto / E — wsiądź do auta';
 $('prompt').textContent = prompt;
}
const mapContext = $('map').getContext('2d');
function drawMap() {
 const ctx = mapContext, scale = 180 / 250, to = v => 90 + v * scale;
 ctx.fillStyle = '#789282'; ctx.fillRect(0, 0, 180, 180);
 ctx.strokeStyle = '#354a54'; ctx.lineWidth = 9;
 for (const r of roads) { ctx.beginPath(); ctx.moveTo(to(r), 0); ctx.lineTo(to(r), 180); ctx.moveTo(0, to(r)); ctx.lineTo(180, to(r)); ctx.stroke(); }
 ctx.fillStyle = '#b8b8a5'; for (const b of buildings) ctx.fillRect(to(b.x - b.w / 2), to(b.z - b.d / 2), b.w * scale, b.d * scale);
 const dot = (p, color, radius) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(to(p.x), to(p.z), radius, 0, Math.PI * 2); ctx.fill(); };
 for (const p of Object.values(places)) dot(p, '#' + p.color.toString(16), 3);
 if (job) { ctx.strokeStyle = '#ffe49a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(to(player.x), to(player.z)); ctx.lineTo(to(job.x), to(job.z)); ctx.stroke(); dot(job, '#ffe49a', 4); }
 for (const cop of police) if (!cop.down) dot(cop, '#ff7785', 3);
 ctx.save(); ctx.translate(to(player.x), to(player.z)); ctx.rotate(-player.angle); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#193340'; ctx.lineWidth = 1.5;
 ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(-4, -4); ctx.lineTo(4, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function releaseInputs() { keys.clear(); heldActions.clear(); joystick.x = joystick.y = 0; joystick.pointer = null; $('knob').style.transform = ''; }
function showScreen(screen) {
 mode = screen; needsRender = true; releaseInputs();
 for (const id of ['menu', 'pause', 'settings']) $(id).hidden = id !== screen;
 $('hud').hidden = screen !== 'play';
 if (screen !== 'play') $(screen).querySelector('button')?.focus({preventScroll: true});
}
function doAction(action) {
 if (mode !== 'play') return;
 if (action === 'car') toggleCar();
 if (action === 'interact') interact();
 if (action === 'punch') attack(false);
 if (action === 'shoot') attack(true);
}
$('start').onclick = () => { if (ready) { showScreen('play'); beep(540, .15); } };
$('pauseButton').onclick = () => showScreen('pause'); $('resume').onclick = () => showScreen('play');
$('menuButton').onclick = () => { $('start').textContent = 'WRÓĆ DO MIASTA ↗'; showScreen('menu'); };
for (const button of document.querySelectorAll('.open-settings')) button.onclick = () => { settingsFrom = mode; showScreen('settings'); };
$('closeSettings').onclick = () => showScreen(settingsFrom);
function soundLabel() { $('sound').textContent = 'Dźwięk: ' + (sound ? 'włączony' : 'wyłączony'); $('sound').setAttribute('aria-pressed', String(sound)); }
$('sound').onclick = () => { sound = !sound; soundLabel(); save(); if (sound) beep(); };
$('fullscreen').onclick = async () => {
 try {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  else { $('fullscreen').textContent = 'Pełny ekran niedostępny'; }
 } catch { $('fullscreen').textContent = 'Pełny ekran niedostępny'; }
};
window.addEventListener('keydown', event => {
 if (mode !== 'play') { if ((event.code === 'Escape' || event.code === 'KeyP') && mode === 'pause') showScreen('play'); return; }
 if (event.ctrlKey || event.metaKey || event.altKey) return;
 if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
 keys.add(event.code);
 if (event.repeat) return;
 if (event.code === 'Escape' || event.code === 'KeyP') { showScreen('pause'); return; }
 const action = {KeyE: 'car', KeyF: 'punch', Space: 'shoot', KeyJ: 'interact'}[event.code]; if (action) doAction(action);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { releaseInputs(); if (mode === 'play') showScreen('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseInputs(); if (mode === 'play') showScreen('pause'); } });
window.addEventListener('game-orientation-change', event => { if (event.detail.blocked && mode === 'play') showScreen('pause'); });
const stick = $('stick');
function moveStick(event) {
 const rect = stick.getBoundingClientRect(), max = rect.width * .32;
 let x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
 const length = Math.hypot(x, y); if (length > max) { x *= max / length; y *= max / length; }
 joystick.x = x / max; joystick.y = y / max; $('knob').style.transform = `translate(${x}px,${y}px)`;
}
stick.addEventListener('pointerdown', event => { if (mode !== 'play' || joystick.pointer !== null) return; event.preventDefault(); joystick.pointer = event.pointerId; stick.setPointerCapture(event.pointerId); moveStick(event); });
stick.addEventListener('pointermove', event => { if (event.pointerId === joystick.pointer) moveStick(event); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(type, event => { if (event.pointerId === joystick.pointer) { joystick.pointer = null; joystick.x = joystick.y = 0; $('knob').style.transform = ''; } });
for (const button of document.querySelectorAll('[data-action]')) {
 const action=button.dataset.action;
 if (action==='shoot'||action==='punch') {
  button.addEventListener('pointerdown',event=>{if(mode!=='play')return;event.preventDefault();button.setPointerCapture(event.pointerId);heldActions.set(event.pointerId,action);doAction(action);});
  for(const eventName of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(eventName,event=>heldActions.delete(event.pointerId));
  button.addEventListener('click',event=>{if(event.detail===0)doAction(action);});
 } else button.addEventListener('click',()=>doAction(action));
}
$('game').addEventListener('pointerdown',event=>{
 if(mode!=='play'||event.button!==0)return;
 const rect=$('game').getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
 const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
 const actors=[...people,...police].filter(p=>!p.down&&p.mesh.visible);
 const hit=ray.intersectObjects(actors.map(p=>p.mesh),true)[0];
 if(hit){selectedTarget=actors.find(p=>{let o=hit.object;while(o){if(o===p.mesh)return true;o=o.parent;}return false;})||null;}
 else selectedTarget=null;
 doAction('shoot');
});
function cameraPosition() {
 const inCar=!!player.car, target=new THREE.Vector3(player.x,1.45,player.z);
 const desired=new THREE.Vector3(player.x,inCar?5.2:4.4,player.z+(inCar?10.5:7));
 const direction=desired.clone().sub(target),length=direction.length();direction.normalize();
 const ray=new THREE.Ray(target,direction);let allowed=length;
 for(const b of buildings){const hit=ray.intersectBox(new THREE.Box3(new THREE.Vector3(b.x-b.w/2-.25,0,b.z-b.d/2-.25),new THREE.Vector3(b.x+b.w/2+.25,b.h||2,b.z+b.d/2+.25)),new THREE.Vector3());if(hit)allowed=Math.min(allowed,Math.max(.45,hit.distanceTo(target)-.25));}
 return target.addScaledVector(direction,allowed);
}
let last = 0, hudTime = 0;
function frame(now) {
 const dt = Math.min((now - last) / 1000 || 0, .1); last = now;
 if (mode === 'play') {
  elapsed += dt; updatePlayer(dt); updatePeople(dt); updatePolice(dt);
  toastTime -= dt; if (toastTime <= 0) $('toast').style.opacity = 0;
  for (const marker of [...markers, jobMarker]) { marker.children[1].rotation.y += dt; marker.children[1].position.y = 2.7 + Math.sin(elapsed * 2) * .25; }
  for (let i = effects.length - 1; i >= 0; i--) {
   const effect = effects[i]; effect.life -= dt; effect.mesh.material.opacity = Math.max(0, effect.life / effect.total);
   if (effect.life <= 0) { scene.remove(effect.mesh); effect.mesh.material.dispose(); if (effect.ownGeometry) effect.mesh.geometry.dispose(); effects.splice(i, 1); }
  }
 }
 if (playerMesh && (mode === 'play' || needsRender)) {
  if (mode === 'menu' && !elapsed) { playerMesh.position.set(player.x, .3, player.z); for (const npc of people) npc.mesh.position.set(npc.x, .3, npc.z); }
  for (const car of cars) car.mesh.visible = distance(player, car) < 80;
  for (const npc of people) npc.mesh.visible = distance(player, npc) < 75;
  const desired = cameraPosition();
  camera.position.copy(desired);
  playerMesh.visible=!player.car && camera.position.distanceTo(new THREE.Vector3(player.x,1.45,player.z))>.85;
  camera.lookAt(player.x, 1.35, player.z - (player.car?6:4));
  sun.position.set(player.x-35,55,player.z+25);sun.target.position.set(player.x,0,player.z);sun.target.updateMatrixWorld();
  hudTime += dt; if (hudTime > .1) { updateUI(); drawMap(); hudTime = 0; }
  renderer.render(scene, camera); needsRender = false;
 }
 requestAnimationFrame(frame);
}
function resize() { if (!renderer) return; needsRender = true; renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
soundLabel();
try {
 renderer = new THREE.WebGLRenderer({canvas: $('game'), antialias: devicePixelRatio < 2, powerPreference: 'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 300);
 camera.position.set(player.x, 4.4, player.z + 7);
 CityVisuals.init(renderer,scene,()=>{needsRender=true;});
 cube = new THREE.BoxGeometry(1, 1, 1); cylinder = new THREE.CylinderGeometry(1, 1, 1, 10); sphere = new THREE.SphereGeometry(1, 12, 8);
 createWorld(); buildGrid(); jobMarker = makeMarker(0xffdf73); jobMarker.visible = false; scene.add(jobMarker);
 resize(); window.addEventListener('resize', resize); ready = true; updateUI(); drawMap(); requestAnimationFrame(frame);
 $('game').addEventListener('webglcontextlost', event => { event.preventDefault(); showScreen('menu'); ready = false; $('start').disabled = true; $('loadError').hidden = false; });
} catch (error) { console.error(error); $('loadError').hidden = false; $('start').disabled = true; }
