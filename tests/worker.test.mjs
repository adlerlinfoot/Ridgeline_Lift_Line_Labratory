import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
test('browser worker performs complete 20-replicate comparisons and reports progress',async()=>{
  const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url))),config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
  const target=new URL('../src/batch-worker.mjs',import.meta.url).href;
  const code=`const {parentPort}=require('node:worker_threads');global.self={postMessage:x=>parentPort.postMessage(x)};import(${JSON.stringify(target)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`;
  const worker=new Worker(code,{eval:true});let progress=0;
  try{
    const result=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='progress')progress++;if(m.type==='error')reject(new Error(m.message));if(m.type==='done')resolve(m);});worker.postMessage({map,config,options:{mode:'fixed',seed:1,initialAgents:20,dayMinutes:5},rates:[2,3],repetitions:20});});
    assert.equal(progress,60);assert.equal(result.rows.length,60);assert.equal(result.groups.length,3);assert.ok(result.groups.every(g=>g.replicates===20&&Number.isFinite(g.ci95Low)));
  }finally{await worker.terminate();}
});
