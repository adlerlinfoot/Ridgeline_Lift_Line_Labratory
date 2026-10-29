# Engine and mathematical contract

User-confirmed rules in the root behavior spec supersede the original draft PDF. This is a simulation implementation; no formal stability result is claimed.

## State and clocks

Each skier occupies exactly one primary state. BASE_DECISION takes zero time. Movement traverses contiguous graph polylines at configured mode speed. Arc lengths use 2 m/pixel. Lift rides follow supplied base/top endpoints over configured ride durations. Missing terrain heights are not invented.

The public driver advances physical time in one-second steps independently of animation. Within each interval a deterministic event heap processes exact activity completions, exponentially distributed arrival times and capacity-paced boarding slots. Equal-time priority: closing, movement/preferences, spawn, boarding, sample; insertion sequence breaks remaining ties. Zero-time base decisions happen during their parent event. Every elapsed second belongs to queue, uphill, skiing or transit, including completion after close. SKI_TRAVERSE is transit.

FIFO service slots are spaced 3600/capacity_skiers_per_hour seconds apart, first slot one interval after opening. Empty slots expire. Each boards at most one skier instantly for unconfigured lifts. Configured multi-seat lifts instead have chair intervals of 3600 * seats_per_chair / capacity_skiers_per_hour and board up to seats_per_chair FIFO skiers at that instant. Closing has priority at the exact closing timestamp. Instantaneous boardings are discrete counts; throughput inequalities refer to rates/interval capacity, not a bounded derivative at an instantaneous jump.

## Decisions and randomness

Lift score = expected legal SKI_RUN minutes / (shortest feasible valley transfer + last personally seen queue count/(capacity/hour / 60) + uphill ride). Expected skiing is the arithmetic mean over the uniformly sampled legal itineraries, with identical lapper filters in selection and descent. SKI_TRAVERSE and walking are transit, excluded from skiing time. Strict maximum ratios win; tied ratios use the seeded PRNG and dimensionless tie_epsilon_ratio. No extra route draw is consumed to estimate skiing time. No remote actual queues are read for policy decisions. A destination is committed through transfer, queue, lift and descent. Passing an intermediate open base refreshes its observation but does not permit rerouting. Expired stays may end a base transfer at the next base.

Opening demand is a simultaneous batch with zero observations. Initial placement is uniform among admissible bases. All initial decisions precede admissions; FIFO opening order is seeded-shuffled. Later births observe then-current active queues. Poisson interarrivals, finite stays and immutable demand traits are generated before behavioral events. Reusing a seed within a population mode preserves exogenous demand across scenarios; route/tie draws can diverge.

Complete legal downhill itineraries are enumerated without repeated nodes and receive equal probability. Explicit junctions alone connect paths. B01 is split internally, preserving its parent ID and inventory count. Specialty lappers filter itineraries before sampling. Mixed preferences use completed wait averages at exact 40% time; unexperienced lifts are never added. If none exists, defer formation to a later base decision. Equal averages use seeded random tie-breaking.

## Queue accounting and analysis boundary

For each lift, exactly: `Q_j(t) = A_j(t) - D_j(t) - C_j(t)`.

A counts joins, D boardings, C closing queue removals. No voluntary queue abandonment occurs. Q is a discrete count process; an arrival counts on joining, not on destination selection.

Interval arrival-rate estimate = delta A / delta time; realized throughput = delta D / delta time. The fluid approximation `dQ/dt = lambda - S` applies before closing under continuous-state/rate assumptions. It is not the literal event process. `lambda*=S*` is necessary balance, not a stability proof or a closed queue-only system: memories, circulating agents, preferences, stays and travel delays affect future arrivals. No closed lambda(Q) is fabricated.

Both population modes and exported trajectories support later analytical work. L4 between-run configuration is the only intervention. A mathematical aggregate closure, its state variables, and a stability derivation remain separate research deliverables.

## Measurements

