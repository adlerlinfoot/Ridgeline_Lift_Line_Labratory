// Schematic 3D route skeleton. Node heights are supplied; intermediate heights are
// interpolated by planar arc length. This is a view, never a second simulation.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
import {liftColors,mapLiftColors} from './palette.mjs';
const classColors={all_mountain:'#4fd1b1',vacationer:'#7fb5ff',lapper:'#ffc16b',mixed:'#e0a3ef'};
const trailColors={green:'#68be91',blue:'#65a3d9',black:'#afc3ce',park:'#e5a15e'};
export const nodeLabel=id=>({W_TOP:'West peak',E_TOP:'East Peak',A_TOP:'Aspen peak',M_TOP:'Meadow top',LODGE:'Main Lodge'})[id]??id.replaceAll('_',' ');

export function elevatedPolyline(points,from,to,nodes) {
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+distance(points[i-1],points[i]));
  const total=lengths.at(-1),a=nodes[from].elevation_m,b=nodes[to].elevation_m;
  return points.map((p,i)=>[p[0],p[1],a+(b-a)*(total?lengths[i]/total:0)]);
}

export function skeletonRoutes(map) {
  const nodes=Object.fromEntries(map.nodes.map(n=>[n.id,n])),routes=[];
  for(const run of map.runs) {
    const anchors=[{node_id:run.start_node,polyline_index:0},...(run.junction_nodes??[]),{node_id:run.end_node,polyline_index:run.polyline.length-1}].sort((a,b)=>a.polyline_index-b.polyline_index);
    const points=[];
    for(let i=1;i<anchors.length;i++) {
      const a=anchors[i-1],b=anchors[i];
      const segment=elevatedPolyline(run.polyline.slice(a.polyline_index,b.polyline_index+1),a.node_id,b.node_id,nodes);
      points.push(...(points.length?segment.slice(1):segment));
    }
    routes.push({id:run.id,kind:'run',name:run.name,points,color:trailColors[run.difficulty],length:run.centerline_length_m});
  }
  for(const t of map.transfers)routes.push({id:t.id,kind:'transfer',name:t.name,points:elevatedPolyline(t.polyline,t.from,t.to,nodes),color:'#6e929f',length:t.centerline_length_m});
  for(const l of map.lifts) {
    const a=nodes[l.base],b=nodes[l.top];
    routes.push({id:l.id,kind:'lift',name:l.name,points:elevatedPolyline(l.polyline??[[a.x,a.y],[b.x,b.y]],l.base,l.top,nodes),color:mapLiftColors(map.lifts)[l.id],length:l.centerline_length_m});
  }
  return routes;
}

export function agentWorldPosition(sim,a) {
  const [x,y]=sim.position(a);
  if(!a.edge||a.state==='QUEUE'||a.state==='EXITED')return [x,y,sim.mountain.nodes[a.node].elevation_m];
  const f=clamp((sim.t-a.edgeStart)/(a.edgeEnd-a.edgeStart),0,1);
  const start=sim.mountain.nodes[a.edge.from].elevation_m,end=sim.mountain.nodes[a.edge.to].elevation_m;
  return [x,y,start+(end-start)*f];
}

