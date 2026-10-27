# Paste this prompt into Codex, with this directory mounted in the repository root

Build the **Ridgeline Lift-Line Congestion ABM** as a working browser-based simulation. Follow `AGENTS.md` and read the full spec in `spec/` before coding. The supplied `topology/` is validated authoritative geometry, not an invitation to redraw the resort.

Requirements:

1. Create a reproducible pure simulation engine decoupled from the renderer (fixed timestep, seeded PRNG, FIFO lift boarding with capacities from topology JSON, Poisson spawning, planned base-only departure and conservation tests).
2. Implement four main skier classes and conditional lapper subtype draw **park:race:other = 10:2:5**. Park lappers **may switch between P01 and P02** using the common remembered queue + physical valley travel heuristic; race lappers repeatedly ski B10 via their assigned supporting lift and ridge; other lappers repeatedly ski one assigned full-interest run. Do not treat all lappers as fixed to one lift.
3. Initialize memory of all *active* lift queue sizes at spawn. Refresh only when physically visiting a lift. Keep remote queue data hidden from the agent. Decision happens at a base after a complete descent, then destination is committed.
4. Render the mountain from `topology/resort-map.json` and `terrain-grid.json`. Animate dot-turtles on run/lift/transfer centerlines; honor `PARK_MERGE`, `M_JOIN`, mandatory lower-run continuations and race T01/T02/T06.
5. Give vacationers only green/blue lifts. Support three configurations A 3-lift baseline, B 4-lift capacity-only control, C 4-lift intervention. Scenario changes restart the simulation safely.
6. Build play/pause/reset/seed/speed controls, arrival-rate slider, 3/4-lift switch plus advanced control, queue/wait plots by lift, skiing-time metrics and a batch comparison that runs **20+ replicates per parameter value** with CSV/JSON downloads.
7. Add tests covering each rule in `spec/ACCEPTANCE_TESTS.md`; run included static/policy tests first. Keep the UI deployable as static GitHub Pages with relative asset URLs.

Maintain paper's notation `Q_j`, `lambda_j`, `S_j(t)` actual boarding, `mu_j` maximum capacity, `k_j=Q_j/mu_j` estimated wait. Don't claim the inventory ODE alone determines stability or that toggling L4 automatically constitutes a bifurcation.

Start by scaffolding repo and verifying `python topology/validate_map.py`, `python tests/validate_context.py`, `node --test tests/reference-policy.test.mjs`. Then implement engine + tests, then UI, then batch analytics, then polished docs. Provide reproducible demo instructions, test output, and the next unresolved questions.
