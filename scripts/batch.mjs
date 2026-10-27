import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {configurations,runReplication,aggregate} from '../src/experiments.mjs';
import {csv} from '../src/engine.mjs';
const map=JSON.parse(readFileSync(new URL('../resort-map.json',import.meta.url))),config=JSON.parse(readFileSync(new URL('../MODEL_CONFIG.json',import.meta.url)));
const mode=process.argv[2]??'fixed',repetitions=Number(process.argv[3]??20),options={mode,seed:config.seed_default,initialAgents:650,dayMinutes:420};
const jobs=configurations(options,[2,3,4,6],repetitions),rows=[];
for(const o of jobs){rows.push(runReplication(map,config,o));if(rows.length%20===0)console.log(`${rows.length}/${jobs.length}`);}
mkdirSync(new URL('../.runtime/',import.meta.url),{recursive:true});
writeFileSync(new URL(`../.runtime/batch-${mode}.json`,import.meta.url),JSON.stringify({options,repetitions,config,topology:map,groups:aggregate(rows),rows},null,2));
writeFileSync(new URL(`../.runtime/batch-${mode}.csv`,import.meta.url),csv(rows));
console.log(JSON.stringify(aggregate(rows),null,2));
