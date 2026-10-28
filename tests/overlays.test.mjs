import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {Simulation} from '../src/engine.mjs';
import {overlayJobs,overlayRun,overlayRows,overlayCSV,overlayText} from '../src/overlays.mjs';
import {liftColors} from '../src/palette.mjs';
const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url)));
const config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
const options={scenario:'four_lift_intervention',mode:'arrival',initialAgents:30,arrivalRate:3,lodgePercent:35,dayMinutes:5,seed:17};

test('overlay jobs vary only the seed and keep the selected scenario and parameters',()=>{
  const jobs=overlayJobs(options,3);assert.deepEqual(jobs.map(j=>j.seed),[17,18,19]);
  for(const j of jobs)assert.deepEqual({...j,seed:17},options);
  assert.deepEqual(overlayJobs({...options,seed:4294967295},2).map(j=>j.seed),[4294967295,0]);
  for(const n of [1,201,2.5,NaN])assert.throws(()=>overlayJobs(options,n));
});
test('overlay trajectories exactly match raw simulation observations, not fitted predictions',()=>{
  const run=overlayRun(map,config,options),s=new Simulation(map,config,options);s.run();
  assert.equal(run.series.length,6);assert.equal(run.series.at(-1).minutes,5);
  for(const row of run.series)for(const id of run.activeLifts){const raw=s.samples.find(r=>r.lift===id&&r.minutes===row.minutes);assert.equal(row.queue[id],raw.queue);assert.equal(row.wait[id],raw.estimatedWaitMinutes);}
  assert.deepEqual(overlayRun(map,config,options),run);
  const baseline=overlayRun(map,config,{...options,scenario:'baseline_3_lifts'});assert.ok(baseline.series.every(row=>row.queue.L4===null&&row.wait.L4===null));
});
test('plain text and CSV preserve per-run numeric values and seed/settings provenance',()=>{
  const runs=overlayJobs(options,2).map(o=>overlayRun(map,config,o)),rows=overlayRows(runs),text=overlayText({runs,options,requested:3,cancelled:true,config,map});
  assert.equal(rows.length,12);assert.equal(rows[0].seed,17);assert.equal(rows[6].seed,18);assert.equal(rows[0].L1_queue,runs[0].series[0].queue.L1);
  assert.ok(text.includes('2 / 3 (stopped early)'));assert.ok(text.includes('"lodgePercent":35'));assert.ok(text.includes('PER-RUN LIFT SUMMARIES'));assert.ok(text.includes('MINUTE-BY-MINUTE VALUES'));
  assert.equal(overlayCSV(runs).split('\n').length,13);assert.ok(overlayCSV(runs).includes('L4_estimated_wait_minutes'));
});
test('one shared lift palette serves live, 3D and overlay displays',()=>{
  assert.deepEqual(liftColors,{L1:'#ff666b',L2:'#c7a1ff',L3:'#61c9ed',L4:'#76d7a5'});
  for(const name of ['app.mjs','mountain3d.mjs','overlay-ui.mjs'])assert.ok(readFileSync(new URL('../src/'+name,import.meta.url),'utf8').includes("from './palette.mjs'"));
});
test('overlay worker returns separate complete trajectories for selected-scenario runs',async()=>{
  const target=new URL('../src/overlay-worker.mjs',import.meta.url).href;
  const code=`const {parentPort}=require('node:worker_threads');global.self={postMessage:x=>parentPort.postMessage(x)};import(${JSON.stringify(target)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`;
  const worker=new Worker(code,{eval:true}),runs=[];
  try{
    await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='run')runs.push(m.run);if(m.type==='error')reject(new Error(m.message));if(m.type==='done')resolve();});worker.postMessage({map,config,options,count:3});});
    assert.equal(runs.length,3);assert.deepEqual(runs.map(r=>r.seed),[17,18,19]);assert.ok(runs.every(r=>r.options.scenario===options.scenario&&r.series.length===6));
  }finally{await worker.terminate();}
});
