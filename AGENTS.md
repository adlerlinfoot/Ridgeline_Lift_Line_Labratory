# Codex instructions: Ridgeline congestion ABM

You are implementing a **browser-based, stochastic skier agent-based model (ABM)** on a **pre-existing fixed directed mountain topology**. Build working software, not just mockups.

## Read in this order
1. `README.md`
2. `spec/BEHAVIOR_SPEC.md` (authoritative behavioral rules including new 10:2:5 lappers)
3. `spec/MODEL_CONFIG.json` (defaults and scenario definitions)
4. `topology/MAP_SPEC.md` + `topology/resort-map.json` (authoritative physical network)
5. `spec/ENGINE_AND_MATH.md`, `spec/EXPERIMENTS.md`, `spec/UI_SPEC.md`
6. `spec/OPEN_DECISIONS.md`, `spec/ACCEPTANCE_TESTS.md`
7. `reference/rules.mjs`, tests

## Strict interpretation
- **Do not simplify away skier memories**: queue information for remote lifts is stale and changes only after an actual lift-base visit; initializing memory at spawn from current queues is permitted and required.
- **Do not add arbitrary behavioral weights, utility modifiers, or social influence**. The default destination choice minimizes *network travel minutes + remembered queue minutes + lift ride minutes* among admissible lift bases. Current base observation must be refreshed before comparing.
- **Do not overgeneralize lappers**: 10:2:5 **conditional within the lapper class**. Park lappers may migrate L1/L2; race lappers are race-course specialists; other lappers stick to an individually assigned run. `topology/resort-map.json` class constraint has been updated accordingly.
- Preserve **four lifts**, **20 named runs**, **five connecting black segments**, **park merge**, **race gate and its two summit approaches**, and **three operating scenarios**. Physically crossing colored lines on a map is NOT graph connectivity.
- Vacationers **never use black or park terrain**, **never ride L1 or L2**, and can ride L4 only in `four_lift_intervention` (not `four_lift_capacity_control`).
- Distinguish physical maximum lift boarding capacity `mu_j` from realized throughput `S_j(t)`; the queue balance is `dQ_j/dt = lambda_j(t) - S_j(t)` with `0 <= S_j(t) <= mu_j`.
- Render visual agents along actual polylines/heightfield; no jumps between disconnected points.
- A skier takes a single next-route choice, commits until the next valid decision point (after finishing a descent), and can be in exactly one state at a time.
- The operating configuration is set before each simulation/replication and not toggled mid-route.
- Every numerical parameter in the configuration is **synthetic and tunable**, not a measured Vail skier behavior estimate.

## Source-of-truth precedence (highest to lowest)
1. This `AGENTS.md` and behavior/current package specs
2. `spec/MODEL_CONFIG.json`
3. `topology/resort-map.json` and `topology/MAP_SPEC.md`
4. `docs/working-methodology-reference.pdf` (draft academic background only)
5. Illustrative map SVG/PNG and original user sketch

If a spec default conflicts with graph feasibility, report/resolve the conflict without enabling impossible skiing connections or changing the user's model mechanisms.

## Deliverable target
A repo that runs locally and can be deployed to GitHub Pages: self-contained frontend with mountain surface/map, dot-turtle animation, live queue/wait plots, controls, batch simulation, downloadable CSV results and transparent model assumptions. Use a seeded PRNG for reproducible replications. Keep the physics/behavior engine separate from rendering; never use animation FPS for simulation time.

## Validation
First run `python topology/validate_map.py`, `python tests/validate_context.py`, and `node --test tests/reference-policy.test.mjs`. All must pass before implementing further engine behavior. New frontend must add reproducibility/invariant tests enumerated in `spec/ACCEPTANCE_TESTS.md`.

## Current checkout layout and user overrides
Root BEHAVIOR_SPEC.md, MODEL_CONFIG.json, MAP_SPEC.md and resort-map.json are canonical (older spec/topology paths refer to the original context-package layout). Read spec/ENGINE_AND_MATH.md and spec/ACCEPTANCE_TESTS.md for the implemented contract. Race lappers use L1 only; mixed preferences never supplement experienced lifts; both population modes start with a simultaneous zero-memory opening rush. User confirmation authorizes implementation and a local Git commit; no deployment or push requested. The supplied heightfield is absent: use exact 2D geometry without inventing terrain.
