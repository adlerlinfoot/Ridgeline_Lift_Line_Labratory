export function liftSettings(lift){
 const seats=lift.seats_per_chair??1,minutes=lift.revolution_minutes??lift.ride_minutes*2;
 return {seats,minutes,chairs:lift.chair_count??Math.max(1,Math.round(lift.capacity_skiers_per_hour*minutes/(60*seats)))};
}
export function configureLift(lift,{seats,minutes,chairs}){
 if(!Number.isInteger(seats)||seats<1||seats>12||!Number.isFinite(minutes)||minutes<1||minutes>120||!Number.isInteger(chairs)||chairs<1||chairs>1000)throw new Error('Invalid lift chair settings');
 return {...lift,seats_per_chair:seats,chair_count:chairs,revolution_minutes:minutes,ride_minutes:minutes/2,capacity_skiers_per_hour:chairs*seats*60/minutes};
}
export function mountLiftSettings({container,getMap,onChange,isLocked}){
 container.replaceChildren();
 for(const lift of getMap().lifts){
  const section=document.createElement('fieldset'),title=document.createElement('legend');title.textContent=lift.name;section.append(title);
  const values=liftSettings(lift),inputs={};
  for(const [key,label,min,max,step] of [['seats','Seats per chair',1,12,1],['minutes','Full revolution (minutes)',1,120,.5],['chairs','Chairs on cable',1,1000,1]]){
   const row=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input'),out=document.createElement('output');text.textContent=label;input.type='range';input.min=min;input.max=max;input.step=step;input.value=values[key];input.className='setting';input.disabled=isLocked();out.textContent=input.value;row.append(text,input,out);section.append(row);inputs[key]=input;
   input.oninput=()=>{out.textContent=input.value;};input.onchange=()=>{if(isLocked())return;try{const next=configureLift(lift,Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,Number(v.value)])));Object.assign(lift,next);onChange();summary.textContent=describe();}catch(e){summary.textContent=e.message;}};
  }
  const summary=document.createElement('p'),describe=()=>`${lift.capacity_skiers_per_hour.toFixed(1)} skiers/hour · ${lift.ride_minutes.toFixed(2)} minutes uphill`;summary.textContent=describe();section.append(summary);container.append(section);
 }
}
