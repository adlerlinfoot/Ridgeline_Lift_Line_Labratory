import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumChoice, preferredLifts} from '../reference/rules.mjs';
test('strict winners cannot be overridden by random choice', () => {
  assert.equal(minimumChoice([{id:'L1',cost:7},{id:'L2',cost:8}],()=>0.999),'L1');
});
test('equal minima use seeded draw; ride duration is included by caller', () => {
  const costs=[{id:'L1',cost:7},{id:'L2',cost:7}];
  assert.equal(minimumChoice(costs,()=>0),'L1');
  assert.equal(minimumChoice(costs,()=>0.99),'L2');
});
test('preferences rank personal mean waits; never invent unexperienced lifts', () => {
  assert.deepEqual(preferredLifts({L1:{total:10,count:2}}),['L1']);
  assert.deepEqual(preferredLifts({L1:{total:10,count:2},L2:{total:6,count:3},L3:{total:0,count:0}}),['L2','L1']);
});
test('equal experienced mean waits use the seeded tie draw',()=>{
  const waits={L1:{total:10,count:1},L2:{total:20,count:2}};
  assert.deepEqual(preferredLifts(waits,1,()=>0),['L2']);
  assert.deepEqual(preferredLifts(waits,1,()=>0.99),['L1']);
});