Queues are sampled once per minute. Queue area is integrated exactly between queue changes, not approximated from plotted samples. Post-closing queues are zero. Completed wait means exclude skiers removed unboarded at closing; those waits still enter queue area and skier counters. Mean queue divides area by operating seconds elapsed, excluding post-close drain. Ongoing counters appear in partial exports.

Q/mu is a perceived workload approximation; it can differ from realized waits under discrete service and closing. Belief error is absolute stale-vs-current wait error at visited bases during committed transfers before refresh, not an all-agent decision-time measure.

Batch confidence intervals are across independent seed replications. Shared seeds aid comparability but do not establish real-world causality. Student-t intervals describe Monte Carlo uncertainty, not stability.

## Latest confirmed flow rule (supersedes personal-stay departure rules above)

Arrival mode: independent Poisson arrivals before halfway (210 minutes of a 420-minute day); no arrivals afterward. Afternoon Poisson events at the same rate select uniformly from active, not-yet-selected skiers. Selected skiers finish committed queue/ride/descent, or exit at the next base if transferring. Do not select the same skier twice; skip selections when none eligible. No random personal-stay departures. Fixed mode unchanged. Class probabilities for incoming skiers remain 25/35/15/25. Mixed preference timing uses 40% of available time from arrival to close. Actual exits lag selections until a safe base.

## Synchronized schematic 3D renderer

The new 3D skeleton is presentation only. Physical lengths, times and decisions remain planar and unchanged. Routes retain exact x/y centerlines. z is linear in planar arc length between supplied endpoint elevations, with additional exact anchors at declared junctions. Agent heights use the same fraction on the active engine edge, matching those route anchors. Visual crossings never add connectivity. No heightfield is inferred.

Latest presentation update: default schematic cone wrap and opaque conical body, plus on-screen gyroscope drag/compass snap/reset. Cone can be unchecked to restore the earlier exact-planar-coordinate skeleton view. Supplied elevations and shared simulation state are unchanged; wrapping is display-only and routes are subdivided for curved rendering. No physical terrain is inferred.

Opaque-cone visibility: only front-facing route portions, skiers, queue markers, node labels and their hover/click targets are rendered. Visibility follows the perspective camera and vertical exaggeration as the mountain rotates. Display names: West peak, East Peak, Aspen peak, Meadow top; graph IDs remain unchanged.

Latest user-confirmed spawn rule supersedes random base placement: all opening and later-arrival skiers spawn at Main Lodge (LODGE), the explicit midpoint junction on T04 between M_BASE/L3 and A_BASE/L4. Split T04 internally in both directions without changing its full path length. Travel from lodge to admissible lifts consumes base-transit time; no direct initial queue placement. Initial queue memories remain simultaneously zero. Lodge is drawn in flat and 3D views with the existing occlusion rule. Departures still end at safe bases, without a required lodge return.

Latest user-confirmed spawn control: a pre-run 0–100% slider sets independent probability of spawning at Main Lodge (default 100%). The remainder spawn uniformly at a class/subtype-admissible active lift base, as in the original base-placement policy. Applies to opening and later arrivals. Use seeded independent lodge/base draws; finite samples need not match the slider exactly. Zero and 100 percent are exact. Lock setting after start, reset to change. Export the chosen lodgePercent and each skier spawnNode.

Latest non-lodge spawn rule supersedes discrete base sampling: sample uniformly by physical arc length on the union of valley paths between admissible lift bases. Shared arcs are counted once, reverse directions not twice. A private continuous spawn location has partial timed paths to both endpoints, and lift choice uses the actual network time from that point. No teleporting to a base. For a single admissible lift, the domain degenerates to its base. Applies to opening and later arrivals, with unchanged lodge probability and class shares. Export spawn coordinates/path/fraction.

Latest user-requested map import architecture: vision extraction/editor are in a separate Ridgeline_Map_Importer plugin repository. Host support lives in src/import-plugin.mjs plus generic generated-map branches in engine/rendering/overlays. Preserve bundled original geometry/behavior. Imported payloads are independently bounded/validated and preflighted, use one all-open imported scenario and arbitrary IDs, and can be restored to default. No image or agent credentials enter the host.
