// Perspective projection of world-space geometry, with orbit camera and depth sorting.
window.City3D = (() => {
  let yaw = .65, distance = 10, drag = null;
  let target = { x: 2, z: 2 }, actor = { x: 2, z: 2 };
  let previousTime = 0;
  const faces = [];
  let model = null;
  let project;
  // Four adjacent plots make one designed block; 16 blocks form a district.
  const blocks = [
    ['house','house','park','house'], ['block','block','shop','park'],
    ['school','library','park','house'], ['wind','park','house','wind'],
    ['block','cafe','block','shop'], ['cafe','fountain','museum','park'],
    ['hotel','shop','tower','cafe'], ['police','fire','park','shop'],
    ['house','park','house','house'], ['hospital','park','library','cafe'],
    ['tower','block','shop','park'], ['stadium','pool','park','cafe'],
    ['house','house','shop','park'], ['block','school','park','block'],
    ['hotel','cafe','museum','fountain'], ['wind','park','pool','house']
  ];
  function planType(x,z) {
    if(x<0||z<0)return null;
    if(x%5===2||z%5===2)return 'car';
    if(![0,4].includes(x%5)||![0,4].includes(z%5))return null;
    const bx=Math.floor((x+1)/5),bz=Math.floor((z+1)/5);
    const corner=(z%5===0?2:0)+(x%5===0?1:0);
    return blocks[(bz%4)*4+bx%4][corner];
  }
  function plotColor(type) {
    if(['park','wind'].includes(type))return '#aacd8d';
    if(['cafe','shop','hotel'].includes(type))return '#e0c5a3';
    if(['fountain','pool'].includes(type))return '#a3cfdd';
    if(['block','tower','house'].includes(type))return '#c2bbd1';
    return '#c9cfc6';
  }
  function face(vertices, color) {
    const points = vertices.map(v => {
      if (!model) return project(...v);
      const c=Math.cos(model.angle),s=Math.sin(model.angle);
      return project(model.x+v[0]*c+v[2]*s,v[1],model.z-v[0]*s+v[2]*c);
    });
    if (points.some(p => p.depth < .4)) return;
    faces.push({ points, color, depth: points.reduce((n, p) => n + p.depth, 0) / points.length });
  }
  function box(x, y, z, w, h, d, colors) {
    const a = [x-w/2,y,z-d/2], b = [x+w/2,y,z-d/2];
    const c = [x+w/2,y,z+d/2], e = [x-w/2,y,z+d/2];
    const top = v => [v[0],v[1]+h,v[2]];
    face([a,b,top(b),top(a)], colors[1]);
    face([b,c,top(c),top(b)], colors[2]);
    face([c,e,top(e),top(c)], colors[1]);
    face([e,a,top(a),top(e)], colors[2]);
    face([top(a),top(b),top(c),top(e)], colors[0]);
  }
  function flat(x,z,w,d,color,y=.025) {
    face([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],color);
  }
  function shade(hex, factor) {
    const value=parseInt(hex.slice(1),16);
    return '#'+[16,8,0].map(shift=>Math.min(255,Math.round(((value>>shift)&255)*factor)).toString(16).padStart(2,'0')).join('');
  }
  function ellipsoid(x,y,z,rx,ry,rz,color) {
    const rings=7,segments=12;
    const vertex=(r,s)=>{const a=r*Math.PI/rings,b=s*2*Math.PI/segments;return [x+Math.sin(a)*Math.cos(b)*rx,y+Math.cos(a)*ry,z+Math.sin(a)*Math.sin(b)*rz];};
    for(let r=0;r<rings;r++)for(let s=0;s<segments;s++) {
      const light=.76+.22*Math.cos((s+.5)*2*Math.PI/segments)+.13*Math.cos((r+.5)*Math.PI/rings);
      face([vertex(r,s),vertex(r,s+1),vertex(r+1,s+1),vertex(r+1,s)],shade(color,light));
    }
  }
  function cylinder(x,y,z,r,h,color,topRadius=r) {
    const top=[];
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      const v=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],w=[x+Math.cos(b)*r,y,z+Math.sin(b)*r];
      const vt=[x+Math.cos(a)*topRadius,y+h,z+Math.sin(a)*topRadius],wt=[x+Math.cos(b)*topRadius,y+h,z+Math.sin(b)*topRadius];
      face([v,w,wt,vt],shade(color,.85+.15*Math.cos(a)));top.push(vt);
    }
    face(top,shade(color,1.1));
  }
  function carPosition(item,now,size) {
    const ox=Math.min(size-8,Math.floor(item.x/5)*5+2),oz=Math.min(size-8,Math.floor(item.z/5)*5+2);
    const travel=(now/1000*.85+item.x*.4+item.z*.7)%20;
    if(travel<5)return {x:ox+travel,z:oz+.17,angle:Math.PI/2};
    if(travel<10)return {x:ox+4.83,z:oz+travel-5,angle:0};
    if(travel<15)return {x:ox+5-(travel-10),z:oz+4.83,angle:-Math.PI/2};
    return {x:ox+.17,z:oz+5-(travel-15),angle:Math.PI};
  }
  function building(item) {
    const {x,z,type} = item;
    // A purchased site occupies its entire plot, without spilling onto pavements.
    if(type!=='car')flat(x,z,1,1,type==='park'?'#78b965':'#bac4b1',.045);
    if (type === 'park') {
      // Edge-to-edge lawn and connecting paths make this a complete little park.
      flat(x,z,.15,1,'#e4d3a9',.052);
      flat(x,z,1,.15,'#e4d3a9',.054);
      for(const [dx,dz,height] of [[-.27,-.27,.53],[.27,.27,.42]]) {
        cylinder(x+dx,.05,z+dz,.035,height,'#8b6346');
        ellipsoid(x+dx,height+.19,z+dz,.21,.29,.21,'#66b664');
        ellipsoid(x+dx-.045,height+.37,z+dz,.15,.16,.15,'#8ac675');
      }
      for(const [dx,dz] of [[-.27,.27],[.27,-.27]]) {
        const wood=['#d1a169','#977044','#745335'];
        box(x+dx,.12,z+dz,.31,.045,.11,wood);
        box(x+dx,.16,z+dz+.05,.31,.12,.025,wood);
        for(const leg of [-.11,.11])box(x+dx+leg,.05,z+dz,.025,.07,.08,['#65716a','#4b554e','#39443c']);
      }
      for(const side of [-1,1]) {
        flat(x+side*.475,z,.035,1,'#4d9153',.056);
        flat(x,z+side*.475,1,.035,'#4d9153',.056);
      }
      return;
    }
    if (type === 'car') {
      ellipsoid(x,.25,z,.28,.16,.51,'#ed5b62');
      // Sloped windshield and a curved roof over a conventional car body.
      face([[x-.22,.33,z+.22],[x+.22,.33,z+.22],[x+.17,.51,z+.08],[x-.17,.51,z+.08]],'#b5e4ef');
      face([[x-.22,.33,z-.3],[x+.22,.33,z-.3],[x+.17,.51,z-.15],[x-.17,.51,z-.15]],'#77adc5');
      for(const side of [-1,1])face([[x+side*.22,.33,z+.22],[x+side*.22,.33,z-.3],[x+side*.17,.51,z-.15],[x+side*.17,.51,z+.08]],'#548da9');
      ellipsoid(x,.505,z-.035,.18,.035,.14,'#ed5b62');
      for (const dx of [-.25,.25]) for (const dz of [-.26,.26])
        ellipsoid(x+dx,.14,z+dz,.06,.12,.12,'#303743');
      for(const dx of [-.17,.17])ellipsoid(x+dx,.23,z+.45,.055,.035,.03,'#fff2bd');
      return;
    }
    if(type==='fountain') {
      cylinder(x,.02,z,.43,.13,'#a6bcc6');cylinder(x,.16,z,.36,.025,'#75d4ec');
      cylinder(x,.18,z,.06,.43,'#d5e6ec');ellipsoid(x,.72,z,.08,.24,.08,'#a2e6fa');
      return;
    }
    if(type==='tower') {
      cylinder(x,.02,z,.39,3.7,'#6898b5',.29);
      for(let y=.3;y<3.6;y+=.35)cylinder(x,y,z,.4-y*.025,.045,'#d6e3e6');
      cylinder(x,3.72,z,.29,.45,'#b1c9d5',0);return;
    }
    if(type==='pool') {
      cylinder(x,.02,z,.46,.12,'#ece0c0');
      cylinder(x,.145,z,.39,.015,'#54c7e1');
      for(let i=-1;i<=1;i++)flat(x+i*.18,z,.012,.52,'#e7f7fc',.164);
      cylinder(x+.36,.14,z-.28,.02,.24,'#d8dfe4');return;
    }
    if(type==='stadium') {
      cylinder(x,.02,z,.48,.24,'#c7d1cf');
      cylinder(x,.265,z,.4,.02,'#65a86d');
      for(const side of [-1,1]){
        box(x,.3,z+side*.27,.24,.14,.025,['#fffafa','#fffafa','#d1d6d5']);
      }
      flat(x,z,.015,.5,'#e9eedc',.291);return;
    }
    if(type==='wind') {
      cylinder(x,.02,z,.13,2.3,'#e4e7e3',.055);
      ellipsoid(x,2.3,z+.04,.09,.09,.12,'#e6eae7');
      const angle=performance.now()/1400;
      for(let i=0;i<3;i++) {
        const a=angle+i*Math.PI*2/3;
        face([[x+Math.cos(a)*.08,2.3+Math.sin(a)*.08,z+.17],
          [x+Math.cos(a+.11)*.83,2.3+Math.sin(a+.11)*.83,z+.17],
          [x+Math.cos(a-.06)*.72,2.3+Math.sin(a-.06)*.72,z+.17]],'#f4f5ee');
      }
      return;
    }
    const style = {
      house: [1.05,['#e78e64','#f5d4a4','#c4a477']],
      shop: [.9,['#ffd16c','#6fc3bd','#3a8f94']],
      school: [1.5,['#f4bd63','#96b9e6','#5e85ba']],
      block: [2.8,['#c2c4e8','#999fc5','#666f9c']],
      hospital:[1.7,['#e4efea','#e4e8df','#bbc9c5']],
      cafe:[.7,['#e6a078','#f2d6ae','#bb967a']],
      police:[1.1,['#88aace','#91b5d5','#6385ac']],
      fire:[.95,['#e58b74','#da7963','#b65d51']],
      library:[1.2,['#d9b993','#dbc8ac','#b29b7d']],
      museum:[1.1,['#e5ddcb','#ded6c3','#bdb39a']],
      hotel:[2.5,['#e4c695','#edd4ac','#c3a780']]
    }[type];
    if (!style) return;
    const [height,colors] = style;
    box(x,.03,z,.8,height,.8,colors);
    if(type==='police') {
      ellipsoid(x-.1,height+.08,z,.08,.06,.06,'#e9585b');
      ellipsoid(x+.1,height+.08,z,.08,.06,.06,'#5a8fe4');
    }
    if(type==='fire') for(const dx of [-.22,.12])box(x+dx,.05,z+.413,.22,.45,.02,['#41494e','#41494e','#41494e']);
    if(type==='library'||type==='museum') {
      for(const dx of [-.3,-.1,.1,.3])cylinder(x+dx,.05,z+.46,.035,.8,'#ece4d0');
      face([[x-.49,.88,z+.53],[x+.49,.88,z+.53],[x,1.25,z+.53]],'#eee5d3');
    }
    if(type==='hotel') {
      box(x-.14,2,z+.42,.045,.25,.03,colors);
      box(x+.1,2,z+.42,.045,.25,.03,colors);
      box(x-.02,2.11,z+.44,.25,.045,.03,['#996943','#996943','#996943']);
    }
    // Foundation, door, porch and projecting balconies break up flat façades.
    box(x,.01,z,.9,.1,.92,['#c1c6c3','#a4aeaa','#879591']);
    box(x,.1,z+.415,.18,.3,.035,['#76533d','#76533d','#5c483a']);
    if(type==='block')for(let y=.7;y<height;y+=.55) {
      box(x,y,z+.45,.62,.04,.2,['#d8e2dd','#b1bebb','#9faeae']);
      box(x,y+.04,z+.54,.63,.1,.025,['#bddbe4','#bddbe4','#99b8cd']);
    }
    if(type==='hospital') {
      box(x,height-.48,z+.415,.3,.08,.02,['#e95c67','#e95c67','#e95c67']);
      box(x,height-.6,z+.42,.08,.3,.02,['#e95c67','#e95c67','#e95c67']);
    }
    if(type==='cafe'||type==='shop') {
      for(let i=0;i<6;i++)box(x-.35+i*.14,height-.1,z+.49,.14,.07,.35,[i%2?'#fff5dc':'#db6b66','#c95a58','#994c49']);
      cylinder(x+.25,.05,z+.65,.1,.18,'#cbad80');
      cylinder(x+.25,.24,z+.65,.18,.03,'#e3c39b');
    }
    // Windows on all four walls occupy actual vertical planes.
    for (let y=.38; y<height-.1; y+=.43) for (const offset of [-.22,.12]) {
      const w=.14, h=.22;
      for (const side of [-1,1]) {
        face([[x+offset,y,z+side*.402],[x+offset+w,y,z+side*.402],
          [x+offset+w,y+h,z+side*.402],[x+offset,y+h,z+side*.402]],'#c9efff');
        face([[x+side*.402,y,z+offset],[x+side*.402,y,z+offset+w],
          [x+side*.402,y+h,z+offset+w],[x+side*.402,y+h,z+offset]],'#ffe5a2');
      }
    }
    if (type === 'house') {
      face([[x-.46,height,z-.46],[x+.46,height,z-.46],[x,height+.4,z-.46]],'#b95446');
      face([[x-.46,height,z+.46],[x+.46,height,z+.46],[x,height+.4,z+.46]],'#9c433e');
      face([[x-.46,height,z-.46],[x,height+.4,z-.46],[x,height+.4,z+.46],[x-.46,height,z+.46]],'#ed7961');
      face([[x+.46,height,z-.46],[x,height+.4,z-.46],[x,height+.4,z+.46],[x+.46,height,z+.46]],'#c95d51');
    } else box(x,height+.03,z,.88,.1,.88,colors);
  }
  function residentPosition(home, id, now, size) {
    // Walk around a block, entirely on its continuous pavement ring.
    const ox=Math.max(3,Math.min(size-7,Math.floor((home.x+1)/5)*5-2));
    const oz=Math.max(3,Math.min(size-7,Math.floor((home.z+1)/5)*5-2));
    const phase=(now/1000*(.28+(id%3)*.045)+id*2.37)%12;
    if(phase<3)return {x:ox+phase,z:oz+.1,angle:Math.PI/2};
    if(phase<6)return {x:ox+2.9,z:oz+phase-3,angle:0};
    if(phase<9)return {x:ox+3-(phase-6),z:oz+2.9,angle:-Math.PI/2};
    return {x:ox+.1,z:oz+3-(phase-9),angle:Math.PI};
  }
  function resident(position,id,now) {
    model=position;
    const stride=Math.sin(now*.007+id)*.095;
    const shirt=['#e7ad49','#55a4a1','#7d80c9','#d67764','#7ca866'][id%5];
    const skin=['#f3c69a','#b68160','#e2b38b','#845b45'][id%4];
    flat(.05,.03,.3,.26,'#7c8e80',.035);
    ellipsoid(-.075,.2,stride,.065,.18,.075,'#424e69');
    ellipsoid(.075,.2,-stride,.065,.18,.075,'#424e69');
    ellipsoid(0,.49,0,.16,.2,.12,shirt);
    ellipsoid(0,.78,0,.12,.14,.12,skin);
    ellipsoid(0,.865,-.02,.125,.055,.115,id%2?'#513d32':'#ccb071');
    ellipsoid(-.19,.47,-stride,.05,.15,.05,skin);
    ellipsoid(.19,.47,stride,.05,.15,.05,skin);
    model=null;
  }
  function render(canvas, ctx, player, items, size, tileType) {
    const now = performance.now(), dt = Math.min(.05,(now-previousTime)/1000 || .016);
    previousTime = now;
    const ease = 1-Math.exp(-14*dt);
    actor.x += (player.x-actor.x)*ease; actor.z += (player.z-actor.z)*ease;
    target.x += (actor.x-target.x)*ease; target.z += (actor.z-target.z)*ease;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const focal = Math.min(width*1.1,height*1.05), pitch = .6;
    const sy=Math.sin(yaw), cy=Math.cos(yaw), sp=Math.sin(pitch), cp=Math.cos(pitch);
    const eye = { x:target.x+sy*distance, y:distance*Math.tan(pitch), z:target.z+cy*distance };
    project = (x,y,z) => {
      const dx=x-eye.x, dy=y-eye.y, dz=z-eye.z;
      const right=dx*cy-dz*sy, forward=-dx*sy-dz*cy;
      const up=dy*cp+forward*sp, depth=forward*cp-dy*sp;
      return { x:width/2+right*focal/depth, y:height*.48-up*focal/depth, depth };
    };
    const sky=ctx.createLinearGradient(0,0,0,height);
    sky.addColorStop(0,'#6babdf'); sky.addColorStop(.65,'#c5e3ef'); sky.addColorStop(1,'#e1ead5');
    ctx.fillStyle=sky; ctx.fillRect(0,0,width,height);
    faces.length=0;
    const occupied=new Set(items.map(item=>`${item.x},${item.z}`));
    const radius=24;
    for(let z=Math.floor(target.z)-radius;z<=target.z+radius;z++) for(let x=Math.floor(target.x)-radius;x<=target.x+radius;x++) {
      const type=tileType(x,z);
      const color={road:'#535e6c',sidewalk:'#d0d5d5',lot:'#7eb975',void:'#93bf80'}[type];
      flat(x,z,.995,.995,color,0);
      if(type==='lot'&&!occupied.has(`${x},${z}`)) {
        const planned=planType(x,z);
        flat(x,z,.86,.86,plotColor(planned),.012);
        // Neat foundations show how the empty plots will fill the block.
        for(const side of [-1,1]) {
          flat(x+side*.36,z,.018,.72,'#f3f1df',.025);
          flat(x,z+side*.36,.72,.018,'#f3f1df',.025);
        }
      }
      if(type==='road' && ((x%5===2)!==(z%5===2)))
        flat(x,z,x%5===2?.035:.44,x%5===2?.44:.035,'#ffe4a0');
      if(type==='sidewalk') {
        flat(x+.49,z,.012,1,'#a5b0af'); flat(x,z+.49,1,.012,'#a5b0af');
      }
      if(type==='sidewalk'&&x%5===1&&z%5===1&&Math.hypot(x-target.x,z-target.z)<9) {
        cylinder(x-.3,.01,z-.3,.065,.1,'#526465');
        cylinder(x-.3,.1,z-.3,.025,1.17,'#697b79');
        box(x-.21,1.24,z-.3,.23,.045,.055,['#849493','#607573','#4c625f']);
        ellipsoid(x-.1,1.22,z-.3,.09,.045,.08,'#fff0bb');
        flat(x-.1,z-.3,.36,.36,'#e1dec4',.013);
      }
      if(type==='sidewalk'&&x%5===3&&z%5===1&&Math.hypot(x-target.x,z-target.z)<10) {
        cylinder(x+.28,.025,z-.28,.095,.27,(Math.floor(x/5)+Math.floor(z/5))%2?'#4e8291':'#528472');
        cylinder(x+.28,.295,z-.28,.105,.035,'#344f4e');
        box(x+.28,.22,z-.182,.095,.04,.013,['#263b3e','#263b3e','#263b3e']);
      }
      if(type==='road' && x%5===2 && z%5===2)for(let stripe=-.3;stripe<=.3;stripe+=.15)flat(x+stripe,z,.07,.75,'#e8e9d9');
    }
    for(const item of items) {
      const moving=item.type==='car'?carPosition(item,now,size):item;
      if(Math.abs(moving.x-target.x)>radius||Math.abs(moving.z-target.z)>radius)continue;
      if(item.type==='car'){model=moving;building({type:'car',x:0,z:0});model=null;}
      else building(item);
    }
    const homes=items.filter(i=>['house','block','tower','hotel','shop','cafe','school'].includes(i.type));
    const pedestrians=[];
    for(let i=0;i<3;i++)pedestrians.push({p:residentPosition({x:4,z:4},i,now,size),id:i});
    for(const home of homes) {
      if(Math.hypot(home.x-target.x,home.z-target.z)>16)continue;
      const count=['block','tower','hotel'].includes(home.type)?3:1;
      for(let i=0;i<count;i++) {
        const id=home.x*size*3+home.z*3+i+3;
        pedestrians.push({p:residentPosition(home,id,now,size),id});
      }
    }
    pedestrians.sort((a,b)=>Math.hypot(a.p.x-target.x,a.p.z-target.z)-Math.hypot(b.p.x-target.x,b.p.z-target.z));
    for(const {p,id} of pedestrians.slice(0,16))if(Math.hypot(p.x-target.x,p.z-target.z)<12)resident(p,id,now);
    const x=actor.x,z=actor.z;
    const walking=Math.hypot(player.x-x,player.z-z)>.03;
    const stride=walking?Math.sin(now*.021)*.12:0;
    flat(x+.08,z+.1,.4,.4,'#526453',.03);
    ellipsoid(x-.09,.23,z+stride,.075,.21,.085,'#414d74');
    ellipsoid(x+.09,.23,z-stride,.075,.21,.085,'#414d74');
    ellipsoid(x,.58,z,.19,.24,.14,'#eb6599');
    ellipsoid(x,.92,z,.14,.16,.14,'#f6cb9d');
    ellipsoid(x,1.025,z-.01,.145,.075,.14,'#634331');
    ellipsoid(x-.24,.55,z-stride,.065,.19,.065,'#f6cb9d');
    ellipsoid(x+.24,.55,z+stride,.065,.19,.065,'#f6cb9d');
    faces.sort((a,b)=>b.depth-a.depth);
    for(const f of faces) {
      ctx.beginPath(); f.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();ctx.fillStyle=f.color;ctx.fill();
    }
    const plots=[];
    for(let z=Math.max(0,player.z-5);z<=Math.min(size-1,player.z+5);z++)for(let x=Math.max(0,player.x-5);x<=Math.min(size-1,player.x+5);x++) {
      const kind=tileType(x,z),screen=project(x,.15,z);
      if((kind!=='lot'&&kind!=='road')||occupied.has(`${x},${z}`)||(x===player.x&&z===player.z))continue;
      if(screen.depth<1||screen.x<65||screen.x>width-65||screen.y<165||screen.y>height-130)continue;
      plots.push({x,z,kind,type:planType(x,z),screen,distance:Math.hypot(x-player.x,z-player.z)});
    }
    plots.sort((a,b)=>a.distance-b.distance);
    const selected=[];
    for(const p of plots) {
      if(p.kind==='road'&&selected.some(i=>i.kind==='road'))continue;
      if(selected.some(i=>Math.hypot(i.screen.x-p.screen.x,i.screen.y-p.screen.y)<85))continue;
      selected.push(p);if(selected.length===5)break;
    }
    return selected;
  }
  function attach(canvas) {
    canvas.addEventListener('pointerdown', e=>{drag={x:e.clientX,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId){yaw-=(e.clientX-drag.x)*.008;drag.x=e.clientX;}});
    for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{drag=null;});
    canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(5,Math.min(17,distance+e.deltaY*.01));},{passive:false});
  }
  return {render,attach,carPosition,residentPosition,planType,projectPlot:plot=>project(plot.x,.2,plot.z)};
})();
