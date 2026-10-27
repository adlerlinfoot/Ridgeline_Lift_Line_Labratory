import {minimumChoice, preferredLifts} from '../reference/rules.mjs';

export function seededRandom(seed) {
  let x = Number(seed) >>> 0;
  return () => { x += 0x6D2B79F5; let z=x; z=Math.imul(z^(z>>>15),z|1); z^=z+Math.imul(z^(z>>>7),z|61); return ((z^(z>>>14))>>>0)/4294967296; };
}
const sumLength = points => points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-points[i][0],p[1]-points[i][1])*2,0);
const category = state => ({QUEUE:'queue',LIFT_RIDE:'uphill',SKI_RUN:'skiing',SKI_TRAVERSE:'transit',BASE_TRANSIT:'transit'})[state];

// Event time is physical time in seconds. step() is a fixed-time driver; rendering never advances physics.
class Heap {
  constructor(){this.a=[];this.seq=0;}
  less(x,y){return x.time<y.time || (x.time===y.time && (x.priority<y.priority || (x.priority===y.priority&&x.seq<y.seq)));}
  push(time,priority,kind,data){const e={time,priority,kind,data,seq:this.seq++};let i=this.a.length;this.a.push(e);while(i){const p=(i-1)>>1;if(!this.less(e,this.a[p]))break;this.a[i]=this.a[p];i=p;}this.a[i]=e;}
  pop(){const top=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(true){let j=i*2+1;if(j>=this.a.length)break;if(j+1<this.a.length&&this.less(this.a[j+1],this.a[j]))j++;if(!this.less(this.a[j],last))break;this.a[i]=this.a[j];i=j;}this.a[i]=last;}return top;}
  peek(){return this.a[0];}
}

export class Mountain {
  constructor(map, config, scenario) {
    this.map=map; this.config=config; this.scenario=map.scenarios[scenario];
    if(!this.scenario)throw new Error('Unknown scenario');
    this.nodes=Object.fromEntries(map.nodes.map(n=>[n.id,n]));
    this.lifts=Object.fromEntries(map.lifts.map(l=>[l.id,l]));
    this.baseLift=Object.fromEntries(map.lifts.map(l=>[l.base,l.id]));
    this.runs=Object.fromEntries(map.runs.map(r=>[r.id,r]));
    this.down={};this.walk={};this.edges=[];this.pathCache=new Map();
    const add=(e,g)=>{this.edges.push(e);(g[e.from]??=[]).push(e);};
    for(const r of map.runs){
      if(!this.scenario.active_run_ids.includes(r.id))continue;
      if(!(r.requires_active_lifts??[]).every(id=>this.scenario.active_lifts.includes(id)))continue;
      const stops=[{node_id:r.start_node,polyline_index:0},...(r.junction_nodes??[]),{node_id:r.end_node,polyline_index:r.polyline.length-1}].sort((a,b)=>a.polyline_index-b.polyline_index);
      for(let i=1;i<stops.length;i++){
        const points=r.polyline.slice(stops[i-1].polyline_index,stops[i].polyline_index+1);
        add({id:`${r.id}:${i}`,parent:r.id,from:stops[i-1].node_id,to:stops[i].node_id,points,length:sumLength(points),seconds:sumLength(points)/config.movement.run_meters_per_second,state:'SKI_RUN',difficulty:r.difficulty},this.down);
      }
    }
    for(const tr of map.transfers){
      const speed=tr.mode==='base_transit'?config.movement.base_transit_meters_per_second:config.movement.ski_traverse_meters_per_second;
      const edge={id:tr.id,parent:tr.id,from:tr.from,to:tr.to,points:tr.polyline,length:sumLength(tr.polyline),seconds:sumLength(tr.polyline)/speed,state:tr.mode==='base_transit'?'BASE_TRANSIT':'SKI_TRAVERSE',allowed:tr.allowed_classes};
      add(edge,tr.mode==='base_transit'?this.walk:this.down);
      if(tr.bidirectional)add({...edge,id:`${tr.id}:reverse`,from:tr.to,to:tr.from,points:[...tr.polyline].reverse()},this.walk);
    }
  }
  allowed(edge,a){return a.class!=='vacationer'||(edge.state==='BASE_TRANSIT'?edge.allowed.includes('all'):['green','blue'].includes(edge.difficulty));}
  transfer(from,to,a){
    if(from===to)return [];
    const dist={[from]:0},paths={[from]:[]},todo=new Set([from]);
    while(todo.size){const n=[...todo].sort((a,b)=>dist[a]-dist[b])[0];todo.delete(n);if(n===to)return paths[n];
      for(const e of this.walk[n]??[]){if(!this.allowed(e,a))continue;const cost=dist[n]+e.seconds;if(cost<(dist[e.to]??Infinity)){dist[e.to]=cost;paths[e.to]=[...paths[n],e];todo.add(e.to);}}
    }
    return null;
  }
  itineraries(lift,a){
    const key=`${lift}:${a.class==='vacationer'?'novice':'expert'}`;
    if(this.pathCache.has(key))return this.pathCache.get(key);
    const paths=[];
    const visit=(node,path,seen)=>{
      if(this.baseLift[node]){paths.push(path);return;}
      if(node==='RACE_FINISH'){paths.push([...path,this.walk[node].find(e=>e.to==='W_BASE')]);return;}
      for(const e of this.down[node]??[]){if(!this.allowed(e,a)||seen.has(e.to))continue;visit(e.to,[...path,e],new Set([...seen,e.to]));}
    };
    visit(this.lifts[lift].top,[],new Set());this.pathCache.set(key,paths);return paths;
  }
  candidates(a){
    if(a.class==='vacationer')return this.scenario.vacationer_lifts;
    if(a.class==='lapper')return a.subtype==='park'?['L1','L2']:[a.home];
    return a.preferred??this.scenario.active_lifts;
  }
}

