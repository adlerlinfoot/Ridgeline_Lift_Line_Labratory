import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../src/engine.mjs';
import {skeletonRoutes,agentWorldPosition,defaultCamera,projectPoint,Mountain3D,conePoint,coneSurface,coneGeometry,subdividePolyline,isConeVisible,visiblePolyline,nodeLabel} from '../src/mountain3d.mjs';
const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url)));
const config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
const nodes=Object.fromEntries(map.nodes.map(n=>[n.id,n]));

test('3D skeleton preserves every planar waypoint, node elevation and explicit junction',()=>{
  const routes=skeletonRoutes(map),byId=Object.fromEntries(routes.map(r=>[r.id,r]));
  assert.equal(routes.length,30);
  for(const run of map.runs){
    const r=byId[run.id];assert.deepEqual(r.points.map(p=>p.slice(0,2)),run.polyline);
    assert.equal(r.points[0][2],nodes[run.start_node].elevation_m);
    assert.ok(Math.abs(r.points.at(-1)[2]-nodes[run.end_node].elevation_m)<1e-9);
    for(const j of run.junction_nodes??[])assert.equal(r.points[j.polyline_index][2],nodes[j.node_id].elevation_m);
  }
  assert.deepEqual(byId.P01.points.at(-1),byId.B01.points[3]);
  assert.deepEqual(byId.B03.points.at(-1),byId.B09.points[0]);
  assert.deepEqual(byId.B08.points.at(-1),byId.B09.points[0]);
  assert.deepEqual(byId.T01.points.at(-1),byId.B10.points[0]);
  assert.deepEqual(byId.T02.points.at(-1),byId.B10.points[0]);
});

test('3D moving skiers mirror 2D positions and interpolate the same edge progress',()=>{
  const s=new Simulation(map,config,{initialAgents:100});
  for(let i=0;i<40;i++){
    s.step(60);
    for(const id of s.active){const a=s.agents[id],p=agentWorldPosition(s,a);assert.deepEqual(p.slice(0,2),s.position(a));assert.ok(p.every(Number.isFinite));
      if(a.edge&&a.state!=='QUEUE'){
        const start=nodes[a.edge.from].elevation_m,end=nodes[a.edge.to].elevation_m;
        assert.ok(p[2]>=Math.min(start,end)-1e-8&&p[2]<=Math.max(start,end)+1e-8);
      }
    }
  }
});