export const coneGeometry={base:2330,top:3140,radius:1280,capRadius:80};
export function conePoint(point) {
  const g=coneGeometry,u=clamp((point[2]-g.base)/(g.top-g.base),0,1);
  const angle=(point[0]-700)/700*Math.PI*.85+(point[1]-480)/960*.18;
  const radius=g.capRadius+g.radius*(1-u);
  return [700+Math.sin(angle)*radius/2,480+Math.cos(angle)*radius/2,point[2]];
}
export function coneSurface(rings=12,sides=48) {
  const g=coneGeometry,rows=[];
  for(let j=0;j<=rings;j++){
    const u=j/rings,r=g.capRadius+g.radius*(1-u),row=[];
    for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;row.push([700+Math.sin(a)*r/2,480+Math.cos(a)*r/2,g.base+u*(g.top-g.base)]);}
    rows.push(row);
  }
  return rows;
}
export function subdividePolyline(points,step=16) {
  const out=[points[0]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/step));
    for(let k=1;k<=n;k++)out.push(a.map((x,j)=>x+(b[j]-x)*k/n));
  }
  return out;
}
// A point on this convex cone is visible exactly when its outward normal faces
// the perspective camera. Include vertical exaggeration in the surface normal.
export function isConeVisible(point,camera,wrapped=false) {
  if(!camera.cone)return true;
  const p=wrapped?point:conePoint(point),x=(p[0]-700)*2,z=(p[1]-480)*2;
  const radius=Math.hypot(x,z),y=(p[2]-2700)*camera.vertical;
  const eyeX=-Math.sin(camera.yaw)*5000*Math.cos(camera.pitch),eyeZ=Math.cos(camera.yaw)*5000*Math.cos(camera.pitch),eyeY=5000*Math.sin(camera.pitch);
  const slope=coneGeometry.radius/((coneGeometry.top-coneGeometry.base)*camera.vertical);
  return (x/(radius||1))*(eyeX-x)+(z/(radius||1))*(eyeZ-z)+slope*(eyeY-y)>=-1e-7;
}
export function visiblePolyline(points,camera,wrapped=false) {
  if(!camera.cone)return [points];
  const chunks=[];let current=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],av=isConeVisible(a,camera,wrapped),bv=isConeVisible(b,camera,wrapped);
    if(av&&!current.length)current.push(a);
    if(av!==bv){let low=0,high=1;for(let j=0;j<14;j++){const t=(low+high)/2,p=a.map((x,k)=>x+(b[k]-x)*t);if(isConeVisible(p,camera,wrapped)===av)low=t;else high=t;}const p=a.map((x,k)=>x+(b[k]-x)*(low+high)/2);if(av){current.push(p);chunks.push(current);current=[];}else current=[p];}
    if(bv)current.push(b);
  }
  if(current.length>1)chunks.push(current);return chunks;
}
export function defaultCamera(){return {yaw:-0.24,pitch:0.62,zoom:0.8,panX:0,panY:0,vertical:1.5,cone:true};}

export function projectPoint(point,camera,width,height) {
  if(camera.cone)point=conePoint(point);
  const x=(point[0]-700)*2,z=(point[1]-480)*2,y=(point[2]-2700)*camera.vertical;
  const rx=Math.cos(camera.yaw)*x+Math.sin(camera.yaw)*z;
  const rz=-Math.sin(camera.yaw)*x+Math.cos(camera.yaw)*z;
  const up=Math.cos(camera.pitch)*y-Math.sin(camera.pitch)*rz;
  const depth=Math.sin(camera.pitch)*y+Math.cos(camera.pitch)*rz;
  const perspective=5000/(5000-depth),scale=Math.min(width/3300,height/2200)*camera.zoom;
  return {x:width/2+rx*perspective*scale+camera.panX,y:height*.49-up*perspective*scale+camera.panY,depth};
}

function lineDistance(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}

