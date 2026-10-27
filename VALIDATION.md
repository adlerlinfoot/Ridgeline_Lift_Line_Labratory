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

## Synchronized 3D visualization revision

26 automated tests pass. Additional checks cover exact planar waypoints/node elevations/junction alignment, 3D agent progress matching flat positions, camera-only interaction, rendering without physics mutation/RNG access, and removal of repeated-experiments browser UI. Updated DOM integration checks exercise all three view modes, height/label controls, reset camera, keyboard orbit, simulation completion and the three remaining exports. An offline SVG recording of actual 3D Canvas draw commands was rendered and visually inspected for route layout and labels. This is not an actual browser screenshot; no browser surface is available for full rendered desktop/mobile verification. No physical terrain surface was inferred.

## Cone and gyroscope revision

28 automated tests pass, including cone-radius/elevation consistency, route subdivision and gyroscope drag/snap/reset. DOM integration also checks cone toggle and gyroscope Home resetting the camera and matching UI fields. Offline render of the actual cone drawing commands was visually inspected and the initial zoom adjusted to fit the route layout. Full real-browser visual verification remains unavailable. The cone is an explicit display remapping and never changes engine routes, timing or behavior.

## Opaque mountain and label visibility

31 tests pass. Added exact display-name checks, multi-angle tests that far-side nodes/labels/skier pick targets are absent, and horizon clipping checks for route segments. The perspective visibility test accounts for vertical exaggeration and is disabled in the unwrapped view. An offline rendering was inspected to verify opaque fill, hidden rear labels and all requested peak names. No engine behavior changed.

## Main Lodge spawn revision

32 automated tests pass. Opening/later arrivals are verified at LODGE, with zero opening queues and timed class-admissible transfers. T04 split segments preserve full path length and equal lodge-to-L3/L4 distance. All six scenario/population full-day invariants remain valid. Queue-service unit fixtures explicitly start agents at a lift to isolate service timing; production config uses lodge-only spawning.

## Lodge percentage slider

34 automated tests pass. Added exact 0/100% cases and seeded 40% mixtures across all three scenarios, class-admissible fallback locations, reproducibility, invalid-range rejection, and later-arrival 50% allocation/export. DOM integration checks slider output and locking at run start.
