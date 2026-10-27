import json
from pathlib import Path
p=Path(__file__).resolve().parents[1]
c=json.loads((p/'MODEL_CONFIG.json').read_text(encoding='utf-8'))
d=json.loads((p/'resort-map.json').read_text(encoding='utf-8'))
assert (p/c['map_file']).is_file()
assert sum(c['population']['main_class_weights'].values())==100
assert c['population']['lapper_subtype_weights']=={'park':10,'race':2,'other':5}
assert c['population']['lapper_race_home_lift_weights']=={'L1':1}
assert 'lift_ride_minutes' in c['decision']['cost_function']
assert set(c['scenarios'])==set(d['scenarios'])
assert d['scenarios']['four_lift_capacity_control']['vacationer_lifts']==['L3']
print('PASS: current user decisions and context/config references.')