export class Mountain3D {
  constructor(canvas,map,{onSelect=()=>{},onHover=()=>{},onReset=()=>{},gyro=null}={}) {
    this.canvas=canvas;this.map=map;this.routes=skeletonRoutes(map);this.camera=defaultCamera();
    this.coneRoutes=this.routes.map(r=>({...r,points:subdividePolyline(r.points)}));
    this.onSelect=onSelect;this.onHover=onHover;this.onReset=onReset;this.labels=true;this.hits=[];this.routeHits=[];this.drag=null;this.pointers=new Map();this.hover=null;
    this.gyro=gyro;this.body=coneSurface();this.bind();if(gyro)this.bindGyro();
  }
  reset(){this.camera=defaultCamera();this.hover=null;this.onReset(this.camera);}
  setMap(map){this.map=map;this.routes=skeletonRoutes(map);this.coneRoutes=this.routes.map(r=>({...r,points:subdividePolyline(r.points)}));this.hits=[];this.routeHits=[];this.reset();}
  bindGyro() {
    const el=this.gyro;let drag=null;
    el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);el.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};e.preventDefault();});
    el.addEventListener('pointermove',e=>{if(!drag)return;this.camera.yaw+=(e.clientX-drag.x)*.018;this.camera.pitch=clamp(this.camera.pitch+(e.clientY-drag.y)*.012,.08,1.5);drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>3;drag.x=e.clientX;drag.y=e.clientY;});
    el.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const r=el.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;if(Math.hypot(x,y)>r.width*.26)this.camera.yaw=Math.round(Math.atan2(x,-y)/(Math.PI/2))*Math.PI/2;}drag=null;});
    for(const type of ['pointercancel','lostpointercapture'])el.addEventListener(type,()=>{drag=null;});
    el.addEventListener('dblclick',()=>this.reset());
    el.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')this.camera.yaw-=.1;else if(e.key==='ArrowRight')this.camera.yaw+=.1;else if(e.key==='ArrowUp')this.camera.pitch=clamp(this.camera.pitch-.08,.08,1.5);else if(e.key==='ArrowDown')this.camera.pitch=clamp(this.camera.pitch+.08,.08,1.5);else if(e.key==='Home')this.reset();else return;e.preventDefault();});
  }
  drawGyro() {
    const el=this.gyro;if(!el)return;
    const c=el.getContext('2d'),r=el.getBoundingClientRect();if(!r.width)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),w=r.width,h=r.height;
    if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    const x=w/2,y=h/2-3,rad=w*.34;
    c.fillStyle='#0b1c26ee';c.beginPath();c.arc(x,y,rad+8,0,Math.PI*2);c.fill();
    c.strokeStyle='#63858f';c.lineWidth=1;
    c.beginPath();c.ellipse(x,y,rad,rad*.4,this.camera.yaw,0,Math.PI*2);c.stroke();
    c.beginPath();c.ellipse(x,y,rad*.45,rad,-this.camera.yaw,0,Math.PI*2);c.stroke();
    c.beginPath();c.arc(x,y,rad,0,Math.PI*2);c.stroke();
    const a=this.camera.yaw,p=this.camera.pitch,axes=[['X',Math.cos(a),Math.sin(p)*Math.sin(a),'#ff777b'],['Y',Math.sin(a),-Math.sin(p)*Math.cos(a),'#7bceff'],['Z',0,-Math.cos(p),'#91e3b1']];
    c.font='bold 9px system-ui';c.textAlign='center';c.textBaseline='middle';
    for(const [label,dx,dy,color] of axes){const xx=x+dx*rad*.7,yy=y+dy*rad*.7;c.strokeStyle=color;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();c.fillStyle=color;c.fillText(label,xx+dx*6,yy+dy*6);}
    c.fillStyle='#bdd4dc';c.font='8px system-ui';for(const [label,dx,dy] of [['N',0,-1],['E',1,0],['S',0,1],['W',-1,0]])c.fillText(label,x+dx*(rad+15),y+dy*(rad+15));
    c.fillStyle='#98b7c0';c.font='8px system-ui';c.fillText('DRAG TO ORBIT',x,h-3);
  }
  bind() {
    const el=this.canvas;
    const local=e=>{const r=el.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    el.addEventListener('contextmenu',e=>e.preventDefault());
    el.addEventListener('pointerdown',e=>{
      el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);
      const p=local(e);this.pointers.set(e.pointerId,p);
      this.drag={...p,startX:p.x,startY:p.y,moved:false,pan:e.shiftKey||e.button!==0};
      this.hover=null;
    });
    el.addEventListener('pointermove',e=>{
      const p=local(e);
      if(this.pointers.has(e.pointerId)) {
        const before=[...this.pointers.values()];this.pointers.set(e.pointerId,p);
        if(this.pointers.size===2) {
          const after=[...this.pointers.values()],d0=distance([before[0].x,before[0].y],[before[1].x,before[1].y]),d1=distance([after[0].x,after[0].y],[after[1].x,after[1].y]);
          this.camera.zoom=clamp(this.camera.zoom*(d0?d1/d0:1),.4,4);
          this.camera.panX+=(after[0].x+after[1].x-before[0].x-before[1].x)/2;
          this.camera.panY+=(after[0].y+after[1].y-before[0].y-before[1].y)/2;
          if(this.drag)this.drag.moved=true;
        } else if(this.drag) {
          const dx=p.x-this.drag.x,dy=p.y-this.drag.y;
          if(this.drag.pan){this.camera.panX+=dx;this.camera.panY+=dy;}
          else{this.camera.yaw+=dx*.007;this.camera.pitch=clamp(this.camera.pitch+dy*.006,.08,1.5);}
          this.drag.moved ||= Math.hypot(p.x-this.drag.startX,p.y-this.drag.startY)>4;
        }
        if(this.drag){this.drag.x=p.x;this.drag.y=p.y;}
      } else {
        this.hover=this.pick(p);this.onHover(this.hover?.text??'Drag to orbit · scroll to zoom · Shift-drag to pan · click a skier');
        el.style.cursor=this.hover?.type==='agent'?'pointer':'grab';
      }
    });
    const end=e=>{
      if(e.type==='pointerup'&&this.drag&&!this.drag.moved){const hit=this.pick(local(e));if(hit?.type==='agent')this.onSelect(hit.id);else if(hit)this.onHover(hit.text);}
      this.pointers.delete(e.pointerId);this.drag=null;
    };
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,end);
    el.addEventListener('pointerleave',()=>{if(!this.drag){this.hover=null;this.onHover('Drag to orbit · scroll to zoom · Shift-drag to pan · click a skier');}});
    el.addEventListener('wheel',e=>{e.preventDefault();this.camera.zoom=clamp(this.camera.zoom*Math.exp(-e.deltaY*.001),.4,4);},{passive:false});
    el.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft')this.camera.yaw-=.1;
      else if(e.key==='ArrowRight')this.camera.yaw+=.1;
      else if(e.key==='ArrowUp')this.camera.pitch=clamp(this.camera.pitch-.08,.08,1.5);
      else if(e.key==='ArrowDown')this.camera.pitch=clamp(this.camera.pitch+.08,.08,1.5);
      else if(['+','='].includes(e.key))this.camera.zoom=clamp(this.camera.zoom*1.1,.4,4);
      else if(e.key==='-')this.camera.zoom=clamp(this.camera.zoom/1.1,.4,4);
      else if(e.key==='Home')this.reset();else return;
      e.preventDefault();
    });
  }
  pick(p) {
    let closest=null,best=11;
    for(const hit of this.hits){const d=Math.hypot(p.x-hit.x,p.y-hit.y);if(d<best){best=d;closest=hit;}}
    if(closest)return closest;
    best=6;
    for(const hit of this.routeHits)for(let i=1;i<hit.points.length;i++){const d=lineDistance(p,hit.points[i-1],hit.points[i]);if(d<best){best=d;closest=hit;}}
    return closest;
  }
  draw(sim,selected=null) {
    const el=this.canvas,rect=el.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const width=rect.width,height=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);
    if(el.width!==Math.round(width*dpr)||el.height!==Math.round(height*dpr)){el.width=Math.round(width*dpr);el.height=Math.round(height*dpr);}
    const c=el.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.fillStyle='#0e2029';c.fillRect(0,0,width,height);
    const project=p=>projectPoint(p,this.camera,width,height);
    const raw=p=>projectPoint(p,{...this.camera,cone:false},width,height);
    const trace=(points,color,lineWidth=1,dash=[])=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=lineWidth;c.setLineDash(dash);c.stroke();c.setLineDash([]);};
    for(let x=0;x<=1400;x+=200)trace([raw([x,0,2330]),raw([x,960,2330])],'#223943');
    for(let y=0;y<=960;y+=160)trace([raw([0,y,2330]),raw([1400,y,2330])],'#223943');
    if(this.camera.cone){
      const rows=this.body.map(row=>row.map(raw)),faces=[];
      for(let j=1;j<rows.length;j++)for(let i=1;i<rows[j].length;i++){
        const world=[this.body[j-1][i-1],this.body[j-1][i],this.body[j][i],this.body[j][i-1]],center=world[0].map((_,k)=>world.reduce((s,p)=>s+p[k],0)/4);
        if(!isConeVisible(center,this.camera,true))continue;
        const points=world.map(raw);faces.push({points,depth:points.reduce((s,p)=>s+p.depth,0)/4});
      }
      if(5000*Math.sin(this.camera.pitch)>(coneGeometry.top-2700)*this.camera.vertical){const points=rows.at(-1);faces.push({points,depth:points.reduce((s,p)=>s+p.depth,0)/points.length});}
      faces.sort((a,b)=>a.depth-b.depth);
      for(const f of faces){c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle='#24434b';c.fill();}
      for(const row of this.body)for(const chunk of visiblePolyline(row,this.camera,true))trace(chunk.map(raw),'#426d77',.65);
      for(let i=0;i<this.body[0].length-1;i+=3)for(const chunk of visiblePolyline(this.body.map(row=>row[i]),this.camera,true))trace(chunk.map(raw),'#426d77',.65);
    }
    // Datum guides show elevation without inventing a mountain surface.
    if(!this.camera.cone)for(const n of this.map.nodes)if(n.kind==='lift_top')trace([project([n.x,n.y,2330]),project([n.x,n.y,n.elevation_m])],'#39505b',1,[3,5]);
    const activeRuns=new Set(sim.mountain.scenario.active_run_ids),activeLifts=new Set(sim.mountain.scenario.active_lifts);
    const routes=(this.camera.cone?this.coneRoutes:this.routes).map(r=>({...r,screen:r.points.map(project)})).sort((a,b)=>a.screen.reduce((s,p)=>s+p.depth,0)/a.screen.length-b.screen.reduce((s,p)=>s+p.depth,0)/b.screen.length);
    this.routeHits=[];
    for(const r of routes){
      const active=r.kind==='run'?activeRuns.has(r.id):r.kind==='lift'?activeLifts.has(r.id):true;
      for(const chunk of visiblePolyline(r.points,this.camera)){
        const screen=chunk.map(project);
        trace(screen,active?r.color:'#364952',this.hover?.id===r.id?3.5:r.kind==='lift'?2.5:1.5,r.kind==='transfer'?[4,4]:[]);
        this.routeHits.push({type:'route',id:r.id,points:screen,text:`${r.id} · ${r.name} · ${Math.round(r.length)} m${active?'':' · closed'}`});
      }
    }
    this.hits=[];
    const agents=[...sim.active].map(id=>sim.agents[id]).filter(a=>a.state!=='QUEUE'&&isConeVisible(agentWorldPosition(sim,a),this.camera)).map(a=>({a,p:project(agentWorldPosition(sim,a))})).sort((a,b)=>a.p.depth-b.p.depth);
    for(const {a,p} of agents){c.beginPath();c.arc(p.x,p.y,a.id===selected?2.25:1.25,0,Math.PI*2);c.fillStyle=classColors[a.class];c.fill();if(a.id===selected){c.strokeStyle='#fff';c.lineWidth=1.5;c.stroke();}this.hits.push({...p,type:'agent',id:a.id,text:`Skier #${a.id} · ${a.class} · ${a.state}`});}
    c.font='10px system-ui';c.textAlign='center';c.textBaseline='middle';
    for(const n of this.map.nodes){
      if(!isConeVisible([n.x,n.y,n.elevation_m],this.camera))continue;
      const p=project([n.x,n.y,n.elevation_m]),lift=this.map.lifts.find(l=>l.base===n.id),color=lift?mapLiftColors(this.map.lifts)[lift.id]:'#a0bdc8';
      if(lift&&activeLifts.has(lift.id)){
        c.beginPath();c.arc(p.x,p.y,14,0,Math.PI*2);c.fillStyle='#0a1822ee';c.fill();c.strokeStyle=color;c.lineWidth=1.5;c.stroke();c.fillStyle='#f1f6f3';c.font='600 11px system-ui';c.fillText(sim.queueSize(lift.id),p.x,p.y);c.font='10px system-ui';
      }else if(n.kind==='base_lodge'){c.fillStyle='#e7d7ad';c.fillRect(p.x-6,p.y-3,12,10);c.beginPath();c.moveTo(p.x-9,p.y-3);c.lineTo(p.x,p.y-11);c.lineTo(p.x+9,p.y-3);c.closePath();c.fill();}else{c.beginPath();c.arc(p.x,p.y,3.5,0,Math.PI*2);c.fillStyle=color;c.fill();}
      if(this.labels){const text=lift?`${lift.id} · ${activeLifts.has(lift.id)?'base':'closed'}`:this.map.behavior?.generated?(n.name??nodeLabel(n.id)):nodeLabel(n.id),labelY=p.y+(n.kind==='base_lodge'?-24:24);c.fillStyle='#081720dd';c.fillRect(p.x-c.measureText(text).width/2-3,labelY-7,c.measureText(text).width+6,14);c.fillStyle=color;c.fillText(text,p.x,labelY);}
      this.hits.push({...p,type:'node',id:n.id,text:`${lift?lift.id+' · ':''}${this.map.behavior?.generated?(n.name??nodeLabel(n.id)):nodeLabel(n.id)} · ${n.elevation_m.toFixed(1)} m${lift?' · queue '+sim.queueSize(lift.id):''}`});
    }
    c.textAlign='left';c.fillStyle='#7898a5';c.font='10px system-ui';c.fillText(this.camera.cone?'SCHEMATIC CONE WRAP · SHARED SIMULATION':'NODE ELEVATIONS + INTERPOLATED ROUTE HEIGHTS',12,height-15);
    if(this.hover&&!this.hits.some(h=>h.type===this.hover.type&&h.id===this.hover.id)&&!this.routeHits.some(h=>h.type===this.hover.type&&h.id===this.hover.id))this.hover=null;
    if(this.hover){c.fillStyle='#e0eee8';c.fillText(this.hover.text.slice(0,Math.floor(width/6.5)),12,20);}
    this.drawGyro();
  }
}
