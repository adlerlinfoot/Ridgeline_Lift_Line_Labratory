# Acceptance checks

Run topology and context validators and reference-policy tests before extending behavior. `node --test tests/*.test.mjs` checks:

- All six scenario/population combinations through full day and drain; minute-wise population/time/queue invariants.
- Seed reproducibility and independence from frame/step partition.
- Zero-memory opening and admissible placement.
- Remote memory isolation and committed physical arrival without reroute.
- FIFO spacing, no stored idle capacity and strict closing cutoff.
- Park merge geometry, mandatory connector continuation, scenario-dependent routes.
- Lapper specialty dedication; mixed freeze/no supplementation.
- Stay expiry without queue abandonment and safe transfer expiry.
- Paired exogenous demand, plausible Poisson count and RNG sanity.
- Batch constraints, uncertainty and CSV quoting.

Browser QA: start/pause/resume/reset, inspect agents, change speed, run/cancel batch, inspect exports and narrow layouts. If browser automation is unavailable, report that limit; HTTP/DOM checks do not replace visual checks. Missing heightfield descent and formal mathematical stability are not certified.
