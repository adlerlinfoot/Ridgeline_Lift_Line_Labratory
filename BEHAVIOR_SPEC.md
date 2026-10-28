# BEHAVIOR_SPEC — Authoritative agent decisions and skier classes

## A. Common model

Each individual has a unique `id`, main `class`, current state/position, a personal remembered queue vector over the four lifts, observed timestamps, planned departure after a finite stay, destination/committed route and accumulated counters for time skiing, transit, queued, and on lifts.

**General objective:** maximize actual time spent downhill skiing during an individual finite day. The operative heuristic is intentionally simpler and is not claimed to be a globally optimal solution:

```
next_lift = argmin over physically reachable, open, class-admissible lifts j:
      network_travel_minutes(current_base, base_of(j))
      + remembered_wait_minutes(agent,j)
      + lift_ride_minutes(j)
```

If already at lift `j`, base-to-base travel is zero. `remembered_wait_minutes` is initialized by observing `Q_j/mu_j` for all *operating* lifts on spawn, and is refreshed for the lift at the agent's *actual present base* when encountered. If storing queue sizes instead, use `remembered_Q_j / mu_j` on the fly. Do not expose or refresh actual remote queue values by polling the global state during decision. `mu_j` means maximum capacity, whereas `S_j(t)` means realized boarding rate.

For mathematical exposition, `j*(t)=argmin_{j∈A_i(t)}(T_travel,c→j + k_j + T_ride,j)` where `i` identifies skier and `c` current lift/base. Crucially `k_j` in the *individual* choice is a **last-observed estimate**, not the live hidden remote state.

If costs tie numerically within a small epsilon, choose with the simulation's seeded PRNG. Never use random choice to override a strict cost winner. A physical route must exist; otherwise exclude the lift. A destination is committed and not reevaluated halfway across the valley, waiting queue, chair or descent. Choose again only after finishing the chosen downhill itinerary at a base.

## B. Main classes (conditional populations)

Main-class shares in `MODEL_CONFIG.json`: all-mountain `0.25`, vacationer `0.35`, lapper `0.15`, mixed `0.25`. Draw once at spawn using the seeded random generator. The class categories represent **assumed prototypical behavior**, not directly observed GPS classifications.

### All-mountain (25% assumed)
- Expert-capable for this synthetic model: may use any open lift and any safe active run, park or expert traverse.
- Re-evaluates lift destinations with common remembered-wait+network-travel rule after a completed descent.
- Chooses subsequent compatible downhill itinerary from active graph; seeded random selection among suitable complete downhill paths is an allowed implementation default. Do not let randomness substitute for the *lift decision*.

### Vacationer (35% assumed)
- May **only** ski `green` and `blue` terrain (8 total mapped: G01/G02/U01/U02 and G03/G04/U03/U04).
- May never board L1/L2, use black connectors, race or parks.
- `baseline_3_lifts`: eligible `L3` only. `four_lift_capacity_control`: eligible `L3` only even though L4 runs are open to others. `four_lift_intervention`: eligible `L3` and `L4`.
- Uses valley base transfers T03/T04/T05 to migrate between L3 and L4; transfers consume simulated time. A resort-wide spawn observation does not grant physical access.
- If only one lift admissible, go there regardless of other queue lengths.

### Lapper (15% assumed) — NEW specialization

**Immediately after main-class assignment**, assign exactly one lifetime `lapper_subtype` by a categorical weighted draw:

| Subtype | Raw weight | Conditional proportion | Proportion of all skiers at 15% lappers |
| --- | ---: | ---: | ---: |
| `park` | 10 | 10/17 = 58.8235% | 8.8235% |
| `race` | 2 | 2/17 = 11.7647% | 1.7647% |
| `other` | 5 | 5/17 = 29.4118% | 4.4118% |

These weights are **not** percentages of the entire resort and do not imply exact fixed counts in finite stochastic samples. Use a weighted independent draw per new lapper, seeded. If an experiment needs exact composition, offer a *separate opt-in stratified initialization*, not a silent deviation from random assignment.

