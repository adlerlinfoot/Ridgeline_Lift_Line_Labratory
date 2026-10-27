# MAP_SPEC.md — Ridgeline v2 map, route graph and surface contract

## 0. Scope

This is the **map/topology context**, not the behavior engine. Preserve the exact mountain geometry and the 20 named runs in `resort-map.json`. Implement dot-turtle travel along actual route geometry; do not replace the network with random edges or allow teleports. This geometry is fictitious and based on the supplied sketch.

## 1. Coordinates and height surface

- Domain: **1400 × 960**, origin upper left, x positive east/right, y positive south/down. Horizontal distance = **2 synthetic meters per image pixel**.
- Terrain altitude in meters comes from `terrain-grid.json` (49 rows × 71 columns, row major); bilinearly interpolate to arbitrary world positions. `terrain-heightmap-16bit.png` is its full-resolution raster counterpart; `terrain-relief.png` and SVG are visualization only.
- In Three.js an appropriate mapping is `(x,y,z)` → `((x-700)*2, z-z_reference, (y-480)*2)`. A dot-turtle must follow its path polyline, sampling terrain height at every animation frame, with a slight vertical offset.
- Every declared downhill piste is monotonically decreasing in height, checked by dense path sampling. The two expert race-gate traverses also descend continuously. The dark upper runs may traverse substantially east/west while also losing altitude.

## 2. Canonical graph types

- **Lift:** exactly L1, L2, L3, L4, base → top, with finite ride time and a stated *maximum* boarding capacity. These are not ski runs.
- **Run:** exactly **20**, one-way, following ordered centerline points. Category (`green`, `blue`, `black`, `park`), `start_node`, `end_node`, `accessible_from_lifts`, and optional `requires_active_lifts` are mandatory operational semantics.
- **Expert ridge access:** T01 and T02, one-way downhill traverses ending at `RACE_GATE`. They are not counted among the 20 runs. They can be traversed by expert-capable classes, including dedicated race lappers.
- **Valley transit:** T03–T06 are bidirectional base-area connections with nonzero travel time. T03–T05 join all four lift bases; T06 joins the race finish to W_BASE. They are not pistes. In particular, a vacationer may use the valley connection to reach L4 in the four-lift condition without ever skiing a black.

**Important:** Geometric intersections are not implied graph connections. **Only** endpoint node IDs, explicit `junction_nodes`, and declared transfers create intersections usable by agents. Never auto-connect polylines just because they cross visually.

## 3. Newly revised upper black network

There are **five connector black run segments**, deliberately not full-length summit-to-base descents:

| ID | Directed connection | Next movement |
|---|---|---|
| B03 | W_TOP → M_JOIN | Join B09 toward M_TOP |
| B04 | W_TOP → A_TOP | Continue down any open Aspen green/blue run; **requires L4 open** |
| B07 | E_TOP → A_TOP | Continue down any open Aspen green/blue run; **requires L4 open** |
| B08 | E_TOP → M_JOIN | Join B09 toward M_TOP |
| B09 | M_JOIN → M_TOP | Continue down an open Meadow green/blue run |

**Convergence:** B03 and B08 have the **same named end node `M_JOIN`**. B09 begins at precisely that node. Thus a skier starting at either summit may legally enter the Meadow-top terrain by following B03/B09 or B08/B09. The two approach runs are visually distinct before that junction. This explicitly replaces a previous overlapping west black/meadow green arrangement.

**Nonconnector black runs:** B01 and B02 descend from W_TOP to W_BASE; B05 and B06 descend from E_TOP to E_BASE. B10 is the single **race black** on the far **western flank**, accessed from both expert summits via T01 and T02. The race finish returns to W_BASE via T06. Total blacks including race = **10**.

### West park merge, an explicit junction inside B01

