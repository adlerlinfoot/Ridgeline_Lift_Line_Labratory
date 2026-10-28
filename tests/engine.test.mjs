import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation,Mountain,seededRandom,csv} from '../src/engine.mjs';
import {aggregate,configurations} from '../src/experiments.mjs';
const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url)));
const config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
const clone=x=>structuredClone(x);
function advance(s,t){while(s.t<t&&!s.done)s.step(Math.min(60,t-s.t));}
function atBase(c){c=clone(c);c.spawning.spawn_node='M_BASE';return c;}
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
test('all opening skiers start at Main Lodge with zero memories and timed admissible transfers',()=>{
  for(const scenario of Object.keys(map.scenarios)){
    const s=new Simulation(map,config,{scenario}),lodge=s.mountain.nodes.LODGE;
    for(const a of s.agents){assert.ok(Object.values(a.memory).every(x=>x===0));assert.equal(a.node,'LODGE');assert.equal(a.spawnNode,'LODGE');assert.equal(a.state,'BASE_TRANSIT');assert.ok(s.mountain.candidates(a).includes(a.destination));assert.deepEqual(s.position(a),[lodge.x,lodge.y]);assert.ok(a.edge.seconds>0);}
    assert.equal(Object.keys(s.queues).reduce((n,id)=>n+s.queueSize(id),0),0);
  }
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
  const c=atBase(only('vacationer'));const s=new Simulation(map,c,{initialAgents:10,dayMinutes:1});const order=s.queues.L3.ids.slice();
  s.step(6);assert.equal(s.agents[order[0]].state,'LIFT_RIDE');assert.equal(s.agents[order[1]].state,'QUEUE');
  s.step(6);assert.equal(s.agents[order[1]].state,'LIFT_RIDE');assert.equal(s.agents[order[2]].state,'QUEUE');
  const q=new Simulation(map,c,{initialAgents:100,dayMinutes:1});advance(q,60);assert.equal(q.queues.L3.boarded,9);assert.equal(q.queues.L3.closingExits,91);assert.equal(q.summary().perLift.L3.meanQueue,95.5);assert.ok(Math.abs(q.summary().perLift.L3.queueStandardDeviation-Math.sqrt(8.25))<1e-9);q.run();q.assertInvariants();
  const idle=new Simulation(map,c,{initialAgents:0,dayMinutes:20});advance(idle,600);for(let i=0;i<10;i++){const a=idle.createAgent({class:'vacationer',runU:0,spawnU:0,stay:200});idle.commit(a,'L3');}idle.step(6);assert.equal(idle.queues.L3.boarded,1);
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
test('requested departures cannot abandon a queue; closing still removes it',()=>{
  const c=atBase(only('vacationer'));const s=new Simulation(map,c,{initialAgents:100,mode:'arrival',arrivalRate:0,dayMinutes:2});
  for(const a of s.agents)a.departureRequestedAt=0;
  advance(s,10);assert.equal(s.agents.filter(a=>a.state==='EXITED').length,0);assert.equal(s.queueSize('L3'),99);
  advance(s,120);assert.equal(s.queues.L3.boarded,19);assert.equal(s.queues.L3.closingExits,81);s.run();s.assertInvariants();
});
test('requested departure during base transfer finishes its segment, then exits',()=>{
  const c=clone(config);const s=new Simulation(map,c,{mode:'arrival',arrivalRate:0,initialAgents:0});
  const a=s.createAgent({class:'all_mountain',runU:0,spawnU:0,stay:1});a.node='W_BASE';s.commit(a,'L2');s.selectDeparture(0);const first=a.edge.seconds;advance(s,first);assert.equal(a.state,'EXITED');assert.equal(a.node,'M_BASE');assert.equal(s.queues.L2.joined,0);s.assertInvariants();
});
test('paired scenarios share arrival traits and preference horizons; Poisson counts are plausible',()=>{
  const a=new Simulation(map,config,{initialAgents:0,mode:'arrival'}),b=new Simulation(map,config,{initialAgents:0,mode:'arrival',scenario:'four_lift_intervention'});a.run();b.run();
  assert.deepEqual(a.agents.map(x=>[x.born,x.class,x.subtype,x.plannedStay]),b.agents.map(x=>[x.born,x.class,x.subtype,x.plannedStay]));
  assert.ok(a.agents.length>500&&a.agents.length<760);
  const r=seededRandom(8);let n=0;for(let i=0;i<10000;i++)n+=r();assert.ok(Math.abs(n/10000-.5)<.02);
});
test('batch configurations, replicate-level uncertainty and CSV quoting',()=>{
  assert.equal(configurations({mode:'fixed',seed:1},[2,3],20).length,60);assert.equal(configurations({mode:'arrival',seed:1},[2,3],20).length,120);
  assert.throws(()=>configurations({mode:'fixed',seed:1},[2],1));
  const g=aggregate([10,20,30].map(queuePersonMinutes=>({mode:'fixed',scenario:'baseline',arrivalRate:0,queuePersonMinutes})))[0];assert.equal(g.meanQueuePersonMinutes,20);assert.ok(g.ci95Low<20&&g.ci95High>20);
  assert.equal(csv([{a:'x,"y',b:3}]),'"a","b"\n"x,""y","3"');
});
test('arrival flow reverses at halfway, selecting unique existing skiers for safe departures',()=>{
  const s=new Simulation(map,config,{mode:'arrival',arrivalRate:3});
  const spawns=s.events.a.filter(e=>e.kind==='spawn'),departures=s.events.a.filter(e=>e.kind==='departure');
  assert.equal(s.flowSwitchTime,210*60);assert.ok(spawns.length>500&&departures.length>500);
  assert.ok(spawns.every(e=>e.time<210*60));assert.ok(departures.every(e=>e.time>210*60&&e.time<420*60));
  advance(s,210*60);assert.equal(s.departureSelections,0);assert.equal(s.agents.length-s.active.size,0);
  const count=s.agents.length;advance(s,300*60);assert.equal(s.agents.length,count);assert.ok(s.departureSelections>0);
  assert.equal(s.agents.filter(a=>a.departureRequestedAt!==null).length,s.departureSelections);
  s.run();s.assertInvariants();assert.equal(s.active.size,0);
  const fixed=new Simulation(map,config,{mode:'fixed',arrivalRate:12});assert.equal(fixed.events.a.filter(e=>e.kind==='departure'||e.kind==='spawn').length,0);
});
test('departure requested on a descent exits only when its full itinerary completes',()=>{
  const s=new Simulation(map,atBase(only('vacationer')),{mode:'arrival',arrivalRate:0,initialAgents:1});
  advance(s,280);const a=s.agents[0];assert.equal(a.state,'SKI_RUN');s.selectDeparture(0);const end=a.edgeEnd;
  advance(s,end-0.1);assert.equal(a.state,'SKI_RUN');advance(s,end);assert.equal(a.state,'EXITED');assert.equal(a.laps,1);s.assertInvariants();
});
test('departure selections saturate at population without repeat selection or negative counts',()=>{
  const s=new Simulation(map,config,{initialAgents:2});s.selectDeparture(0);s.selectDeparture(0);s.selectDeparture(0);assert.equal(s.departureAttempts,3);assert.equal(s.departureSelections,2);assert.equal(s.active.size,2);s.run();s.assertInvariants();
});
test('morning arrivals follow the 25/35/15/25 class probabilities',()=>{
  const counts={all_mountain:0,vacationer:0,lapper:0,mixed:0};let n=0;
  for(let seed=0;seed<30;seed++){const s=new Simulation(map,config,{mode:'arrival',initialAgents:0,seed});for(const e of s.events.a)if(e.kind==='spawn'){counts[e.data.class]++;n++;}}
  for(const [cls,p] of Object.entries({all_mountain:.25,vacationer:.35,lapper:.15,mixed:.25}))assert.ok(Math.abs(counts[cls]/n-p)<.02,cls);
});

test('lodge splits T04 without adding distance and later arrivals also start there',()=>{
  const s=new Simulation(map,config,{initialAgents:0,mode:'arrival'}),m=s.mountain,lodge=m.nodes.LODGE;
  const total=m.transfer('M_BASE','A_BASE',{class:'vacationer'}),west=m.transfer('LODGE','M_BASE',{class:'vacationer'}),east=m.transfer('LODGE','A_BASE',{class:'vacationer'});
  const seconds=p=>p.reduce((n,e)=>n+e.seconds,0);
  assert.equal(total.length,2);assert.ok(Math.abs(seconds(west)-seconds(east))<1e-8);
  assert.ok(Math.abs(seconds(total)-seconds(west)-seconds(east))<1e-8);
  for(const id of m.scenario.active_lifts)assert.ok(m.transfer('LODGE',m.lifts[id].base,{class:'all_mountain'}));
  advance(s,1200);const a=s.createAgent({class:'vacationer',subtype:'park',runU:0,spawnU:.99});assert.equal(a.node,'LODGE');assert.deepEqual(s.position(a),[lodge.x,lodge.y]);s.commit(a,s.chooseLift(a));
  s.run();assert.ok(s.agents.every(a=>a.spawnNode==='LODGE'));s.assertInvariants();
});
test('lodge percentage supports endpoints and seeded mixtures with class-admissible alternatives',()=>{
  for(const scenario of Object.keys(map.scenarios))for(const lodgePercent of [0,40,100]){
    const s=new Simulation(map,config,{scenario,lodgePercent,initialAgents:1000});let lodge=0;
    for(const a of s.agents){if(a.spawnNode==='LODGE')lodge++;else if(a.spawnEdge)assert.ok(s.mountain.promenadeEdges(a).some(e=>e.id===a.spawnEdge));else assert.ok(s.mountain.candidates(a).includes(s.mountain.baseLift[a.spawnNode]));}
    if(lodgePercent===0)assert.equal(lodge,0);else if(lodgePercent===100)assert.equal(lodge,1000);else assert.ok(Math.abs(lodge/1000-.4)<.05);
    const twin=new Simulation(map,config,{scenario,lodgePercent,initialAgents:1000});assert.deepEqual(s.agents.map(a=>a.spawnNode),twin.agents.map(a=>a.spawnNode));
  }
  assert.throws(()=>new Simulation(map,config,{lodgePercent:-1}));assert.throws(()=>new Simulation(map,config,{lodgePercent:101}));
});
test('lodge percentage also applies to later Poisson arrivals and is exported',()=>{
  const s=new Simulation(map,config,{mode:'arrival',lodgePercent:50});s.run();s.assertInvariants();
  const late=s.agents.filter(a=>a.born>0),lodge=late.filter(a=>a.spawnNode==='LODGE').length;
  assert.ok(lodge>late.length*.4&&lodge<late.length*.6);assert.equal(s.summary().options.lodgePercent,50);
  for(const a of late.filter(a=>a.spawnNode!=='LODGE')){const original={...a,preferred:null};if(a.spawnEdge)assert.ok(s.mountain.promenadeEdges(original).some(e=>e.id===a.spawnEdge));else assert.ok(s.mountain.candidates(original).includes(s.mountain.baseLift[a.spawnNode]));}
});

test('non-lodge origins are uniform by path length and walk continuously to admissible lifts',()=>{
  const c=only('all_mountain'),s=new Simulation(map,c,{lodgePercent:0,initialAgents:3000,scenario:'four_lift_intervention'}),counts={};
  const edges=s.mountain.promenadeEdges(s.agents[0]),total=edges.reduce((n,e)=>n+e.length,0);
  for(const a of s.agents){assert.equal(a.state,'BASE_TRANSIT');assert.ok(a.spawnAccess.length===2);counts[a.spawnEdge]=(counts[a.spawnEdge]??0)+1;assert.deepEqual(s.position(a),[a.spawnPosition.x,a.spawnPosition.y]);assert.ok(a.edge.seconds>0);assert.deepEqual(a.edge.points[0],[a.spawnPosition.x,a.spawnPosition.y]);}
  for(const e of edges)assert.ok(Math.abs((counts[e.id]??0)/3000-e.length/total)<.035,e.id);
  assert.ok(!edges.some(e=>e.parent==='T06'));
  s.step(60);s.assertInvariants();
});
test('vacationers use only the L3-L4 connecting path when both admissible; single-lift specialists stay at their sole base',()=>{
  const c=only('vacationer'),s=new Simulation(map,c,{lodgePercent:0,initialAgents:200,scenario:'four_lift_intervention'});
  assert.ok(s.agents.every(a=>a.spawnPath==='T04'));s.run();s.assertInvariants();
  const baseline=new Simulation(map,c,{lodgePercent:0,initialAgents:100});assert.ok(baseline.agents.every(a=>a.spawnNode==='M_BASE'));
  const race=only('lapper');race.population.lapper_subtype_weights={race:1};const r=new Simulation(map,race,{lodgePercent:0,initialAgents:100});assert.ok(r.agents.every(a=>a.spawnNode==='W_BASE'));
});
test('non-lodge path spawning preserves invariants across every full-day scenario and population mode',()=>{
  for(const mode of ['fixed','arrival'])for(const scenario of Object.keys(map.scenarios)){
    const s=new Simulation(map,config,{lodgePercent:35,mode,scenario,initialAgents:150});while(!s.done){s.step(60);s.assertInvariants();}
  }
});
