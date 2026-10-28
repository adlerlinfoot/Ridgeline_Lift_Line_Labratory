import {overlayJobs,overlayRun} from './overlays.mjs';
self.onmessage=({data})=>{
  try{
    const jobs=overlayJobs(data.options,data.count);
    for(let i=0;i<jobs.length;i++)self.postMessage({type:'run',run:overlayRun(data.map,data.config,jobs[i]),completed:i+1,total:jobs.length});
    self.postMessage({type:'done'});
  }catch(e){self.postMessage({type:'error',message:e.message});}
};