**Park lapper (10 parts):** specialist in terrain parks, not attached permanently to a single lift. Both L1 Westline (P01) and L2 Eastline (P02) are admissible and normally open in all three scenarios. At each valid base decision, compare the **same common objective** (actual valley travel time to each park-serving chair + personal last-observed queue wait + lift ride time). Choose either, including switching between parks if it has lower perceived cost. Once at the chosen summit, ski that chair's **designated park**, not a random black or lower green. P01 is only a half-length park; after P01's `PARK_MERGE`, continue along B01's downstream arc to `W_BASE` without another lift-selection decision at the junction. P02 reaches E_BASE directly. The time on the B01 continuation still counts as downhill skiing, while park-only minutes may be recorded separately. **Do not implement a permanently fixed lapper lift for park subtype.**

**Race lapper (2 parts):** always use L1. Repeat L1 -> T01 -> B10 -> T06 -> W_BASE. Never assign L2. The two ridge approaches remain in the topology for other expert-capable skiers.

**Specific-interest / other lapper (5 parts):** randomly choose **one fixed complete run** from the currently operational special-interest candidate set at spawn and assign its requisite lift, then repeat it whenever possible. Recommended defaults in `MODEL_CONFIG.json` are conventional full descents (B01, B02, B05, B06, G01, G02, U01, U02, plus the L4 full descents when L4 is open). The fixed run is *not* an abbreviated connector ending atop another zone and is never an additional park or race. No migration to other lifts based on queues. If assigned B01, follow B01 from W_TOP; park merge is traversed as a through-junction. Candidate list and weighting are explicitly synthetic assumptions, not observations.

### Mixed (25% assumed)
- Expert-capable as in all-mountain.
- During the initial exploration portion of their personal mountain day, all active physically reachable lifts are admissible and decision uses the common rule.
- Following 40% of their **planned personal skiing stay** (configurable synthetic default), selects a preferred subset of up to two lifts from those actually experienced; rank by personally experienced mean realized wait before this transition; retain a sole experienced lift without supplementing. If none has completed a wait, defer freezing until the first valid base decision with experience.
- Thereafter choose among that stable subset with the same common decision rule (congestion may still cause switching *within that subset*). This models becoming attached to a few runs without a new utility function.

## C. Practical reachability and run path selection

- Lift choice and run choice are distinct: choose lift at the base; after riding, choose a **complete, legal downhill route** ending at an open lift base or a base connected to one through legal transfers.
- Upper connector continuation: `B03/B08 -> B09 -> one of G01/G02/U01/U02`. In 4-lift modes, `B04/B07 -> one of G03/G04/U03/U04`. `P01 -> B01 downstream of PARK_MERGE`. `T01/T02 -> B10 -> T06 -> W_BASE`.
- When a run ends at `M_TOP` or `A_TOP`, **continue downhill on a lower run**, not directly into a lift queue at altitude. A skier cannot board a chair at its top.
- Geometric intersections do not create network links. Split B01 at PARK_MERGE internally but preserve one named-run record.
- If agent class does not allow a proposed edge (e.g. black for vacationer), exclude that path; never route around an obstruction by direct coordinate jumps.

## D. Observation, commitment and stochasticity

On spawn: create `last_seen_queue_count[j]` and `last_observed_at[j]` for all *active lifts*. This initial panoramic observation is an **explicit modeling assumption**. When a skier arrives physically at lift/base `j`, update only `j`, then evaluate alternatives; if leaving without queueing, their new destination's queue remains unknown until arrival. When they physically arrive at chosen lift base, refresh that lift's queue and enter its FIFO queue **without a second reroute during the same decision cycle**. This prevents infinite bounce loops from changed arrivals and implements commitment. Their next voluntary lift-choice decision is after a completed descent. The one-time arrival observation at destination is still stored for future visits.