- P01 (Westline Park) **ends early**, at node `PARK_MERGE=(260,500)`. The park is not a full summit-to-base path.
- B01 North Face has a `junction_nodes` field: `[{"node_id":"PARK_MERGE","polyline_index":3}]`. This index is zero-based, and the indicated waypoint has those exact coordinates.
- At that waypoint, split B01 *internally* into W_TOP → PARK_MERGE and PARK_MERGE → W_BASE graph arcs, while keeping **B01 as exactly one named run** in the run inventory. P01 leads onto B01's latter arc.
- A turtle entering from P01 must proceed forward along B01's remaining centerline to W_BASE, not restart B01 at W_TOP and not teleport to the base. Add a route transition at the park merge.
- P02, the east park, remains an independent eastern run.

### Shared race access and count

- B10 `West Needle · Race Line` is one black run, **not** a run counted twice for each summit.
- T01 is W_TOP → RACE_GATE; T02 is E_TOP → RACE_GATE; they are explicit expert-only access links. Skier reaching RACE_FINISH follows T06 to W_BASE before queueing again.
- The race is well away from the middle of the mountain, so it does not block the novice/intermediate basins or the black crossing network.

## 4. Eight beginner/intermediate runs

- L3 Meadow: **G01/G02** green and **U01/U02** blue, descending M_TOP → M_BASE.
- L4 Aspen: **G03/G04** green and **U03/U04** blue, descending A_TOP → A_BASE.
- Vacationers are eligible **only** for these green/blue runs, never for black connector routes, race, or either terrain park. All-mountain and mixed can use cross-mountain expert links; lappers are locked to their assigned run and its requisite route. `U` run IDs are **blue**, not black.

## 5. Operating scenarios (critical topology dependencies)

1. `baseline_3_lifts`: **L1/L2/L3 open; L4 closed**. Aspen's four associated green/blue runs are inactive. In addition, **B04 and B07 must be inactive**, because each ends at A_TOP and would strand an agent above inactive downhill pistes. Thus **14 navigable runs** out of 20 mapped ones; the two expert connectors appear muted in the baseline picture.
2. `four_lift_intervention`: all lifts and all 20 runs active. Vacationers may choose L3 or L4.
3. `four_lift_capacity_control`: all lifts and all 20 runs active, but vacationers remain constrained to L3. Helps separate added capacity from changing permissions.

Use each run's optional `requires_active_lifts` to enforce additional dependencies, independently of `primary_lift`. `primary_lift` is an indexing/convenience attribution, not necessarily the *only* path to a run (for example B09 is reachable from L1 **and** L2).

No endpoint may strand an agent: if an active expert path ends at M_JOIN or PARK_MERGE, require its downstream route to be enabled; if a path ends at M_TOP or A_TOP, a permissible active green/blue descent must be available. L4 is toggled **between simulation replicates**, not while agents are in flight.

## 6. Turtle pathfinding implications

- Use an actual **directed multigraph**. Lifts go up, downhill runs go down. Split any intermediate junctions (`PARK_MERGE`) into traversable graph arcs; retain parent ID for drawing/statistics.
- Skier movement is continuous along polyline arc length and consumes time according to mode (run, transit, lift).
- One skier occupies only one edge or queue state at once. A green/blue continuation after reaching M_TOP/A_TOP is still downhill movement, **not** an immediate lift-queue decision.
- Only after a descent completes at a base can a skier re-evaluate accessible lift queues. Queue selection and skier memory belong in the separate behavior context.
- Non-adjacent lift bases are connected only by the valley promenade. For arbitrary lift-to-lift migration use shortest feasible **network** travel time, not straight-line distance.
- Interpret collisions correctly: two screen centerlines that merely touch/cross but lack a junction node remain unconnected.

## 7. Validation and regeneration

Run `python build_map.py` to regenerate the JSON/heightfield/SVG/HTML source and `python validate_map.py` to check run counts, height descent, park merge, expert join connectivity, inactive/active scenarios, and baseline no-stranding. Raster PNGs may be regenerated with `cairosvg` from the produced SVG. The supplied ZIP already includes regenerated PNGs and SVGs.
