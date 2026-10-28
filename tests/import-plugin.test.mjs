import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {prepareImportedMap} from '../src/import-plugin.mjs';import {Simulation} from '../src/engine.mjs';import {mapLiftColors} from '../src/palette.mjs';import {overlayRun,overlayRows} from '../src/overlays.mjs';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/imported.json',import.meta.url)));
const config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
test('separate-plugin payload loads arbitrary lift IDs with class-safe itineraries and conserved time',()=>{
  const b=fixture(),before=JSON.stringify(config),{map,config:c}=prepareImportedMap(b,config,{seed:9,initialAgents:100,lodgePercent:35});assert.equal(JSON.stringify(config),before);assert.equal(c.spawning.spawn_node,'home');
  for(const mode of ['fixed','arrival']){const s=new Simulation(map,c,{scenario:'imported',mode,seed:9,initialAgents:100,dayMinutes:60,lodgePercent:35});while(!s.done){s.step(60);s.assertInvariants();}assert.equal(s.active.size,0);assert.ok(s.agents.filter(a=>a.class==='vacationer').every(a=>!a.visits.Chair_2));assert.ok(s.agents.filter(a=>a.class==='lapper').every(a=>a.subtype==='other'));}
});
test('host independently rejects invalid or disconnected plugin data',()=>{
  const mutations=[b=>b.protocol='bad',b=>b.map.nodes[0].id='__proto__',b=>b.map.lifts[0].ride_minutes=-1,b=>b.map.runs[0].polyline[0]=[999,999],b=>b.spawnNode='missing',b=>b.map.transfers=[],b=>b.map.runs.forEach(r=>r.difficulty='black')];
  for(const change of mutations){const b=fixture();change(b);assert.throws(()=>prepareImportedMap(b,config,{initialAgents:10}));}
});
test('imported map overlays and colors follow arbitrary lift IDs',()=>{
  const {map,config:c}=prepareImportedMap(fixture(),config,{initialAgents:10}),run=overlayRun(map,c,{scenario:'imported',initialAgents:20,dayMinutes:5,seed:3});const rows=overlayRows([run]);assert.ok('Chair_0_queue' in rows[0]);assert.ok('Chair_2_estimated_wait_minutes' in rows[0]);assert.equal(new Set(Object.values(mapLiftColors([{id:'Chair_A'},{id:'L1'},{id:'Chair_B'}]))).size,3);
});
test('imported physical scale is used for walking as well as skiing',()=>{
  const {map,config:c}=prepareImportedMap(fixture(),config,{initialAgents:0}),s=new Simulation(map,c,{scenario:'imported',initialAgents:0}),edge=s.mountain.edges.find(e=>e.parent==='WalkA');assert.ok(Math.abs(edge.length-800)<1e-8);assert.ok(Math.abs(edge.seconds-800/c.movement.base_transit_meters_per_second)<1e-8);
});
