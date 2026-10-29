import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {liftSettings,configureLift} from '../src/lift-settings.mjs';import {Simulation} from '../src/engine.mjs';
const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url))),config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
test('seat count and revolution determine independent lift capacity and ride duration',()=>{
 const l=map.lifts[0],p=liftSettings(l),a=configureLift(l,{...p,seats:4}),b=configureLift(l,{...p,seats:4,minutes:p.minutes*2});assert.equal(a.capacity_skiers_per_hour,4*p.chairs*60/p.minutes);assert.equal(b.capacity_skiers_per_hour,a.capacity_skiers_per_hour/2);assert.equal(b.ride_minutes,a.ride_minutes*2);assert.throws(()=>configureLift(l,{...p,seats:2.5}));
});
test('multi-seat lifts board FIFO groups with matching chair interval and preserve invariants',()=>{
 const m=structuredClone(map);m.lifts=m.lifts.map(l=>configureLift(l,{...liftSettings(l),seats:4}));const c=structuredClone(config);c.population.main_class_weights={all_mountain:1};const s=new Simulation(m,c,{initialAgents:200,dayMinutes:30});while(!s.done){s.step(60);s.assertInvariants();}assert.ok(Object.values(s.queues).some(q=>q.boarded>0));
});

test('four-seat chair boards four skiers at one chair arrival, not one skier per seat interval',()=>{
 const m=structuredClone(map),l=m.lifts.find(l=>l.id==='L3');Object.assign(l,configureLift(l,{seats:4,minutes:14,chairs:140}));
 const c=structuredClone(config);c.population.main_class_weights={vacationer:1};c.spawning.spawn_node='M_BASE';
 const s=new Simulation(m,c,{initialAgents:20,dayMinutes:1});assert.equal(s.queueSize('L3'),20);s.step(6);assert.equal(s.queues.L3.boarded,4);assert.equal(s.queueSize('L3'),16);s.assertInvariants();
});
