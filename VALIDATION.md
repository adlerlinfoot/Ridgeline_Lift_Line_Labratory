# Implementation validation — 2026-10-27

Environment: Windows, Python 3.12, Node.js 24.21.0.

- `python topology/validate_map.py`: passed counts, planar lengths, endpoints, explicit merge, scenario dependencies and downstream safe-base reachability.
- `python tests/validate_context.py`: passed current configuration/user-rule checks.
- `node --test tests/*.test.mjs`: **17 tests passed**. Includes all six full-day scenario/population combinations with minute-wise invariants, FIFO capacity/closing behavior, stale memories, specialty itineraries, preference freeze, personal-stay policies, reproducibility across timestep partitions and a real worker batch.
- `node scripts/batch.mjs fixed 20` and `node scripts/batch.mjs arrival 20`: **300 full-day replications** completed during validation (3 fixed settings and 12 arrival settings, 20 each). Output files are local ignored `.runtime/` artifacts; not empirical data or published research findings.
- Local HTTP entry point returned 200. DOM integration harness exercised startup, scenario/mode changes, locked settings, playback through safe drain, five CSV/JSON downloads, real worker batch completion, cancellation and invalid-input recovery. Harness used installed jsdom from an existing local project; it is not an application runtime dependency. Canvas calls were mocked.
- `git diff --check`: passed.

No browser surface was available to the session, so rendered desktop/mobile appearance and real browser download behavior have **not** been visually verified. DOM tests are not represented as visual browser tests. The original heightfield is absent; no continuous-elevation validation or 3D reconstruction is claimed. No formal equilibrium stability proof is claimed by these implementation tests.

## Two-phase flow revision

21 automated tests pass after replacing random personal stays with morning arrivals/afternoon departure selections. Added halfway cutoff, no pre-halfway exits, no afternoon arrivals, non-repeated departure selection, safe descent completion, pool exhaustion and incoming class-proportion checks. Prior 300-run batch figures describe the earlier flow version and are not results for this revised flow.
