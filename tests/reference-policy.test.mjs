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

test('ski-time ratio can prefer a longer overhead; equal ratios use uniform seeded ties',async()=>{
 const {maximumRatioChoice}=await import('../reference/rules.mjs');
 assert.equal(maximumRatioChoice([{id:'short',skiMinutes:2,overheadMinutes:3},{id:'long',skiMinutes:8,overheadMinutes:6}],()=>0),'long');
 const tied=[{id:'a',skiMinutes:4,overheadMinutes:2},{id:'b',skiMinutes:8,overheadMinutes:4}];assert.equal(maximumRatioChoice(tied,()=>0),'a');assert.equal(maximumRatioChoice(tied,()=>.99),'b');
 assert.throws(()=>maximumRatioChoice([{id:'bad',skiMinutes:1,overheadMinutes:0}],()=>0));
});
