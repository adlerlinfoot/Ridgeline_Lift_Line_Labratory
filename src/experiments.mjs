import {Simulation} from './engine.mjs';

export function aggregate(rows){
  const groups=new Map();
  for(const r of rows){const k=`${r.mode}:${r.scenario}:${r.arrivalRate}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  const t95=n=>n<2?null:({1:12.706,2:4.303,3:3.182,4:2.776,5:2.571,6:2.447,7:2.365,8:2.306,9:2.262,10:2.228,11:2.201,12:2.179,13:2.16,14:2.145,15:2.131,16:2.12,17:2.11,18:2.101,19:2.093,20:2.086,21:2.08,22:2.074,23:2.069,24:2.064,25:2.06,26:2.056,27:2.052,28:2.048,29:2.045}[n-1]??(n<61?2.045:2.0));
  return [...groups.values()].map(g=>{
    const n=g.length,mean=g.reduce((s,r)=>s+r.queuePersonMinutes,0)/n,sd=n>1?Math.sqrt(g.reduce((s,r)=>s+(r.queuePersonMinutes-mean)**2,0)/(n-1)):null,half=sd===null?null:t95(n)*sd/Math.sqrt(n);
    return {mode:g[0].mode,scenario:g[0].scenario,arrivalRate:g[0].arrivalRate,replicates:n,meanQueuePersonMinutes:mean,sdQueuePersonMinutes:sd,ci95Low:half===null?null:mean-half,ci95High:half===null?null:mean+half};
  });
}
export function experimentRow(sim){const r=sim.summary();return {mode:r.options.mode,scenario:r.options.scenario,arrivalRate:r.options.mode==='fixed'?0:r.options.arrivalRate,seed:r.options.seed,spawned:r.spawned,departureAttempts:r.departureAttempts,departureSelections:r.departureSelections,queuePersonMinutes:r.totalQueuePersonMinutes,peakQueue:Math.max(...Object.values(r.perLift).map(q=>q.peakQueue)),meanSkiingMinutes:r.meanSkiingMinutes,switches:r.switches,...Object.fromEntries(Object.entries(r.perLift).flatMap(([id,q])=>[[`${id}_boarded`,q.boarded],[`${id}_queuePersonMinutes`,q.queuePersonMinutes],[`${id}_queueStandardDeviation`,q.queueStandardDeviation],[`${id}_meanCompletedWaitMinutes`,q.meanCompletedWaitMinutes],[`${id}_closingExits`,q.closingExits]]))};}
export function configurations(base,rates,repetitions){
  const result=[];
  if(!Number.isInteger(repetitions)||repetitions<20||repetitions>200)throw new Error('Choose 20–200 replications');
  for(const rate of base.mode==='fixed'?[0]:rates)for(const scenario of ['baseline_3_lifts','four_lift_capacity_control','four_lift_intervention'])for(let i=0;i<repetitions;i++)result.push({...base,arrivalRate:rate,scenario,seed:(base.seed+i)>>>0});
  return result;
}
export function runReplication(map,config,options){const s=new Simulation(map,config,options);s.run();s.assertInvariants();return experimentRow(s);}
