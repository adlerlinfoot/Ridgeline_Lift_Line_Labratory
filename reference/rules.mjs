export function minimumChoice(costs, random, epsilon = 1e-9) {
  if (!costs.length) throw new Error('No feasible lift');
  const best = Math.min(...costs.map(x => x.cost));
  const tied = costs.filter(x => Math.abs(x.cost - best) <= epsilon);
  return tied[Math.floor(random() * tied.length)].id;
}
export function preferredLifts(waits, count = 2, random = () => 0.999999) {
  const entries=Object.entries(waits).filter(([,w]) => w.count > 0)
    .sort((a,b) => a[1].total/a[1].count - b[1].total/b[1].count);
  for(let start=0;start<entries.length;){
    let end=start+1;const mean=entries[start][1].total/entries[start][1].count;
    while(end<entries.length&&Math.abs(entries[end][1].total/entries[end][1].count-mean)<1e-9)end++;
    for(let i=end-1;i>start;i--){const j=start+Math.floor(random()*(i-start+1));[entries[i],entries[j]]=[entries[j],entries[i]];}
    start=end;
  }
  return entries.slice(0,count).map(([id])=>id);
}
