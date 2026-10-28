# Experiments

All three supplied infrastructure scenarios, 20+ independent seed replications per setting. Baseline versus four-lift changes infrastructure, active terrain and some assignments; not pure capacity. Vacationer-constrained four-lift comparison distinguishes additional permission expansion.

Fixed: same initial count, no later arrivals/personal departures. Arrival: same opening count plus Poisson demand 2,3,4,6/minute by default, uniform stays 120–360 minutes. Both stop boarding at closing. No warm-up silently removed. Drain activities remain timestamped.

Primary integrated outcome: queue-person-minutes. Inspect per-lift trajectories, maxima, completed waits, closing removals, throughput, relocations and class-specific records. Skiing time supports interpretation. Closing queue drops are not stability evidence.

For class-share sensitivity, adjust nonnegative weights in MODEL_CONFIG.json and record the effective config. Live and batch use the same configuration. No extra queue-shock mechanism exists.

## Latest confirmed flow rule (supersedes personal-stay departure rules above)

Arrival mode: independent Poisson arrivals before halfway (210 minutes of a 420-minute day); no arrivals afterward. Afternoon Poisson events at the same rate select uniformly from active, not-yet-selected skiers. Selected skiers finish committed queue/ride/descent, or exit at the next base if transferring. Do not select the same skier twice; skip selections when none eligible. No random personal-stay departures. Fixed mode unchanged. Class probabilities for incoming skiers remain 25/35/15/25. Mixed preference timing uses 40% of available time from arrival to close. Actual exits lag selections until a safe base.

Latest requested repeated-run visual: provide a separate selected-scenario overlay control (2–200 runs, default 20), preserving all current physical parameters and varying only the seed. This is not the old automatic three-scenario comparison panel. Plot every individual queue/wait trajectory using the shared fixed lift palette. No prediction, model fitting, confidence intervals or inferred outcome probabilities. Worker runs preserve the interactive live simulation. Allow lift visibility toggles, observed-value hover, stopping, and plain-text/CSV downloads of completed run values with settings/seeds.
