const piano=document.querySelector('#piano'),play=document.querySelector('#play'),stop=document.querySelector('#stop'),clear=document.querySelector('#clear'),statusText=document.querySelector('#status'),count=document.querySelector('#count');
const notes=[['C4',60,'a'],['C♯4',61,'w'],['D4',62,'s'],['D♯4',63,'e'],['E4',64,'d'],['F4',65,'f'],['F♯4',66,'t'],['G4',67,'g'],['G♯4',68,'y'],['A4',69,'h'],['A♯4',70,'u'],['B4',71,'j'],['C5',72,'k'],['C♯5',73,'o'],['D5',74,'l'],['D♯5',75,'p'],['E5',76,';']];
const buttons=new Map(),held=new Map(),voices=new Set(),highlights=new Map();
let audio,master,recording=[],origin=null,playing=false,timers=[];
function prepareAudio(){audio??=new (window.AudioContext||window.webkitAudioContext)();if(!master){master=audio.createGain();master.gain.value=Number(document.querySelector('#volume').value)/100*.35;master.connect(audio.destination);}if(audio.state==='suspended')audio.resume();}
function voice(midi,when=audio.currentTime){
 const gain=audio.createGain(),oscillators=[];gain.connect(master);
 gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.7,when+.008);gain.gain.exponentialRampToValueAtTime(.18,when+.7);
 for(const [multiple,level] of [[1,1],[2,.3],[3,.12]]){const osc=audio.createOscillator(),mix=audio.createGain();osc.frequency.value=440*2**((midi-69)/12)*multiple;mix.gain.value=level;osc.connect(mix);mix.connect(gain);osc.start(when);oscillators.push(osc);}
 let ended=false;
 const v={release(at=audio.currentTime){if(ended)return;ended=true;gain.gain.cancelAndHoldAtTime(at);gain.gain.exponentialRampToValueAtTime(.0001,at+.18);oscillators.forEach(o=>o.stop(at+.2));},cancel(){oscillators.forEach(o=>{try{o.stop();}catch{}});}};
 voices.add(v);oscillators[0].onended=()=>{voices.delete(v);gain.disconnect();};return v;
}
function highlight(midi,change){const total=Math.max(0,(highlights.get(midi)||0)+change);highlights.set(midi,total);buttons.get(midi).classList.toggle('active',total>0);}
function length(){return recording.reduce((end,n)=>Math.max(end,n.start+n.duration),0);}
function refresh(){const n=recording.length;count.textContent=`${n} ${n===1?"dźwięk":n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?"dźwięki":"dźwięków"}`;play.disabled=playing||!recording.length;stop.disabled=!playing;clear.disabled=playing;}
function begin(id,midi){
 if(playing||held.has(id))return;
 try{prepareAudio();}catch{statusText.textContent='Nie udało się uruchomić dźwięku.';return;}
 const now=performance.now()/1000;if(origin===null)origin=now-length();
 const note={midi,start:now-origin,duration:0};recording.push(note);held.set(id,{note,voice:voice(midi),time:now});highlight(midi,1);statusText.textContent='● Zapamiętuję Twoją melodię…';refresh();
}
function end(id){const active=held.get(id);if(!active)return;active.note.duration=Math.max(.06,performance.now()/1000-active.time);active.voice.release();highlight(active.note.midi,-1);held.delete(id);}
function releaseAll(){for(const id of [...held.keys()])end(id);}
function stopPlayback(){timers.forEach(clearTimeout);timers=[];for(const v of voices)v.cancel();playing=false;origin=null;highlights.clear();buttons.forEach(b=>b.classList.remove('active'));statusText.textContent=recording.length?'Gotowe. Odtwórz ponownie lub graj dalej.':'Naciśnij pierwszy klawisz, aby zacząć.';refresh();}
let whiteIndex=0;
for(const [name,midi,key] of notes){
 const black=name.includes('♯'),button=document.createElement('button');button.type='button';button.className='key '+(black?'black':'white');button.setAttribute('aria-label',name);button.innerHTML=`<b>${name.replace(/[45]/,'')}</b><small>${key.toUpperCase()}</small>`;
 if(black)button.style.left=`${whiteIndex/10*100-2.5}%`;else whiteIndex++;
 button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);begin('pointer'+event.pointerId,midi);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>end('pointer'+event.pointerId));
 button.addEventListener('click',event=>{if(event.detail===0){const id='accessible'+midi;begin(id,midi);setTimeout(()=>end(id),200);}});
 buttons.set(midi,button);piano.append(button);
}
window.addEventListener('keydown',event=>{if(event.ctrlKey||event.altKey||event.metaKey||event.target.matches('input'))return;const note=notes.find(n=>n[2]===event.key.toLowerCase());if(note){event.preventDefault();if(!event.repeat)begin('key'+note[2],note[1]);}});
window.addEventListener('keyup',event=>end('key'+event.key.toLowerCase()));
play.addEventListener('click',()=>{
 releaseAll();if(!recording.length||playing)return;
 prepareAudio();playing=true;origin=null;refresh();statusText.textContent='▶ Odtwarzam Twoją melodię…';
 const start=audio.currentTime+.08;
 for(const note of recording){const v=voice(note.midi,start+note.start);v.release(start+note.start+note.duration);timers.push(setTimeout(()=>highlight(note.midi,1),(note.start+.08)*1000),setTimeout(()=>highlight(note.midi,-1),(note.start+note.duration+.08)*1000));}
 timers.push(setTimeout(stopPlayback,(length()+.32)*1000));
});
stop.addEventListener('click',stopPlayback);
clear.addEventListener('click',()=>{releaseAll();stopPlayback();recording=[];origin=null;statusText.textContent='Nowe nagranie. Zagraj pierwsze dźwięki!';refresh();});
document.querySelector('#volume').addEventListener('input',event=>{if(master)master.gain.setTargetAtTime(Number(event.target.value)/100*.35,audio.currentTime,.02);});
function pause(){releaseAll();if(playing)stopPlayback();origin=null;}
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('game-orientation-change',event=>{if(event.detail.blocked)pause();});