export class Simulation {
  constructor(map,config,options={}){
    this.config=config;this.options={scenario:'baseline_3_lifts',mode:'fixed',seed:config.seed_default,initialAgents:config.population.initial_agents,arrivalRate:config.spawning.arrivals_per_minute,dayMinutes:config.time.operating_day_minutes,...options};
    for(const k of ['seed','initialAgents','arrivalRate','dayMinutes'])if(!Number.isFinite(this.options[k]))throw new Error(`Invalid ${k}`);
    if(this.options.initialAgents<0||!Number.isInteger(this.options.initialAgents)||this.options.arrivalRate<0||this.options.dayMinutes<=0)throw new Error('Invalid population, rate or day length');
    if(!['fixed','arrival'].includes(this.options.mode))throw new Error('Invalid population mode');
    this.mountain=new Mountain(map,config,this.options.scenario);this.random=seededRandom(this.options.seed);this.events=new Heap();this.agents=[];this.active=new Set();this.t=0;this.closed=false;this.done=false;this.closeTime=this.options.dayMinutes*60;this.samples=[];this.switches=0;this.beliefAbs=0;this.beliefN=0;
    this.queues=Object.fromEntries(map.lifts.map(l=>[l.id,{ids:[],head:0,joined:0,boarded:0,closingExits:0,area:0,squaredArea:0,changedAt:0,peak:0,waitTotal:0,waitCount:0,maxWait:0,abandonedWait:0}]));
    // Demand traits are generated before behavior so paired scenarios share exogenous arrivals/classes/stays.
    const profiles=[];
    const profile=time=>({time,class:this.weighted(config.population.main_class_weights),subtype:this.weighted(config.population.lapper_subtype_weights),runU:this.random(),spawnU:this.random(),stay:config.spawning.personal_stay_minutes.min+this.random()*(config.spawning.personal_stay_minutes.max-config.spawning.personal_stay_minutes.min)});
    for(let i=0;i<this.options.initialAgents;i++)profiles.push(profile(0));
    if(this.options.mode==='arrival'&&this.options.arrivalRate>0){let t=0;while(true){t+=-Math.log(1-this.random())*60/this.options.arrivalRate;if(t>=this.closeTime)break;profiles.push(profile(t));}}
    this.events.push(this.closeTime,0,'close');
    for(const id of this.mountain.scenario.active_lifts){const interval=3600/this.mountain.lifts[id].capacity_skiers_per_hour;this.events.push(interval,3,'board',id);}
    const opening=profiles.filter(p=>p.time===0).map(p=>this.createAgent(p,true));
    // Decisions are simultaneous against zero opening queues. FIFO admission order is seeded-random.
    const choices=opening.map(a=>[a,this.chooseLift(a,true)]);
    for(let i=choices.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
    for(const [a,id] of choices)this.commit(a,id,true);
    for(const p of profiles)if(p.time>0)this.events.push(p.time,2,'spawn',p);
    this.sample();this.events.push(60,4,'sample');
  }
  weighted(weights){let x=this.random()*Object.values(weights).reduce((a,b)=>a+b,0);for(const [k,w] of Object.entries(weights)){x-=w;if(x<0)return k;}return Object.keys(weights).at(-1);}
  queueSize(id){const q=this.queues[id];return q.ids.length-q.head;}
  createAgent(p,opening=false){
    const a={id:this.agents.length,class:p.class,subtype:p.class==='lapper'?p.subtype:null,home:null,run:null,preferred:null,waits:{},memory:{},seen:{},born:this.t,plannedStay:this.options.mode==='fixed'?this.closeTime:p.stay*60,node:null,state:'BASE_DECISION',since:this.t,counters:{skiing:0,queue:0,uphill:0,transit:0},visits:{},switches:0,laps:0,lastLift:null,route:[],routeIndex:0};
    if(a.subtype==='race')a.home='L1';
    if(a.subtype==='other'){
      const candidates=[...this.config.population.lapper_other_candidate_runs.always_available,...(this.mountain.scenario.active_lifts.includes('L4')?this.config.population.lapper_other_candidate_runs.if_L4_active:[])];
      a.run=candidates[Math.floor(p.runU*candidates.length)];a.home=this.mountain.runs[a.run].primary_lift;
    }
    const lifts=this.mountain.candidates(a);a.node=this.mountain.lifts[lifts[Math.floor(p.spawnU*lifts.length)]].base;
    for(const id of this.mountain.scenario.active_lifts){a.memory[id]=opening?0:this.queueSize(id);a.seen[id]=this.t;}
    this.agents.push(a);this.active.add(a.id);
    if(a.class==='mixed')this.events.push(a.born+a.plannedStay*this.config.population.mixed_exploration_fraction_of_planned_stay,1,'preferences',a.id);
    return a;
  }
  expired(a){return this.options.mode==='arrival'&&this.t-a.born>=a.plannedStay;}
  observe(a){const id=this.mountain.baseLift[a.node];if(id&&this.mountain.scenario.active_lifts.includes(id)){a.memory[id]=this.queueSize(id);a.seen[id]=this.t;}}
  chooseLift(a,opening=false){
    if(!opening)this.observe(a);
    if(a.class==='mixed'&&!a.preferred&&this.t-a.born>=a.plannedStay*this.config.population.mixed_exploration_fraction_of_planned_stay){const ids=preferredLifts(a.waits,this.config.population.mixed_preferred_lift_count,this.random);if(ids.length)a.preferred=ids;}
    const candidates=this.mountain.candidates(a).map(id=>{
      const path=this.mountain.transfer(a.node,this.mountain.lifts[id].base,a);
      return {id,cost:path===null?Infinity:path.reduce((s,e)=>s+e.seconds,0)/60+a.memory[id]/(this.mountain.lifts[id].capacity_skiers_per_hour/60)+this.mountain.lifts[id].ride_minutes};
    }).filter(x=>Number.isFinite(x.cost));
    return minimumChoice(candidates,this.random,this.config.decision.tie_epsilon_minutes);
  }
  commit(a,id,opening=false){
    a.destination=id;
    if(a.lastLift&&a.lastLift!==id){a.switches++;this.switches++;}
    const path=this.mountain.transfer(a.node,this.mountain.lifts[id].base,a);
    if(path===null)throw new Error('Unreachable committed destination');
    if(path.length)this.beginRoute(a,path,'toLift');else this.join(a,id,opening);
  }
  transition(a,state){const c=category(a.state);if(c)a.counters[c]+=this.t-a.since;a.state=state;a.since=this.t;}
  updateArea(id){const q=this.queues[id],size=this.queueSize(id),dt=this.t-q.changedAt;q.area+=size*dt;q.squaredArea+=size*size*dt;q.changedAt=this.t;}
  join(a,id,opening=false){
    if(this.closed||this.expired(a)){this.exit(a);return;}
    if(!opening)this.observe(a);
    this.updateArea(id);const q=this.queues[id];q.ids.push(a.id);q.joined++;q.peak=Math.max(q.peak,this.queueSize(id));a.queueLift=id;a.queuedAt=this.t;this.transition(a,'QUEUE');
  }
  board(id){
    if(this.closed)return;
    const q=this.queues[id];
    if(this.queueSize(id)){
      this.updateArea(id);const a=this.agents[q.ids[q.head++]];q.boarded++;
      const wait=this.t-a.queuedAt;q.waitTotal+=wait;q.waitCount++;q.maxWait=Math.max(q.maxWait,wait);
      const w=a.waits[id]??={total:0,count:0};w.total+=wait;w.count++;
      a.visits[id]=(a.visits[id]??0)+1;a.lastLift=id;this.transition(a,'LIFT_RIDE');
      const l=this.mountain.lifts[id];const from=this.mountain.nodes[l.base],to=this.mountain.nodes[l.top];
      a.edge={id,from:l.base,to:l.top,points:[[from.x,from.y],[to.x,to.y]],seconds:l.ride_minutes*60,state:'LIFT_RIDE'};a.edgeStart=this.t;a.edgeEnd=this.t+a.edge.seconds;
      this.events.push(a.edgeEnd,1,'summit',a.id);
      if(q.head>2048&&q.head*2>q.ids.length){q.ids=q.ids.slice(q.head);q.head=0;}
    }
    const next=this.t+3600/this.mountain.lifts[id].capacity_skiers_per_hour;
    if(next<this.closeTime)this.events.push(next,3,'board',id);
  }
  descent(a){
    const id=a.lastLift;a.node=this.mountain.lifts[id].top;
    let routes=this.mountain.itineraries(id,a);
    if(a.subtype==='park')routes=routes.filter(p=>p[0].parent===(id==='L1'?'P01':'P02'));
    if(a.subtype==='race')routes=routes.filter(p=>p[0].parent==='T01'&&p.some(e=>e.parent==='B10'));
    if(a.subtype==='other')routes=routes.filter(p=>p.every(e=>e.parent===a.run));
    if(!routes.length)throw new Error(`No legal itinerary for ${a.id}/${id}/${a.run}`);
    this.beginRoute(a,routes[Math.floor(this.random()*routes.length)],'descent');
  }
  beginRoute(a,path,purpose){a.route=path;a.routeIndex=0;a.routePurpose=purpose;this.beginEdge(a);}
  beginEdge(a){const e=a.route[a.routeIndex];if(a.node!==e.from)throw new Error('Disconnected movement');this.transition(a,e.state);a.edge=e;a.edgeStart=this.t;a.edgeEnd=this.t+e.seconds;this.events.push(a.edgeEnd,1,'edge',a.id);}
  endEdge(a){
    a.node=a.edge.to;
    if(a.routePurpose==='toLift'){
      const id=this.mountain.baseLift[a.node];
      if(id&&this.mountain.scenario.active_lifts.includes(id)){this.beliefAbs+=Math.abs(a.memory[id]-this.queueSize(id))/(this.mountain.lifts[id].capacity_skiers_per_hour/60);this.beliefN++;}
      this.observe(a);
      if(this.closed||this.expired(a)){this.exit(a);return;}
    }
    a.routeIndex++;
    if(a.routeIndex<a.route.length){this.beginEdge(a);return;}
    if(a.routePurpose==='toLift'){this.join(a,a.destination);return;}
    a.laps++;this.transition(a,'BASE_DECISION');a.edge=null;
    if(this.closed||this.expired(a))this.exit(a);else this.commit(a,this.chooseLift(a));
  }
  exit(a){this.transition(a,'EXITED');a.exitedAt=this.t;a.edge=null;this.active.delete(a.id);}
  close(){
    this.closed=true;
    for(const id of this.mountain.scenario.active_lifts){const q=this.queues[id];this.updateArea(id);
      while(this.queueSize(id)){const a=this.agents[q.ids[q.head++]];q.closingExits++;q.abandonedWait+=this.t-a.queuedAt;this.exit(a);}
    }
  }
  step(seconds=this.config.time.simulation_step_seconds){
    if(this.done)return;
    if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Step must be positive');
    const end=this.t+seconds;
    while(this.events.peek()&&this.events.peek().time<=end){const e=this.events.pop();this.t=e.time;
      if(e.kind==='close')this.close();
      else if(e.kind==='board')this.board(e.data);
      else if(e.kind==='spawn'){const a=this.createAgent(e.data);this.commit(a,this.chooseLift(a));}
      else if(e.kind==='summit')this.descent(this.agents[e.data]);
      else if(e.kind==='edge')this.endEdge(this.agents[e.data]);
      else if(e.kind==='preferences'){const a=this.agents[e.data];if(a.state!=='EXITED'){const ids=preferredLifts(a.waits,this.config.population.mixed_preferred_lift_count,this.random);if(ids.length)a.preferred=ids;}}
      else if(e.kind==='sample'){this.sample();if(!this.closed||this.active.size)this.events.push(this.t+60,4,'sample');}
      if(this.closed&&!this.active.size){this.done=true;if(this.samples.at(-1)?.seconds!==this.t)this.sample();break;}
    }
    if(!this.done)this.t=end;
  }
  run(){while(!this.done)this.step(60);return this.summary();}
  counters(a){const c={...a.counters},k=category(a.state);if(k)c[k]+=this.t-a.since;return c;}
  sample(){
    for(const id of Object.keys(this.queues)){
      const q=this.queues[id],l=this.mountain.lifts[id],active=this.mountain.scenario.active_lifts.includes(id);
      const prev=this.samples.findLast(r=>r.lift===id),interval=prev?(this.t-prev.seconds)/60:0;
      this.samples.push({seconds:this.t,minutes:this.t/60,lift:id,active,queue:this.queueSize(id),estimatedWaitMinutes:active?this.queueSize(id)/(l.capacity_skiers_per_hour/60):null,joined:q.joined,boarded:q.boarded,closingExits:q.closingExits,arrivalRatePerMinute:interval?(q.joined-prev.joined)/interval:null,boardingRatePerMinute:interval?(q.boarded-prev.boarded)/interval:null,queuePersonMinutes:(q.area+this.queueSize(id)*(this.t-q.changedAt))/60,completedWaitMeanMinutes:q.waitCount?q.waitTotal/q.waitCount/60:null,activePopulation:this.active.size});
    }
  }
  position(a){
    if(!a.edge||a.state==='QUEUE'||a.state==='EXITED'){const n=this.mountain.nodes[a.node];return [n.x,n.y];}
    const pts=a.edge.points,length=sumLength(pts),fraction=Math.max(0,Math.min(1,(this.t-a.edgeStart)/(a.edgeEnd-a.edgeStart)));let target=fraction*length;
    for(let i=1;i<pts.length;i++){const n=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])*2;if(target<=n)return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*target/n,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*target/n];target-=n;}return pts.at(-1);
  }
  agentRows(){return this.agents.map(a=>{const c=this.counters(a);return {id:a.id,class:a.class,subtype:a.subtype,assignedLift:a.home,assignedRun:a.run,bornMinutes:a.born/60,plannedStayMinutes:a.plannedStay/60,exitMinutes:a.exitedAt==null?null:a.exitedAt/60,state:a.state,skiingMinutes:c.skiing/60,queueMinutes:c.queue/60,liftMinutes:c.uphill/60,transitMinutes:c.transit/60,laps:a.laps,switches:a.switches,preferredLifts:a.preferred?.join('|')??''};});}
  summary(){
    const perLift={};for(const [id,q] of Object.entries(this.queues)){const size=this.queueSize(id),dt=this.t-q.changedAt,area=q.area+size*dt,duration=Math.min(this.t||1,this.closeTime),mean=area/duration;perLift[id]={joined:q.joined,boarded:q.boarded,closingExits:q.closingExits,peakQueue:q.peak,queuePersonMinutes:area/60,meanQueue:mean,queueStandardDeviation:Math.sqrt(Math.max(0,(q.squaredArea+size*size*dt)/duration-mean*mean)),meanCompletedWaitMinutes:q.waitCount?q.waitTotal/q.waitCount/60:null,maxCompletedWaitMinutes:q.waitCount?q.maxWait/60:null,closingUnboardedWaitMinutes:q.abandonedWait/60};}
    const rows=this.agentRows();return {options:{...this.options},finished:this.done,elapsedMinutes:this.t/60,spawned:this.agents.length,active:this.active.size,switches:this.switches,meanArrivalBeliefErrorMinutes:this.beliefN?this.beliefAbs/this.beliefN:null,perLift,totalQueuePersonMinutes:Object.values(perLift).reduce((s,q)=>s+q.queuePersonMinutes,0),meanSkiingMinutes:rows.length?rows.reduce((s,a)=>s+a.skiingMinutes,0)/rows.length:0};
  }
  assertInvariants(){
    const seen=new Set();
    for(const [id,q] of Object.entries(this.queues)){
      if(this.queueSize(id)!==q.joined-q.boarded-q.closingExits)throw new Error('Queue conservation');
      for(const aid of q.ids.slice(q.head)){if(seen.has(aid)||this.agents[aid].state!=='QUEUE'||this.agents[aid].queueLift!==id)throw new Error('Queue membership');seen.add(aid);}
      if(q.boarded>Math.floor(Math.min(this.t,this.closeTime-1e-7)*this.mountain.lifts[id].capacity_skiers_per_hour/3600+1e-7))throw new Error('Capacity');
    }
    for(const a of this.agents){
      if((a.state!=='EXITED')!==this.active.has(a.id))throw new Error('Population conservation');
      if(a.state==='QUEUE'&&!seen.has(a.id))throw new Error('Missing queued agent');
      const elapsed=(a.exitedAt??this.t)-a.born;
      if(Math.abs(Object.values(this.counters(a)).reduce((s,x)=>s+x,0)-elapsed)>1e-5)throw new Error('Time conservation');
      if(a.class==='vacationer'&&(a.visits.L1||a.visits.L2||(['SKI_RUN','SKI_TRAVERSE'].includes(a.state)&&!this.mountain.allowed(a.edge,a))))throw new Error('Vacationer terrain');
      if(a.subtype==='race'&&Object.keys(a.visits).some(id=>id!=='L1'))throw new Error('Race home');
      if(a.subtype==='other'&&Object.keys(a.visits).some(id=>id!==a.home))throw new Error('Other home');
    }
    return true;
  }
}

export function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]),escape=v=>`"${String(v??'').replaceAll('"','""')}"`;return [keys.map(escape).join(','),...rows.map(r=>keys.map(k=>escape(r[k])).join(','))].join('\n');}
