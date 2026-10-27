# Decisions and boundaries

User approved implementation and a local Git commit. No push or deployment requested.

Confirmed: opening rush; fixed/arrival switch; initial memories zero; cost includes ride; mixed preferences use prior personal completed waits without supplementation; race L1 only; no queued personal departures; closing overrides commitments; L4 is the only intervention.

Defaults: day 420 minutes; 09:00 display start (cosmetic); initial 650; 3 arrivals/minute; fixed mode default; fixed-mode preference threshold uses full day; equal mixed wait means use seeded random ties; no experience at threshold defers freeze to first base decision with experience; uniform complete itinerary sampling; ridge traverses count as transit.

Deferred: formal stability analysis, empirical calibration, manuscript bibliography/tense revision and original missing heightfield assets. No measured Vail claims.

## Latest confirmed flow rule (supersedes personal-stay departure rules above)

Arrival mode: independent Poisson arrivals before halfway (210 minutes of a 420-minute day); no arrivals afterward. Afternoon Poisson events at the same rate select uniformly from active, not-yet-selected skiers. Selected skiers finish committed queue/ride/descent, or exit at the next base if transferring. Do not select the same skier twice; skip selections when none eligible. No random personal-stay departures. Fixed mode unchanged. Class probabilities for incoming skiers remain 25/35/15/25. Mixed preference timing uses 40% of available time from arrival to close. Actual exits lag selections until a safe base.
