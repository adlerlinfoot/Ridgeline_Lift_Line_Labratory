import {Simulation,csv} from './engine.mjs';

export function overlayJobs(options,count){
  if(!Number.isInteger(count)||count<2||count>200)throw new Error('Choose 2–200 runs');
  if(!Number.isInteger(options.seed)||options.seed<0||options.seed>4294967295)throw new Error('Invalid starting seed');
  return Array.from({length:count},(_,i)=>({...options,seed:(options.seed+i)>>>0}));
}

export function overlayRun(map,config,options){
  const sim=new Simulation(map,config,options);sim.run();sim.assertInvariants();
  const times=new Map();
  for(const r of sim.samples){
    if(r.seconds>sim.closeTime)continue;
    if(!times.has(r.seconds))times.set(r.seconds,{minutes:r.minutes,queue:{},wait:{}});
    const row=times.get(r.seconds);row.queue[r.lift]=r.active?r.queue:null;row.wait[r.lift]=r.estimatedWaitMinutes;
  }
  return {seed:sim.options.seed,options:{...sim.options},activeLifts:[...sim.mountain.scenario.active_lifts],summary:sim.summary(),series:[...times.values()]};
}

export function overlayRows(runs){
  const ids=[...new Set(runs.flatMap(r=>Object.keys(r.series[0]?.queue??{})))];
  return runs.flatMap((run,index)=>run.series.map(row=>({run:index+1,seed:run.seed,minute:row.minutes,...Object.fromEntries(ids.map(id=>[id+'_queue',row.queue[id]])),...Object.fromEntries(ids.map(id=>[id+'_estimated_wait_minutes',row.wait[id]]))})));
}
export const overlayCSV=runs=>csv(overlayRows(runs));

export function overlayText({runs,options,requested,cancelled=false,config,map}){
  const text=['RIDGELINE — REPEATED SIMULATION RUNS','Descriptive overlays of simulation realizations. No prediction, fitting or forecasting.',`Completed runs: ${runs.length} / ${requested}${cancelled?' (stopped early)':''}`,`Parameters: ${JSON.stringify(options)}`,`Config version: ${config.version}`,`Lift capacities / hour: ${map.lifts.map(l=>l.id+'='+l.capacity_skiers_per_hour).join(', ')}`,'Seeds: '+runs.map(r=>r.seed).join(', '),'Only the seed changes between runs. Blank values identify closed lifts.','Estimated wait = queue count / (capacity per minute).','Time 0 is opening; final operating-minute queues are after closing removals. Post-close drain is excluded from plotted time series.','','PER-RUN LIFT SUMMARIES','run\tseed\tlift\tpeak_queue\tqueue_person_minutes\tmean_completed_wait_minutes\tboardings\tclosing_queue_exits'];
  for(let i=0;i<runs.length;i++)for(const id of runs[i].activeLifts){const r=runs[i],q=r.summary.perLift[id];text.push([i+1,r.seed,id,q.peakQueue,q.queuePersonMinutes,q.meanCompletedWaitMinutes??'',q.boarded,q.closingExits].join('\t'));}
  const rows=overlayRows(runs);text.push('','MINUTE-BY-MINUTE VALUES (TAB SEPARATED)');
  if(rows.length){const keys=Object.keys(rows[0]);text.push(keys.join('\t'),...rows.map(r=>keys.map(k=>r[k]??'').join('\t')));}
  return text.join('\n')+'\n';
}
