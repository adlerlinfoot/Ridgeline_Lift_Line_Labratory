# Ridgeline Lift-Line Laboratory

A buildless browser ABM for **The Influence of Heterogeneous Skier Decisions on Lift-Line Congestion and Queue Stability**. Uses the supplied synthetic directed mountain: four lifts, twenty named runs, the park merge and both race approaches. No API key, account or dependency installation is required.

## Run locally

One command from any terminal on this laptop starts the server and opens the site:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Adler\repo-reviews\Lift_Line_ABM\Start-Ridgeline.ps1"
```

From the repository folder, you can also use `npm start`. Reuses an already running server.

Requires Node.js 20+ (22+ recommended).

```powershell
node scripts/serve.mjs
```

Open **http://127.0.0.1:43880/**. On Windows, `Start-Ridgeline.ps1` starts a hidden local server and opens the page. If Node is not on PATH, use `& 'C:\Program Files\nodejs\node.exe' scripts/serve.mjs`.

Choose settings before starting; Reset unlocks them. Speed affects playback only. Click a moving skier for its state, destination, remembered waits and observation times. Queue circles show counts rather than physically stacked dots. Choose Both views, Flat map or 3D skeleton. The interactive skeleton mirrors the same live agents and queues. The static files also work on GitHub Pages; this implementation does not deploy or push automatically.

## Confirmed behavior

- Both modes start with a 650-skier opening rush, all spawned at Main Lodge between L3 and L4. All observe zero queues simultaneously, choose admissible destinations using seeded tie-breaking, then walk the valley paths before joining queues.
- **Fixed population:** no new arrivals or personal departures; everyone circulates until closing. **Arrival mode:** opening rush plus Poisson arrivals until minute 210 (default 3/minute), then equal-rate Poisson selections for departures from the existing active pool. No further afternoon arrivals or random stay-based departures. Incoming class probabilities are 25%/35%/15%/25%, not exact finite-sample quotas.
- Destination minimizes feasible valley transfer minutes + personally remembered queue count/capacity + lift ride minutes. Ties are uniformly random among equal minima. Current-base memory refreshes before choice; remote memory refreshes only on physical visits. Committed arrivals cannot reroute.
- Main classes: all-mountain 25%, vacationer 35%, lapper 15%, mixed 25%. Lapper subtype weights **10:2:5 conditional on being a lapper**. Park specialists can choose L1/L2; race specialists always use L1/T01/B10/T06; other specialists repeat one assigned full run.
- Mixed skiers freeze up to two experienced lifts with the lowest mean completed personal waits at 40% of the time from arrival to closing. One experienced lift remains one. If none has completed a wait, freeze at the first subsequent base decision with experience. Fixed-mode threshold uses 40% of the operating day. Equal average waits use seeded random tie-breaking.
- General downhill choices are discrete uniform over complete legal itineraries, not sequential junction draws. P01 continues along lower B01; upper connectors continue down lower terrain. T06 completes race itineraries to W_BASE.
- Instant individual boarding occurs on evenly spaced capacity slots (every 6 seconds on all four lifts; capacity 600/h each). Empty slots expire. First slots occur after one interval. No queue abandonment before closing.
- A departure selection does not interrupt a committed queue, ride or descent. A selected skier in base transit exits at the next base. Skier selection is uniform without selecting an already-marked skier again. Actual departures lag selection until the safe exit. At closing (420 minutes), boarding and arrivals stop; queues exit. Riders and descending skiers finish full safe itineraries; base transfers end at the next base.

## Infrastructure scenarios

1. Three-lift baseline: L4 and six dependent runs closed; vacationers only L3.
2. Four-lift comparison with vacationers constrained to L3.
3. Four-lift expanded access: vacationers can choose L3/L4.

These are **combined infrastructure/terrain/access comparisons**, not pure capacity effects. L4 is configured between replications only. No injected queue disturbance exists.

## Outputs and interpretation

Run JSON includes settings, time series and skier records. Queue CSV contains queue joins, boardings, closing removals, interval arrival/boarding rates, estimated waits, completed mean waits and integrated queue-person-minutes. Skier CSV includes all four time categories, class, assignment, laps and switches. SKI_TRAVERSE counts as transit; named downhill runs count as skiing. At closing, unfinished waits are included in total queue time but excluded from completed-wait means and separately identified in lift summaries.

The primary outputs concern **congestion and queue dynamics**. Skiing time is a supporting diagnostic. Batch comparison reports replicate-level queue-person-minutes with Student-t 95% confidence intervals (conservative tabulated critical values for larger sample counts). These intervals are not mathematical stability tests. Time samples or agents within a run are not independent replications.

The finite operating day and queue balance identity alone do **not** establish equilibrium stability. A formal aggregate arrival closure/stability derivation remains separate research work; see [engine and math](spec/ENGINE_AND_MATH.md).

## Validate

```powershell
python topology/validate_map.py
python tests/validate_context.py
node --test tests/*.test.mjs
```

For command-line batches (20–200 repetitions per setting):

```powershell
node scripts/batch.mjs fixed 20
node scripts/batch.mjs arrival 20
```

Results go to ignored `.runtime/`. Arrival batches use rates 2, 3, 4 and 6/minute. Identical seeds pre-generate identical exogenous arrival times, classes, subtypes and departure-selection event times/draws across scenarios; scenario-specific admissibility and assignments legitimately differ. Endogenous behavioral draws diverge across scenarios, so this is not identical routing noise.

## Structure and limitations

- Root BEHAVIOR_SPEC.md, MODEL_CONFIG.json, MAP_SPEC.md, resort-map.json are canonical. Root paths replace the original context-pack's absent spec/topology copies.
- `src/engine.mjs`: DOM-free simulation; event processing inside a fixed one-second driver, exact activity durations and service slots.
- `reference/rules.mjs`: shared policy primitives; `src/experiments.mjs`: batch design/aggregation.
- `src/app.mjs`, `index.html`, `styles.css`: static interface; `src/mountain3d.mjs`: dependency-free perspective Canvas renderer. Batch utilities remain available via CLI; the repeated-experiments browser panel has been removed.
- The supplied **terrain grid, heightmap and original SVGs were absent**. The flat view preserves exact planar geometry. The 3D route skeleton uses supplied node elevations, interpolating interior heights by arc length between endpoints and explicit junctions. It does not reconstruct the absent terrain surface.
- The original PDF is retained as draft background, not an implementation/result report. Its completed-work language and bibliography errors have not been edited. All capacities, speeds, geometry, shares and behavioral thresholds are synthetic assumptions.

No external services are needed. See [acceptance criteria](spec/ACCEPTANCE_TESTS.md) and [implementation decisions](spec/OPEN_DECISIONS.md).

## Two-phase flow update

The halfway boundary is half the configured operating day (210 of 420 minutes). Morning counts and afternoon selection counts are independent Poisson processes at the same rate, not forced equal counts. Selection events are skipped if every remaining skier is already marked. Fixed mode has neither process. The exported legacy plannedStayMinutes field now means available time from spawn to closing for preference timing only; it does not trigger departure. Exports include selection counts, requested timestamps and actual exit timestamps.

## Interactive 3D skeleton

Both views share one Simulation instance, clock, seed, IDs, queue counts and selection. Drag the 3D view to orbit, wheel to zoom, Shift/right-drag to pan, pinch with two fingers to zoom/pan, or focus it and use arrow keys, +/- and Home. Height adjusts display exaggeration only; Labels toggles node labels. Reset camera restores the initial viewpoint. Click a moving skier in either view to inspect and highlight it in both. Hover routes/nodes for IDs and elevation/length information. On smaller screens the mirrored views stack vertically; choose a single view for more room.

3D x/y are the exact route waypoints. Heights are interpolated between declared node elevations, honoring intermediate junctions such as PARK_MERGE. This is a skeletonized schematic, not a recovered heightfield or a new physical model. Camera actions never advance or randomize simulation state.

## Cone wrap and gyroscope

The default 3D view wraps the route skeleton around a opaque conical wireframe. Supplied elevations are retained; planar coordinates are mapped to azimuth and radius for display only. Routes are subdivided before wrapping so moving skiers follow the same curved display paths. This is a schematic mounting of the topology, not measured terrain. Uncheck Cone for the previous exact-planar-coordinate 3D view.

The top-right gyroscope supports pointer dragging to orbit, N/E/S/W clicks to snap azimuth, arrow keys to rotate and double-click/Home to reset. The main viewport retains drag/pan/zoom controls. Camera actions and cone toggling never alter the simulation.

Opaque-cone visibility: only front-facing route portions, skiers, queue markers, node labels and their hover/click targets are rendered. Visibility follows the perspective camera and vertical exaggeration as the mountain rotates. Display names: West peak, East Peak, Aspen peak, Meadow top; graph IDs remain unchanged.

## Main Lodge spawn

Every opening and later-arrival skier starts at Main Lodge (LODGE), halfway along T04 between Meadow and Aspen bases. T04 is split internally at that explicit junction; its geometry and total length are preserved. All skiers, including dedicated lappers, walk from the lodge to their admissible lift. These minutes count as base transit. Lodge icons appear in both views; in cone mode the lodge respects mountain occlusion. Spawn node is included in skier exports. Departure behavior is unchanged; returning to the lodge is not required.

## Lodge spawn percentage

Set Spawn at Main Lodge from 0–100% before starting (default 100%). It sets each opening/later-arrival skier’s independent probability of spawning at the lodge. The remainder spawn uniformly by distance along paths connecting their admissible active lift bases. Finite samples fluctuate around intermediate percentages; 0% and 100% are exact. Class shares and lapper assignments are unchanged. Reset unlocks the slider. The run export records lodgePercent and each skier’s spawnNode.

## Continuous non-lodge spawn locations

For the non-lodge fraction, the spawn domain is the union of valley paths connecting that skier’s admissible lifts. Sampling is uniform in meters, including bends, and shared/reversed path sections are not double-counted. Skier positions begin at the sampled point, with partial walking edges in either direction; destination costs include that exact remaining distance. A sole admissible lift has no connecting path, so its base is the degenerate fallback. No summit, piste or race-finish return path is included. CSV/JSON records now include spawnPath, spawnEdge, spawnFraction, spawnX, spawnY and spawnElevation.

## Repeated-run overlays

Use Overlay congestion across runs to run 2–200 independent simulation days (default 20). The selected scenario, population mode, opening count, flow rate, lodge percentage and model config stay fixed; seeds increment from the current seed. This is descriptive repeated simulation, not forecasting, fitting or predictive inference. It does not automatically compare scenarios.

Every run contributes its own thin line. L1 remains red, L2 purple, L3 blue and L4 green via one shared palette used by all views. Switch queue count/estimated wait and toggle lifts to inspect overlaps. Hover reports observed min/max across completed runs at the selected minute, not a confidence interval. The background worker does not change the live simulation. Stop retains only fully completed runs and marks the output partial.

Plain-text (.txt) export contains settings, seeds, capacities, per-run lift summaries and tab-separated minute values. CSV contains the same minute-by-minute queue counts and estimated waits in wide form, with run and seed columns. Closed lifts are blank. Time series cover opening through closing, excluding post-close drain.
