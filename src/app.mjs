import {Simulation,csv} from './engine.mjs';
import {Mountain3D,nodeLabel} from './mountain3d.mjs';
const $=id=>document.getElementById(id);
const colors={L1:'#ff666b',L2:'#c7a1ff',L3:'#61c9ed',L4:'#76d7a5'};
const classes={all_mountain:'#4fd1b1',vacationer:'#7fb5ff',lapper:'#ffc16b',mixed:'#e0a3ef'};
const labels={baseline_3_lifts:'3 lifts · baseline',four_lift_capacity_control:'4 lifts · vacationers on L3',four_lift_intervention:'4 lifts · expanded access'};
const fmt=(x,d=0)=>x==null?'—':Number(x).toLocaleString(undefined,{maximumFractionDigits:d});
let map,config,sim,running=false,locked=false,previous=0,accumulator=0,lastPaint=0,view3d,selected=null,positions=[];
function message(text){$('error').hidden=!text;$('error').textContent=text;}
function options(){
  const o={scenario:$('scenario').value,mode:$('mode').value,seed:Number($('seed').value),initialAgents:Number($('population').value),arrivalRate:Number($('rate').value),lodgePercent:Number($('lodge-percent').value)};
  if(!Number.isInteger(o.seed)||o.seed<0||o.seed>4294967295||!Number.isInteger(o.initialAgents)||o.initialAgents<0||o.initialAgents>10000||o.arrivalRate<0||o.arrivalRate>12)throw new Error('Use a whole-number seed, 0–10,000 opening skiers and 0–12 arrivals/minute.');
  return o;
}
function setSettings(){$('lodge-percent-value').textContent=$('lodge-percent').value+'%';document.querySelectorAll('.setting').forEach(e=>e.disabled=locked);$('rate').disabled=locked||$('mode').value==='fixed';}
function reset(){try{running=false;locked=false;accumulator=0;selected=null;sim=new Simulation(map,config,options());$('play').textContent='Start simulation';$('play').disabled=false;setSettings();drawMap();render();message('');}catch(e){message(e.message);$('play').disabled=true;}}
function svg(tag,attrs={},text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;}
function drawMap(){
  const root=$('mountain');root.replaceChildren();
  root.append(svg('rect',{width:1400,height:960,rx:15,fill:'#142730'}));
  // Schematic contours are visual guides only, not inferred physical elevations.
  for(let i=0;i<10;i++)root.append(svg('path',{d:`M -50 ${250+i*72} Q 350 ${-60+i*62} 700 ${225+i*65} T 1450 ${260+i*68}`,fill:'none',stroke:'#2a424a','stroke-width':1,opacity:.55}));
  const active=new Set(sim.mountain.scenario.active_run_ids);
  for(const r of map.runs){const color={green:'#68be91',blue:'#65a3d9',black:'#9aaeb8',park:'#e5a15e'}[r.difficulty];const path=svg('polyline',{points:r.polyline.map(p=>p.join(',')).join(' '),fill:'none',stroke:active.has(r.id)?color:'#33464d','stroke-width':r.difficulty==='park'?6:4,'stroke-linejoin':'round',opacity:active.has(r.id)?.9:.45});path.append(svg('title',{},`${r.id} · ${r.name} · ${r.difficulty}${active.has(r.id)?'':' · closed'}`));root.append(path);}
  for(const t of map.transfers)root.append(svg('polyline',{points:t.polyline.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#637c86','stroke-width':3,'stroke-dasharray':'7 7'}));
  for(const l of map.lifts){const a=sim.mountain.nodes[l.base],b=sim.mountain.nodes[l.top],open=sim.mountain.scenario.active_lifts.includes(l.id);root.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:open?colors[l.id]:'#42565e','stroke-width':7}));for(const n of [a,b])root.append(svg('circle',{cx:n.x,cy:n.y,r:10,fill:'#182d36',stroke:open?colors[l.id]:'#42565e','stroke-width':3}));root.append(svg('text',{x:a.x,y:a.y+43,fill:open?colors[l.id]:'#71858e','font-size':20,'font-family':'system-ui','text-anchor':'middle'},`${l.id} · ${l.name.split(' ')[0]}`));root.append(svg('text',{x:b.x,y:b.y-22,fill:'#a8bec6','font-size':15,'font-family':'system-ui','text-anchor':'middle'},nodeLabel(l.top)));}
  for(const n of map.nodes.filter(n=>!n.kind.startsWith('lift'))){if(n.kind==='base_lodge'){root.append(svg('path',{d:`M ${n.x-16} ${n.y-3} L ${n.x} ${n.y-19} L ${n.x+16} ${n.y-3} Z M ${n.x-11} ${n.y-3} H ${n.x+11} V ${n.y+13} H ${n.x-11} Z`,fill:'#e7d7ad'}));root.append(svg('text',{x:n.x,y:n.y+34,fill:'#e7d7ad','font-size':18,'font-family':'system-ui','text-anchor':'middle'},'Main Lodge · spawn'));continue;}root.append(svg('circle',{cx:n.x,cy:n.y,r:5,fill:'#a5b9bf'}));root.append(svg('text',{x:n.x+10,y:n.y-12,fill:'#77929d','font-size':12,'font-family':'system-ui'},nodeLabel(n.id)));}
  $('map-scenario').textContent=sim.mountain.scenario.active_lifts.includes('L4')?'L4 OPEN · 20 RUNS':'L4 CLOSED · 14 RUNS';
}
function drawAgents(){
  const c=$('agents').getContext('2d');c.clearRect(0,0,1400,960);positions=[];
  for(const aid of sim.active){const a=sim.agents[aid];if(a.state==='QUEUE')continue;const [x,y]=sim.position(a);positions.push({id:aid,x,y});c.fillStyle=classes[a.class];c.beginPath();c.arc(x,y,selected===aid?5:2.7,0,Math.PI*2);c.fill();if(selected===aid){c.strokeStyle='#fff';c.lineWidth=1.5;c.stroke();}}
  for(const l of map.lifts){if(!sim.mountain.scenario.active_lifts.includes(l.id))continue;const n=sim.mountain.nodes[l.base],q=sim.queueSize(l.id);c.beginPath();c.arc(n.x,n.y,20+Math.min(18,Math.sqrt(q)),0,Math.PI*2);c.fillStyle='#101e27ed';c.fill();c.strokeStyle=colors[l.id];c.lineWidth=2;c.stroke();c.fillStyle='#eef4ee';c.font='600 19px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(q,n.x,n.y);}
  view3d?.draw(sim,selected);
}
function chart(){
  const canvas=$('chart'),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(300,Math.round(rect.width*dpr));canvas.height=Math.round(260*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);
  const w=canvas.width/dpr,h=260,left=48,right=15,top=12,bottom=30,metric=$('chart-metric').value;
  const data=sim.samples,maxX=Math.max(60,sim.closeTime/60,sim.t/60),maxY=Math.max(1,...data.map(r=>r[metric]??0))*1.1;
  c.font='10px system-ui';c.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+(h-top-bottom)*i/4;c.strokeStyle='#2a3e47';c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.stroke();c.fillStyle='#8fa6b0';c.textAlign='right';c.fillText(fmt(maxY*(1-i/4),1),left-8,y+3);}
  for(let i=0;i<=7;i++){const mins=maxX*i/7,x=left+(w-left-right)*i/7;c.fillStyle='#8fa6b0';c.textAlign='center';c.fillText(`${Math.round(mins)}m`,x,h-8);}
  for(const id of sim.mountain.scenario.active_lifts){c.strokeStyle=colors[id];c.lineWidth=1.8;c.beginPath();let first=true;for(const r of data){if(r.lift!==id)continue;const x=left+(w-left-right)*r.minutes/maxX,y=top+(h-top-bottom)*(1-(r[metric]??0)/maxY);if(first){c.moveTo(x,y);first=false;}else c.lineTo(x,y);}c.stroke();}
}
function render(){
  drawAgents();const r=sim.summary();const mins=Math.floor(sim.t/60),hh=9+Math.floor(mins/60),mm=mins%60;
  $('clock').textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  $('elapsed').textContent=`${fmt(sim.t/60,1)} / ${sim.options.dayMinutes} operating minutes`;
  $('phase').textContent=sim.done?'Complete · all skiers exited':sim.closed?'Closed · finishing safe routes':running?(sim.options.mode==='arrival'?(sim.t<sim.flowSwitchTime?'Arrivals · ':'Departures · '):'Running · ')+labels[sim.options.scenario]:locked?'Paused':'Ready · opening rush';
  $('active').textContent=fmt(r.active);$('waiting').textContent=fmt(Object.keys(sim.queues).reduce((s,id)=>s+sim.queueSize(id),0));$('boarded').textContent=fmt(Object.values(r.perLift).reduce((s,l)=>s+l.boarded,0));$('switches').textContent=fmt(r.switches);
  $('lift-cards').replaceChildren(...map.lifts.map(l=>{const e=document.createElement('div'),open=sim.mountain.scenario.active_lifts.includes(l.id);e.className='lift-row';e.style.setProperty('--c',colors[l.id]);const strong=document.createElement('strong');strong.textContent=`${l.id} · ${l.name.split(' ')[0]}`;const values=document.createElement('div');values.className='values';const b=document.createElement('b');b.textContent=open?fmt(sim.queueSize(l.id)):'—';const span=document.createElement('span');span.textContent=open?`${fmt(sim.queueSize(l.id)/(l.capacity_skiers_per_hour/60),1)}m`:'closed';values.append(b,span);const sub=document.createElement('small');sub.textContent=`${l.capacity_skiers_per_hour}/h · ${l.ride_minutes}m ride · queue σ ${fmt(r.perLift[l.id].queueStandardDeviation,1)}`;e.append(strong,values,sub);return e;}));
  const states={};for(const aid of sim.active){const state=sim.agents[aid].state;states[state]=(states[state]??0)+1;}
  $('states').replaceChildren(...['QUEUE','LIFT_RIDE','SKI_RUN','SKI_TRAVERSE','BASE_TRANSIT'].map(state=>{const e=document.createElement('div');e.className='state-row';const name=document.createElement('span');name.textContent=state.toLowerCase().replaceAll('_',' ');const n=document.createElement('span');n.textContent=fmt(states[state]??0);e.append(name,n);return e;}));
  $('ski-metric').textContent=`Supporting metric: ${fmt(r.meanSkiingMinutes,1)} downhill minutes per spawned skier.`;
  if(selected!==null){const a=sim.agents[selected];$('agent-detail').textContent=`Skier #${a.id} · ${a.class}${a.subtype?' / '+a.subtype:''} · ${a.state} · destination ${a.destination} · remembered waits: ${Object.entries(a.memory).map(([id,q])=>`${id} ${fmt(q/(sim.mountain.lifts[id].capacity_skiers_per_hour/60),1)}m (seen ${fmt(a.seen[id]/60,1)}m)`).join(' / ')}${a.preferred?' · preferred '+a.preferred.join(', '):''}`;}else $('agent-detail').textContent='Select a moving skier to inspect its state and remembered queues.';
  chart();
}
function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function runExport(){return {schema:'ridgeline-run-1',config,topology:map,summary:sim.summary(),samples:sim.samples,agents:sim.agentRows(),notes:'Synthetic model. Completed waits exclude those unboarded at closing; all waiting time remains in queue-person-minutes. No mathematical stability conclusion is inferred.'};}
function frame(now){
  const dt=previous?Math.min((now-previous)/1000,.25):0;previous=now;
  if(running){accumulator+=dt*Number($('speed').value);const start=performance.now();try{while(accumulator>=1&&!sim.done&&performance.now()-start<12){sim.step(1);accumulator-=1;}if(sim.done){running=false;$('play').textContent='Run complete';$('play').disabled=true;render();}}catch(e){running=false;message(e.message);}}
  if(now-lastPaint>150){render();lastPaint=now;}else drawAgents();requestAnimationFrame(frame);
}
try{
  [map,config]=await Promise.all(['resort-map.json','MODEL_CONFIG.json'].map(async f=>{const r=await fetch(f);if(!r.ok)throw new Error(`Could not load ${f}`);return r.json();}));
  view3d=new Mountain3D($('mountain-3d'),map,{gyro:$('orbit-gyro'),onReset:camera=>{$('height-scale').value=camera.vertical;$('height-value').textContent=camera.vertical.toFixed(1)+'×';$('cone-wrap').checked=camera.cone;},onSelect:id=>{selected=id;render();},onHover:text=>{$('three-help').textContent=text;}});
  reset();
  $('play').onclick=()=>{if(sim.done)return;locked=true;running=!running;setSettings();$('play').textContent=running?'Pause':'Resume';};
  $('reset').onclick=reset;document.querySelectorAll('.setting').forEach(e=>e.onchange=()=>{if(!locked)reset();});
  $('lodge-percent').oninput=()=>{$('lodge-percent-value').textContent=$('lodge-percent').value+'%';};
  $('chart-metric').onchange=chart;window.addEventListener('resize',chart);
  document.querySelectorAll('[data-view]').forEach(button=>{if(button.tagName!=='BUTTON')return;button.onclick=()=>{
    $('map-views').dataset.view=button.dataset.view;
    document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    render();
  };});
  $('camera-reset').onclick=()=>{view3d.reset();$('height-scale').value=1.5;$('height-value').textContent='1.5×';$('cone-wrap').checked=true;render();};
  $('height-scale').oninput=e=>{view3d.camera.vertical=Number(e.target.value);$('height-value').textContent=Number(e.target.value).toFixed(1)+'×';view3d.draw(sim,selected);};
  $('cone-wrap').onchange=e=>{view3d.camera.cone=e.target.checked;view3d.draw(sim,selected);};
  $('node-labels').onchange=e=>{view3d.labels=e.target.checked;view3d.draw(sim,selected);};
  $('agents').onclick=e=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)*1400/r.width,y=(e.clientY-r.top)*960/r.height;let best=18,aid=null;for(const p of positions){const d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;aid=p.id;}}selected=aid;render();};
  $('export-json').onclick=()=>download(`ridgeline-${sim.options.seed}.json`,JSON.stringify(runExport(),null,2),'application/json');
  $('export-series').onclick=()=>download(`ridgeline-queues-${sim.options.seed}.csv`,csv(sim.samples),'text/csv');
  $('export-agents').onclick=()=>download(`ridgeline-skiers-${sim.options.seed}.csv`,csv(sim.agentRows()),'text/csv');
  requestAnimationFrame(frame);
}catch(e){message(`Could not start: ${e.message}. Serve this folder over HTTP; do not open index.html as a file.`);}
