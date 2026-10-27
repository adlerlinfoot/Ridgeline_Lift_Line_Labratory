import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation,Mountain,seededRandom,csv} from '../src/engine.mjs';
import {aggregate,configurations} from '../src/experiments.mjs';
const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url)));
const config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
const clone=x=>structuredClone(x);
function advance(s,t){while(s.t<t&&!s.done)s.step(Math.min(60,t-s.t));}
function only(cls){const c=clone(config);c.population.main_class_weights={[cls]:1};return c;}

test('all six full-day configurations conserve population/time/queues at every minute',()=>{
  for(const mode of ['fixed','arrival'])for(const scenario of Object.keys(map.scenarios)){
    const s=new Simulation(map,config,{mode,scenario});
    while(!s.done){s.step(60);s.assertInvariants();}
    assert.equal(s.active.size,0);if(mode==='fixed')assert.equal(s.agents.length,650);
    for(const a of s.agents){assert.equal(a.state,'EXITED');assert.ok(Number.isFinite(a.exitedAt));}
    if(scenario!=='four_lift_intervention')for(const a of s.agents.filter(a=>a.class==='vacationer'))assert.equal(a.visits.L4,undefined);
  }
});
test('seed and physics are independent of frame/step partition',()=>{
  const a=new Simulation(map,config,{initialAgents:90,dayMinutes:35}),b=new Simulation(map,config,{initialAgents:90,dayMinutes:35});
  while(!a.done)a.step(1);while(!b.done)b.step(37);
  assert.deepEqual(a.summary(),b.summary());assert.deepEqual(a.samples,b.samples);assert.deepEqual(a.agentRows(),b.agentRows());
  const c=new Simulation(map,config,{initialAgents:90,dayMinutes:35,seed:7});c.run();assert.notDeepEqual(a.agentRows(),c.agentRows());
});
test('opening memories are simultaneously zero; queues reflect independent class-admissible placements',()=>{
  const s=new Simulation(map,config);
  for(const a of s.agents){assert.ok(Object.values(a.memory).every(x=>x===0));assert.ok(s.mountain.candidates(a).includes(s.mountain.baseLift[a.node]));}
  assert.equal(Object.keys(s.queues).reduce((n,id)=>n+s.queueSize(id),0),650);
  assert.equal(s.queues.L4.joined,0);
});
test('remote queues remain hidden; physical arrival refreshes without rerouting',()=>{
  const s=new Simulation(map,config,{initialAgents:30});const a=s.agents.find(a=>a.class==='all_mountain');
  const remote=a.node==='W_BASE'?'L2':'L1';a.memory[remote]=987;a.seen[remote]=-50;
  s.chooseLift(a);assert.equal(a.memory[remote],987);assert.equal(a.seen[remote],-50);
  // Isolate one moving agent to check the committed arrival path.
  const z=new Simulation(map,config,{initialAgents:0});const p={class:'all_mountain',subtype:'park',runU:0,spawnU:0,stay:200};const x=z.createAgent(p);x.node='W_BASE';x.memory.L2=999;z.commit(x,'L2');
  const eta=x.route.reduce((n,e)=>n+e.seconds,0);advance(z,eta);assert.equal(x.destination,'L2');assert.equal(x.state,'QUEUE');assert.equal(x.memory.L2,0);assert.equal(x.node,'E_BASE');
});
test('FIFO boarding respects service spacing, misses empty slots, and has no closing-time boarding',()=>{
  const c=only('vacationer');const s=new Simulation(map,c,{initialAgents:10,dayMinutes:1});const order=s.queues.L3.ids.slice();
  s.step(3);assert.equal(s.agents[order[0]].state,'LIFT_RIDE');assert.equal(s.agents[order[1]].state,'QUEUE');
  s.step(3);assert.equal(s.agents[order[1]].state,'LIFT_RIDE');assert.equal(s.agents[order[2]].state,'QUEUE');
  const q=new Simulation(map,c,{initialAgents:100,dayMinutes:1});advance(q,60);assert.equal(q.queues.L3.boarded,19);assert.equal(q.queues.L3.closingExits,81);assert.equal(q.summary().perLift.L3.meanQueue,90.5);assert.ok(Math.abs(q.summary().perLift.L3.queueStandardDeviation-Math.sqrt(33.25))<1e-9);q.run();q.assertInvariants();
  const idle=new Simulation(map,c,{initialAgents:0,dayMinutes:20});advance(idle,600);for(let i=0;i<10;i++){const a=idle.createAgent({class:'vacationer',runU:0,spawnU:0,stay:200});idle.commit(a,'L3');}idle.step(3);assert.equal(idle.queues.L3.boarded,1);
});
test('park continuation starts at merge; black connectors continue to safe bases; no top boarding',()=>{
  for(const scenario of Object.keys(map.scenarios)){
    const m=new Mountain(map,config,scenario),paths=m.itineraries('L1',{class:'all_mountain'});
    const park=paths.find(p=>p[0].parent==='P01');assert.equal(park[1].parent,'B01');assert.equal(park[1].from,'PARK_MERGE');assert.deepEqual(park[0].points.at(-1),park[1].points[0]);
    for(const p of paths){assert.equal(p.at(-1).to in m.baseLift,true);for(let i=1;i<p.length;i++)assert.equal(p[i-1].to,p[i].from);}
    const connector=paths.find(p=>p[0].parent==='B03');assert.equal(connector[1].parent,'B09');assert.ok(['G01','G02','U01','U02'].includes(connector[2].parent));
    assert.equal(paths.some(p=>p[0].parent==='B04'),scenario!=='baseline_3_lifts');
  }
});
test('race lappers always repeat western race; other lappers retain assigned full run',()=>{
  for(const subtype of ['race','other','park']){
    const c=only('lapper');c.population.lapper_subtype_weights={[subtype]:1};const s=new Simulation(map,c,{initialAgents:100,dayMinutes:60,scenario:'four_lift_intervention'});s.run();s.assertInvariants();
    for(const a of s.agents){assert.ok(a.laps>0);if(subtype==='race'){assert.equal(a.home,'L1');assert.deepEqual(Object.keys(a.visits),['L1']);}if(subtype==='other')assert.deepEqual(Object.keys(a.visits),[a.home]);}
  }
});
test('mixed preferences freeze at threshold using prior completed waits and never supplement',()=>{
  const c=only('mixed');const s=new Simulation(map,c,{initialAgents:0,dayMinutes:10});const a=s.createAgent({class:'mixed',runU:0,spawnU:0,stay:10});s.commit(a,'L1');a.waits={L1:{total:60,count:1}};
  advance(s,240);assert.deepEqual(a.preferred,['L1']);a.waits.L2={total:0,count:1};s.chooseLift(a);assert.deepEqual(a.preferred,['L1']);
});
test('personal stay expiry cannot abandon a queue; closing still removes it',()=>{
  const c=only('vacationer');c.spawning.personal_stay_minutes={min:.01,max:.01};const s=new Simulation(map,c,{initialAgents:100,mode:'arrival',arrivalRate:0,dayMinutes:2});
  advance(s,10);assert.equal(s.agents.filter(a=>a.state==='EXITED').length,0);assert.equal(s.queueSize('L3'),97);
  advance(s,120);assert.equal(s.queues.L3.boarded,39);assert.equal(s.queues.L3.closingExits,61);s.run();s.assertInvariants();
});
test('expired base transfer finishes its current segment, then exits',()=>{
  const c=clone(config);c.spawning.personal_stay_minutes={min:1,max:1};const s=new Simulation(map,c,{mode:'arrival',arrivalRate:0,initialAgents:0});
  const a=s.createAgent({class:'all_mountain',runU:0,spawnU:0,stay:1});a.node='W_BASE';s.commit(a,'L2');const first=a.edge.seconds;advance(s,first);assert.equal(a.state,'EXITED');assert.equal(a.node,'M_BASE');assert.equal(s.queues.L2.joined,0);s.assertInvariants();
});
test('paired scenarios share demand times, classes and stays; Poisson counts are plausible',()=>{
  const a=new Simulation(map,config,{initialAgents:0,mode:'arrival'}),b=new Simulation(map,config,{initialAgents:0,mode:'arrival',scenario:'four_lift_intervention'});a.run();b.run();
  assert.deepEqual(a.agents.map(x=>[x.born,x.class,x.subtype,x.plannedStay]),b.agents.map(x=>[x.born,x.class,x.subtype,x.plannedStay]));
  assert.ok(a.agents.length>1100&&a.agents.length<1450);
  const r=seededRandom(8);let n=0;for(let i=0;i<10000;i++)n+=r();assert.ok(Math.abs(n/10000-.5)<.02);
});
test('batch configurations, replicate-level uncertainty and CSV quoting',()=>{
  assert.equal(configurations({mode:'fixed',seed:1},[2,3],20).length,60);assert.equal(configurations({mode:'arrival',seed:1},[2,3],20).length,120);
  assert.throws(()=>configurations({mode:'fixed',seed:1},[2],1));
  const g=aggregate([10,20,30].map(queuePersonMinutes=>({mode:'fixed',scenario:'baseline',arrivalRate:0,queuePersonMinutes})))[0];assert.equal(g.meanQueuePersonMinutes,20);assert.ok(g.ci95Low<20&&g.ci95High>20);
  assert.equal(csv([{a:'x,"y',b:3}]),'"a","b"\n"x,""y","3"');
});
