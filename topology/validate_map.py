"""Validate supplied planar topology. Missing heightfield is explicitly not certified."""
import json, math
from pathlib import Path
p = Path(__file__).resolve().parents[1]
d = json.loads((p/'resort-map.json').read_text(encoding='utf-8'))
nodes = {n['id']: n for n in d['nodes']}
assert len(nodes)==12 and len(d['runs'])==20 and len(d['lifts'])==4
assert len({r['id'] for r in d['runs']})==20
for e in d['runs']+d['transfers']:
    a,b=e.get('start_node',e.get('from')),e.get('end_node',e.get('to'))
    for n,pt in [(a,e['polyline'][0]),(b,e['polyline'][-1])]:
        assert pt==[nodes[n]['x'],nodes[n]['y']], (e['id'],'endpoint')
    length=sum(math.dist(a,b)*2 for a,b in zip(e['polyline'],e['polyline'][1:]))
    assert abs(length-e['centerline_length_m'])<0.11, (e['id'],'length')
    for j in e.get('junction_nodes',[]):
        n=nodes[j['node_id']]
        assert e['polyline'][j['polyline_index']]==[n['x'],n['y']]
for name,s in d['scenarios'].items():
    active=set(s['active_run_ids']); graph={n:[] for n in nodes}
    assert len(active)==(14 if name=='baseline_3_lifts' else 20)
    for e in d['runs']:
        if e['id'] not in active: continue
        assert set(e.get('requires_active_lifts',[]))<=set(s['active_lifts'])
        chain=[e['start_node']]+[j['node_id'] for j in sorted(e.get('junction_nodes',[]),key=lambda j:j['polyline_index'])]+[e['end_node']]
        for a,b in zip(chain,chain[1:]):graph[a].append(b)
    for e in d['transfers']:
        graph[e['from']].append(e['to'])
        if e['bidirectional']:graph[e['to']].append(e['from'])
    bases={l['base'] for l in d['lifts'] if l['id'] in s['active_lifts']}
    for r in d['runs']:
        if r['id'] not in active:continue
        todo=[r['end_node']];seen=set()
        while todo:
            n=todo.pop()
            if n in seen:continue
            seen.add(n);todo+=graph[n]
        assert seen & bases,(name,r['id'],'stranded')
print('PASS: counts, lengths, endpoints, park merge, scenario dependencies and downstream base reachability.')
print('Heightfield unavailable: continuous elevation descent is not certified.')
