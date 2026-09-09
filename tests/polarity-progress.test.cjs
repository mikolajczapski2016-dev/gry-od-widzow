const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/i-am-polarity/progress.js','utf8');
function game(storage=new Map(),failWrite=()=>false){
 const elements=new Map();let destination=null;
 const context=vm.createContext({console,Map,Set,Number,JSON,localStorage:{
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>{if(failWrite(key))throw Error('Storage unavailable');storage.set(key,value);}
 },window:{addEventListener(){},location:{assign:url=>destination=url}},document:{querySelectorAll:selector=>selector==='.save-exit-feedback'?[element('feedback')]:[]}});
 function element(id){if(!elements.has(id))elements.set(id,{textContent:'',hidden:true,setAttribute(){}});return elements.get(id);}
 context.$=element;
 vm.runInContext(`
 let ready=true,realmVisit=false,curse=null,wallet=750,equippedGlove='vecna',ownedGloves=new Set(['magnet','vecna']);
 let score=2750,recycled=2,rescued=true,charged=1,missionAnnounced=false,districtRound=3,time=42,tool='magnet',ammo=7,reloadTime=0,best=0,held=null,activeRescue=null,mode='pause';
 const player={x:4,y:0,z:16,yaw:0,pitch:0,vy:0,grounded:true,flying:false},spawnPoint={x:0,z:16};
 const entities=[],rescueMissions=[],gloveCatalog=[{id:'magnet'},{id:'vecna'}],hands={};
 function solid(){return false;}function applyGlove(){}function setRealmVisit(active){realmVisit=active;}
 function screen(name){mode=name;}
 `,context);
 vm.runInContext(source,context);
 vm.runInContext(`const person={id:'world-0',type:'person',mesh:{visible:true,position:{set(){}},rotation:{set(){}}}};
 for(const key of Object.keys(entityNumbers))person[key]=0;person.health=75;
 for(const key of entityFlags)person[key]=false;entities.push(person);`,context);
 return {run:s=>vm.runInContext(s,context),storage,element,destination:()=>destination};
}
test('explicit save and exit restores earnings, gloves, position and district progress in a fresh game',()=>{
 const first=game();first.run('saveAndExit()');assert.equal(first.destination(),'../index.html');
 const next=game(first.storage);next.run("wallet=0;score=0;equippedGlove='magnet';player.x=0;districtRound=1");
 assert.equal(next.run('loadProgress()'),true);
 assert.equal(next.run("JSON.stringify([score,wallet,equippedGlove,player.x,districtRound,recycled,charged,rescued])"),'[2750,750,"vecna",4,3,2,1,true]');
});
test('repairs old negative recovery timers without losing the save',()=>{
 const first=game();first.run('entities[0].knocked=-.07;saveProgress()');
 const next=game(first.storage);assert.equal(next.run('loadProgress()'),true);assert.equal(next.run('entities[0].knocked'),0);assert.equal(next.run('progressWriteBlocked'),false);assert.equal(next.run('wallet'),750);
});
test('a backup write failure does not block the current save',()=>{
 const g=game(new Map(),key=>key.endsWith('-backup'));assert.equal(g.run('saveProgress()'),true);assert.equal(g.run('score=3000;saveProgress()'),true);assert.equal(JSON.parse(g.storage.get('i-am-polarity-progress-v1')).score,3000);
});
test('a failed current save keeps the game open and displays an error',()=>{
 const g=game(new Map(),()=>true);g.run('saveAndExit()');assert.equal(g.destination(),null);assert.equal(g.element('feedback').hidden,false);assert.match(g.element('feedback').textContent,/Nie udało się zapisać/);
});
test('a missing or corrupt primary save falls back to the backup',()=>{
 for(const raw of [null,'{broken']){const first=game();first.run('saveProgress();saveProgress()');if(raw===null)first.storage.delete('i-am-polarity-progress-v1');else first.storage.set('i-am-polarity-progress-v1',raw);assert.equal(game(first.storage).run('loadProgress()'),true);}
});
test('unrecoverable data stays intact and prevents exit with a fresh game',()=>{
 const storage=new Map([['i-am-polarity-progress-v1','{broken']]);const g=game(storage);assert.equal(g.run('loadProgress()'),false);g.run('saveAndExit()');assert.equal(g.destination(),null);assert.equal(storage.get('i-am-polarity-progress-v1'),'{broken');assert.equal(g.element('feedback').hidden,false);
});
