import {Mountain,Simulation} from './engine.mjs';
export const importerOrigin='http://127.0.0.1:43881';
const identifier=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s);
export function prepareImportedMap(bundle,baseConfig,options){
  if(!bundle||bundle.protocol!=='ridgeline.topology.v1'||JSON.stringify(bundle).length>3e6)throw new Error('Invalid or oversized topology plugin payload');
  const map=structuredClone(bundle.map),config=structuredClone(baseConfig);
  if(map?.schema_version!=='ridgeline-import-1'||map.behavior?.generated!==true||!Array.isArray(map.nodes)||map.nodes.length>150||!Array.isArray(map.lifts)||map.lifts.length<1||map.lifts.length>16||!Array.isArray(map.runs)||map.runs.length>300||!Array.isArray(map.transfers)||map.transfers.length>300)throw new Error('Unsupported imported topology');
  const scale=map.coordinate_system?.meters_per_pixel_xy;if(!Number.isFinite(scale)||scale<=0||scale>10000)throw new Error('Invalid map distance scale');
  const nodes=new Set();for(const n of map.nodes){if(!identifier(n.id)||nodes.has(n.id)||![n.x,n.y,n.elevation_m].every(Number.isFinite)||n.x<0||n.x>1400||n.y<0||n.y>960||n.elevation_m<0||n.elevation_m>9000)throw new Error('Invalid imported node');nodes.add(n.id);}
  const ids=new Set();for(const e of [...map.lifts,...map.runs,...map.transfers]){
    if(!identifier(e.id)||ids.has(e.id)||!nodes.has(e.base??e.start_node??e.from)||!nodes.has(e.top??e.end_node??e.to))throw new Error('Invalid imported edge or endpoint');ids.add(e.id);
    if(e.base){if(!Number.isFinite(e.capacity_skiers_per_hour)||e.capacity_skiers_per_hour<1||e.capacity_skiers_per_hour>10000||!Number.isFinite(e.ride_minutes)||e.ride_minutes<=0||e.ride_minutes>60)throw new Error('Invalid imported lift parameters');if(map.nodes.find(n=>n.id===e.base).kind!=='lift_base'||map.nodes.find(n=>n.id===e.top).kind!=='lift_top')throw new Error('Invalid lift node kinds');if(e.polyline){const a=map.nodes.find(n=>n.id===e.base),b=map.nodes.find(n=>n.id===e.top);if(!Array.isArray(e.polyline)||e.polyline.length<2||e.polyline.length>250||e.polyline.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>1400||p[1]<0||p[1]>960)||Math.hypot(e.polyline[0][0]-a.x,e.polyline[0][1]-a.y)>1e-5||Math.hypot(e.polyline.at(-1)[0]-b.x,e.polyline.at(-1)[1]-b.y)>1e-5)throw new Error('Invalid lift geometry');}}
    else{
      if(!Array.isArray(e.polyline)||e.polyline.length<2||e.polyline.length>250||e.polyline.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>1400||p[1]<0||p[1]>960))throw new Error('Invalid imported polyline');
      if(e.start_node&&!['green','blue','black','park'].includes(e.difficulty))throw new Error('Invalid imported difficulty');
      if(e.from&&(!['base_transit','ski_traverse'].includes(e.mode)||!Array.isArray(e.allowed_classes)))throw new Error('Invalid imported transfer');
      const a=map.nodes.find(n=>n.id===(e.start_node??e.from)),b=map.nodes.find(n=>n.id===(e.end_node??e.to));
      if(Math.hypot(e.polyline[0][0]-a.x,e.polyline[0][1]-a.y)>1e-5||Math.hypot(e.polyline.at(-1)[0]-b.x,e.polyline.at(-1)[1]-b.y)>1e-5)throw new Error('Route geometry does not meet its declared nodes');
      if(e.polyline.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-e.polyline[i][0],p[1]-e.polyline[i][1]),0)<1e-6)throw new Error('Zero-length imported route');
      if((e.start_node||e.mode==='ski_traverse')&&a.elevation_m<=b.elevation_m)throw new Error('Downhill direction/elevation conflict');
      if(e.mode==='base_transit'&&[a,b].some(n=>!['lift_base','base_lodge','base_junction','race_finish'].includes(n.kind)))throw new Error('Walking path cannot connect to a summit');
    }
  }
  if(!identifier(bundle.spawnNode)||!nodes.has(bundle.spawnNode)||map.nodes.find(n=>n.id===bundle.spawnNode).kind!=='base_lodge')throw new Error('Imported map needs a Main Lodge');
  const scenario=map.scenarios?.imported;
  if(!scenario||Object.keys(map.scenarios).length!==1||JSON.stringify(scenario.active_lifts)!==JSON.stringify(map.lifts.map(l=>l.id))||JSON.stringify(scenario.active_run_ids)!==JSON.stringify(map.runs.map(r=>r.id)))throw new Error('Imported scenario must match its declared lifts and runs');
  config.spawning.spawn_node=bundle.spawnNode;
  const mountain=new Mountain(map,config,'imported');
  for(const cls of ['all_mountain','vacationer']){
    const a={class:cls};const candidates=mountain.candidates(a);if(!candidates.length)throw new Error('No complete admissible descent for '+cls);
    for(const id of candidates)if(!mountain.transfer(bundle.spawnNode,mountain.lifts[id].base,a))throw new Error('Lodge cannot reach '+id+' for '+cls);
  }
  const trial=new Simulation(map,config,{...options,scenario:'imported'});trial.assertInvariants();
  return {map,config};
}

export function connectMapImporter({getConfig,getOptions,onApply,onRestore}){
  const $=id=>document.getElementById(id),dialog=$('map-import-dialog'),frame=$('map-import-frame');
  $('map-import-open').onclick=()=>{if(!frame.getAttribute('src'))frame.src=importerOrigin;dialog.showModal();};
  $('map-import-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(frame.contentWindow)frame.contentWindow.postMessage({type:'ridgeline.importer.cancel'},importerOrigin);});
  $('map-restore').onclick=()=>onRestore();
  async function apply(bundle){const prepared=prepareImportedMap(bundle,getConfig(),getOptions());await onApply(prepared);$('map-plugin-status').textContent=`Loaded ${prepared.map.name}: ${prepared.map.lifts.length} lifts, ${prepared.map.runs.length} run segments. Changes apply to a new run.`;dialog.close();}
  window.addEventListener('message',async event=>{
    if(event.origin!==importerOrigin||event.source!==frame.contentWindow||event.data?.type!=='ridgeline.topology.v1')return;
    try{await apply(event.data.bundle);frame.contentWindow.postMessage({type:'ridgeline.topology.result',ok:true},importerOrigin);}catch(e){frame.contentWindow.postMessage({type:'ridgeline.topology.result',ok:false,error:e.message},importerOrigin);$('map-plugin-status').textContent=e.message;}
  });
  $('map-import-file').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>3e6)throw new Error('Topology file too large');await apply(JSON.parse(await file.text()));}catch(e){$('map-plugin-status').textContent=e.message;}finally{event.target.value='';}};
}