Each agent carries `seen_at` timestamps strictly for diagnostics; **do not decay memory to a mean or replace it with true queue information**. Potentially stale beliefs are the mechanism of interest.

Stochastic events include class/subtype assignment, Poisson spawning, finite personal stay, tie breaks and compatible run-choice sampling. Use one explicitly seeded RNG for every randomized action. There is no arbitrarily introduced random "mistake" in choosing a nonminimum-cost lift.

## E. Time-accounting categories

A skier always occupies exactly one primary state: `BASE_DECISION`, `BASE_TRANSIT`, `QUEUE`, `LIFT_RIDE`, `SKI_RUN`, `SKI_TRAVERSE`, or `EXITED`. Accounting time is classified into `skiing` (including black continuation), `queue`, `uphill`, and `transit` (base walk/skate and optionally non-piste traversal depending on reporting scheme). The *sum of these time counters* must match that individual's non-idle elapsed resort time, within simulation timestep tolerance. No naps, breaks or arbitrary idle state.

For implementation, `BASE_DECISION` is **zero-duration**; it is not an unused-time category. If a skier is forced to finish an in-progress activity near closing, count those minutes and document the closing policy in the results.

## F. Confirmed implementation decisions (supersede older wording)

- Fixed mode: opening rush only, no personal departures until closing. Arrival mode: same opening rush plus Poisson arrivals and finite stays.
- Opening agents are placed uniformly among admissible lift bases and observe all queues as zero simultaneously before any joins. All equal cost minima use seeded random selection.
- Lift choice includes lift ride duration, including park lappers. Run choice is discrete uniform over complete feasible itineraries, not uniform at each junction.
- No queue abandonment except closing. At closing no further boarding: queued agents exit, riders finish their ride and full descent, other moving agents finish to a safe base.
- The only intervention is the between-run L4 scenario, never an injected queue shock.
- Primary research outputs concern queue congestion and variability. Skiing time is a supporting agent diagnostic.

## Latest confirmed flow rule (supersedes personal-stay departure rules above)

Arrival mode: independent Poisson arrivals before halfway (210 minutes of a 420-minute day); no arrivals afterward. Afternoon Poisson events at the same rate select uniformly from active, not-yet-selected skiers. Selected skiers finish committed queue/ride/descent, or exit at the next base if transferring. Do not select the same skier twice; skip selections when none eligible. No random personal-stay departures. Fixed mode unchanged. Class probabilities for incoming skiers remain 25/35/15/25. Mixed preference timing uses 40% of available time from arrival to close. Actual exits lag selections until a safe base.

Latest user-confirmed spawn rule supersedes random base placement: all opening and later-arrival skiers spawn at Main Lodge (LODGE), the explicit midpoint junction on T04 between M_BASE/L3 and A_BASE/L4. Split T04 internally in both directions without changing its full path length. Travel from lodge to admissible lifts consumes base-transit time; no direct initial queue placement. Initial queue memories remain simultaneously zero. Lodge is drawn in flat and 3D views with the existing occlusion rule. Departures still end at safe bases, without a required lodge return.

Latest user-confirmed spawn control: a pre-run 0–100% slider sets independent probability of spawning at Main Lodge (default 100%). The remainder spawn uniformly at a class/subtype-admissible active lift base, as in the original base-placement policy. Applies to opening and later arrivals. Use seeded independent lodge/base draws; finite samples need not match the slider exactly. Zero and 100 percent are exact. Lock setting after start, reset to change. Export the chosen lodgePercent and each skier spawnNode.

Latest non-lodge spawn rule supersedes discrete base sampling: sample uniformly by physical arc length on the union of valley paths between admissible lift bases. Shared arcs are counted once, reverse directions not twice. A private continuous spawn location has partial timed paths to both endpoints, and lift choice uses the actual network time from that point. No teleporting to a base. For a single admissible lift, the domain degenerates to its base. Applies to opening and later arrivals, with unchanged lodge probability and class shares. Export spawn coordinates/path/fraction.