function fakeCanvas(){
  const events=new Map(),calls=[];
  const ctx=new Proxy({measureText:t=>({width:t.length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});
  return {width:0,height:0,style:{},events,calls,addEventListener:(k,v)=>events.set(k,v),getBoundingClientRect:()=>({left:0,top:0,width:850,height:500}),getContext:()=>ctx,focus:()=>{},setPointerCapture:()=>{}};
}
const event=(extra={})=>({clientX:200,clientY:200,pointerId:1,button:0,preventDefault:()=>{},...extra});

test('orbit, pan, wheel, pinch, keyboard and reset change camera only',()=>{
  const canvas=fakeCanvas(),view=new Mountain3D(canvas,map),home=defaultCamera();
  const fire=(type,e)=>canvas.events.get(type)({...event(),type,...e});
  fire('pointerdown',{});fire('pointermove',{clientX:250,clientY:220});fire('pointerup',{clientX:250,clientY:220});assert.notEqual(view.camera.yaw,home.yaw);
  fire('pointerdown',{shiftKey:true});fire('pointermove',{clientX:230});fire('pointerup',{clientX:230});assert.equal(view.camera.panX,30);
  fire('wheel',{deltaY:-100});assert.ok(view.camera.zoom>home.zoom);
  const z=view.camera.zoom;fire('pointerdown',{});fire('pointerdown',{pointerId:2,clientX:300});fire('pointermove',{pointerId:2,clientX:350});assert.ok(view.camera.zoom>z);fire('pointerup',{pointerId:2});fire('pointerup',{});
  fire('keydown',{key:'Home'});assert.deepEqual(view.camera,home);fire('keydown',{key:'ArrowRight'});assert.notEqual(view.camera.yaw,home.yaw);
  for(let i=0;i<100;i++)fire('wheel',{deltaY:-100});assert.equal(view.camera.zoom,4);
});

test('drawing and picking share agent IDs and never advance or randomize physics',()=>{
  const old=globalThis.window;globalThis.window={devicePixelRatio:1};
  try{
    const s=new Simulation(map,config,{initialAgents:20});s.step(120);const before=JSON.stringify({summary:s.summary(),agents:s.agentRows()});
    s.random=()=>{throw new Error('Renderer accessed RNG');};
    const canvas=fakeCanvas(),view=new Mountain3D(canvas,map);view.draw(s);
    assert.equal(JSON.stringify({summary:s.summary(),agents:s.agentRows()}),before);
    assert.ok(canvas.calls.some(c=>c[0]==='arc'));assert.ok(view.routeHits.length>0);
    const hit=view.hits.find(h=>h.type==='agent');assert.ok(hit);
    assert.ok(view.pick(hit));assert.ok(view.hits.some(h=>h.type==='node'&&h.id==='W_BASE'));
    for(const c of [defaultCamera(),{...defaultCamera(),yaw:2,pitch:1.4,zoom:4}])for(const n of map.nodes){const p=projectPoint([n.x,n.y,n.elevation_m],c,850,500);assert.ok(Object.values(p).every(Number.isFinite));}
  }finally{globalThis.window=old;}
});

test('repeated-experiments panel and browser batch handlers are absent',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
  assert.ok(!html.includes('REPEATED EXPERIMENTS'));assert.ok(!html.includes('id="batch-start"'));assert.ok(!app.includes('batchWorker'));
  assert.ok(html.includes('id="mountain-3d"'));assert.ok(html.includes('data-view="split"'));
});
test('cone wrap keeps elevation and puts routes and skiers on the same conical radius',()=>{
  const g=coneGeometry;
  for(const r of skeletonRoutes(map))for(const p of r.points){const q=conePoint(p),u=Math.max(0,Math.min(1,(p[2]-g.base)/(g.top-g.base)));assert.equal(q[2],p[2]);assert.ok(Math.abs(Math.hypot((q[0]-700)*2,(q[1]-480)*2)-(g.capRadius+g.radius*(1-u)))<1e-8);}
  const surface=coneSurface();assert.equal(surface.length,13);assert.equal(surface[0].length,49);
  const p=[[0,0,2500],[100,80,2800]],dense=subdividePolyline(p);assert.deepEqual(dense[0],p[0]);assert.deepEqual(dense.at(-1),p[1]);assert.ok(dense.length>10);
});
test('on-screen gyroscope supports orbit drag, compass snapping and reset',()=>{
  const canvas=fakeCanvas(),gyro=fakeCanvas(),view=new Mountain3D(canvas,map,{gyro});
  const fire=(type,e)=>gyro.events.get(type)({...event(),type,...e});
  const home=defaultCamera();fire('pointerdown',{});fire('pointermove',{clientX:240,clientY:215});fire('pointerup',{clientX:240,clientY:215});assert.notEqual(view.camera.yaw,home.yaw);assert.notEqual(view.camera.pitch,home.pitch);
  fire('keydown',{key:'Home'});assert.deepEqual(view.camera,home);
  fire('pointerdown',{clientX:425,clientY:5});fire('pointerup',{clientX:425,clientY:5});assert.equal(view.camera.yaw,0);
  fire('dblclick',{});assert.deepEqual(view.camera,home);
});


test('peak display names match requested spelling without changing graph IDs',()=>{
  assert.equal(nodeLabel('W_TOP'),'West peak');assert.equal(nodeLabel('E_TOP'),'East Peak');
  assert.equal(nodeLabel('A_TOP'),'Aspen peak');assert.equal(nodeLabel('M_TOP'),'Meadow top');
});
test('opaque cone hides far-side nodes, labels, skiers and their pick targets as camera rotates',()=>{
  const old=globalThis.window;globalThis.window={devicePixelRatio:1};
  try{
    const s=new Simulation(map,config,{initialAgents:100});s.step(120);const canvas=fakeCanvas(),view=new Mountain3D(canvas,map);
    let hidden=0,visible=0;
    for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      view.camera.yaw=yaw;view.camera.pitch=.2;canvas.calls.length=0;view.draw(s);
      for(const n of map.nodes){const shown=isConeVisible([n.x,n.y,n.elevation_m],view.camera);assert.equal(view.hits.some(h=>h.type==='node'&&h.id===n.id),shown);if(shown)visible++;else{hidden++;assert.ok(!canvas.calls.some(c=>c[0]==='fillText'&&c[1]===nodeLabel(n.id)));}}
      for(const id of s.active){const a=s.agents[id];if(a.state!=='QUEUE')assert.equal(view.hits.some(h=>h.type==='agent'&&h.id===id),isConeVisible(agentWorldPosition(s,a),view.camera));}
    }
    assert.ok(hidden>0&&visible>0);
    view.camera.cone=false;view.draw(s);assert.equal(view.hits.filter(h=>h.type==='node').length,map.nodes.length);
  }finally{globalThis.window=old;}
});
test('horizon clipping emits only visible route segments and is disabled in unwrapped mode',()=>{
  const camera={...defaultCamera(),pitch:.12,yaw:0},rows=coneSurface(),ring=rows[0],chunks=visiblePolyline(ring,camera,true);
  assert.ok(chunks.length>0);assert.ok(chunks.flat().length<ring.length+4);
  for(const p of chunks.flat()){
    const r=conePoint([700,480,2330]);assert.ok(r.every(Number.isFinite));
    // Boundary points are clipped to a numerical approximation of the horizon.
    const near=[p[0],p[1],p[2]];assert.ok(isConeVisible(near,{...camera,pitch:camera.pitch+.0001},true));
  }
  assert.deepEqual(visiblePolyline(ring,{...camera,cone:false},true),[ring]);
});

test('generated 3D map hides placeholder labels while retaining nodes and routes',()=>{
 const m=structuredClone(map);m.behavior={generated:true};m.nodes.forEach(n=>n.name='New node');m.runs.forEach(r=>r.name='New route');m.lifts.forEach(l=>l.name='New lift');
 const oldWindow=globalThis.window;globalThis.window={devicePixelRatio:1};
 const canvas=fakeCanvas(),view=new Mountain3D(canvas,m);view.camera.cone=false;
 const sim=new Simulation(map,config,{initialAgents:0});view.draw(sim);
 assert.ok(view.hits.length>0);assert.ok(view.routeHits.length>0);
 assert.ok(!canvas.calls.filter(c=>c[0]==='fillText').some(c=>/New node|New route|New lift/.test(c[1])));
 assert.ok(!view.hits.some(h=>/New node|New lift/.test(h.text)));assert.ok(!view.routeHits.some(h=>/New route/.test(h.text)));globalThis.window=oldWindow;
});
