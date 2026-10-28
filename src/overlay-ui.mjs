import {overlayJobs,overlayCSV,overlayText} from './overlays.mjs';
import {liftColors} from './palette.mjs';

export function initializeOverlays({map,config,getOptions,download}){
  const $=id=>document.getElementById(id),canvas=$('overlay-chart');
  let worker=null,data=null,hover=null,plot=null;
  const selected=()=>[...document.querySelectorAll('[data-overlay-lift]:checked')].map(el=>el.dataset.overlayLift);
  function draw(){
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(300,rect.width),h=340;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    const ids=selected(),metric=$('overlay-metric').value,runs=data?.runs??[],left=54,right=18,top=16,bottom=35,maxX=data?.options.dayMinutes??config.time.operating_day_minutes;
    let maxY=1;for(const run of runs)for(const row of run.series)for(const id of ids)maxY=Math.max(maxY,row[metric][id]??0);maxY*=1.08;
    const px=m=>left+(w-left-right)*m/maxX,py=q=>top+(h-top-bottom)*(1-q/maxY);
    plot={left,right,top,bottom,w,h,maxX,maxY};c.font='10px system-ui';
    for(let i=0;i<=4;i++){const y=top+(h-top-bottom)*i/4;c.strokeStyle='#2a3e47';c.lineWidth=1;c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.stroke();c.fillStyle='#9bb2bc';c.textAlign='right';c.fillText((maxY*(1-i/4)).toFixed(metric==='wait'?1:0),left-8,y+3);}
    for(let i=0;i<=7;i++){c.fillStyle='#9bb2bc';c.textAlign='center';c.fillText(Math.round(maxX*i/7)+'m',px(maxX*i/7),h-10);}
    // Every individual run remains visible; lift identity alone determines color.
    for(const run of runs)for(const id of ids){
      if(!run.activeLifts.includes(id))continue;
      c.strokeStyle=liftColors[id];c.globalAlpha=Math.max(.1,Math.min(.65,2.5/Math.sqrt(runs.length||1)));c.lineWidth=1.1;c.beginPath();let started=false;
      for(const row of run.series){const y=row[metric][id];if(y==null)continue;if(started)c.lineTo(px(row.minutes),py(y));else{c.moveTo(px(row.minutes),py(y));started=true;}}c.stroke();
    }
    c.globalAlpha=1;
    if(!runs.length){c.fillStyle='#9bb2bc';c.textAlign='center';c.font='12px system-ui';c.fillText('Run multiple days to overlay their queue trajectories.',w/2,h/2);}
    if(hover){c.strokeStyle='#c2d7d1';c.setLineDash([3,4]);c.beginPath();c.moveTo(px(hover.minute),top);c.lineTo(px(hover.minute),h-bottom);c.stroke();c.setLineDash([]);}
  }
  function exportsEnabled(){const enabled=Boolean(data?.runs.length);$('overlay-txt').disabled=!enabled;$('overlay-csv').disabled=!enabled;}
  function finish(){worker?.terminate();worker=null;$('overlay-start').disabled=false;$('overlay-stop').disabled=true;exportsEnabled();}
  $('overlay-start').onclick=()=>{
    try{
      const options={...getOptions(),dayMinutes:config.time.operating_day_minutes},count=Number($('overlay-count').value);overlayJobs(options,count);
      data={runs:[],options,requested:count,cancelled:false,config,map};hover=null;$('overlay-hover').textContent='Hover the graph to inspect the range of observed values at a minute.';
      $('overlay-parameters').textContent=`${options.scenario} · ${options.mode} · ${options.initialAgents} opening skiers · ${options.arrivalRate}/min flow · ${options.lodgePercent}% lodge · seeds ${options.seed} onward`;
      $('overlay-progress').max=count;$('overlay-progress').value=0;$('overlay-start').disabled=true;$('overlay-stop').disabled=false;exportsEnabled();draw();
      $('overlay-status').textContent=`Running 0 / ${count} simulation days…`;
      worker=new Worker(new URL('./overlay-worker.mjs',import.meta.url),{type:'module'});
      worker.onmessage=({data:message})=>{
        if(message.type==='run'){data.runs.push(message.run);$('overlay-progress').value=data.runs.length;$('overlay-status').textContent=`Completed ${data.runs.length} / ${count} days. Each thin line is one run.`;draw();}
        else if(message.type==='done'){$('overlay-status').textContent=`Complete: ${count} days, identical parameters, different seeds. Descriptive simulation output only.`;finish();}
        else if(message.type==='error'){data.cancelled=true;$('overlay-status').textContent=`Stopped: ${message.message}. Showing ${data.runs.length} completed runs.`;finish();}
      };
      worker.onerror=e=>{data.cancelled=true;$('overlay-status').textContent=`Could not finish: ${e.message??'worker error'}. Showing completed runs only.`;finish();};
      worker.postMessage({map,config,options,count});
    }catch(e){$('overlay-status').textContent=e.message;finish();}
  };
  $('overlay-stop').onclick=()=>{data.cancelled=true;finish();$('overlay-status').textContent=`Stopped after ${data.runs.length} / ${data.requested} days. Showing completed runs only.`;};
  $('overlay-txt').onclick=()=>download('ridgeline-run-overlays.txt',overlayText(data),'text/plain');
  $('overlay-csv').onclick=()=>download('ridgeline-run-overlays.csv',overlayCSV(data.runs),'text/csv');
  $('overlay-metric').onchange=()=>{hover=null;draw();};
  document.querySelectorAll('[data-overlay-lift]').forEach(el=>el.onchange=draw);
  canvas.addEventListener('pointermove',e=>{
    if(!data?.runs.length||!plot)return;
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,minute=Math.max(0,Math.min(plot.maxX,Math.round((x-plot.left)/(plot.w-plot.left-plot.right)*plot.maxX))),metric=$('overlay-metric').value,parts=[];
    for(const id of selected()){
      const values=data.runs.map(run=>run.series.find(row=>Math.abs(row.minutes-minute)<1e-8)?.[metric][id]).filter(v=>v!=null);
      if(values.length)parts.push(`${id}: ${Math.min(...values).toFixed(metric==='wait'?1:0)}–${Math.max(...values).toFixed(metric==='wait'?1:0)}`);
    }
    hover={minute};$('overlay-hover').textContent=`Minute ${minute} · observed min–max across completed runs · ${parts.join(' / ')}${metric==='wait'?' minutes':''}`;draw();
  });
  canvas.addEventListener('pointerleave',()=>{hover=null;draw();});window.addEventListener('resize',draw);draw();
}
