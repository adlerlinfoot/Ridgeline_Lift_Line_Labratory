# Ridgeline v2 — 20-run inventory

| ID | Name | Grade | Topological path | Special |
|---|---|---|---|---|
| B01 | North Face | Black | W_TOP → PARK_MERGE → W_BASE | Receives shortened park P01 at middle junction |
| B02 | Granite Cut | Black | W_TOP → W_BASE | West full descent |
| B03 | Meadow Connector · West | Black | W_TOP → M_JOIN | Connection to B09 toward Meadow Top |
| B04 | Aspen Traverse · West | Black | W_TOP → A_TOP | Requires Aspen downhill access / L4 open |
| P01 | Westline Terrain Park | Park | W_TOP → PARK_MERGE | Short park ending on B01 |
| B05 | East Cliffs | Black | E_TOP → E_BASE | East full descent |
| B06 | Hawk's Nest | Black | E_TOP → E_BASE | East full descent |
| B07 | Aspen Connector · East | Black | E_TOP → A_TOP | Requires Aspen downhill access / L4 open |
| B08 | Meadow Traverse · East | Black | E_TOP → M_JOIN | Feeds B09, reaching Meadow from east summit |
| B09 | Meadow Link · Final | Black | M_JOIN → M_TOP | Downstream common outlet for B03 and B08 |
| P02 | Eastline Terrain Park | Park | E_TOP → E_BASE | East park |
| B10 | West Needle · Race Line | Black/race | RACE_GATE → RACE_FINISH | Far west flank, both summit access via T01/T02 |
| G01 | Meadow Loop | Green | M_TOP → M_BASE | Vacationer-eligible, L3 |
| G02 | Schoolyard | Green | M_TOP → M_BASE | Vacationer-eligible, L3 |
| U01 | Ribbon Blue | Blue | M_TOP → M_BASE | Vacationer-eligible, L3 |
| U02 | Glade Traverse | Blue | M_TOP → M_BASE | Vacationer-eligible, L3 |
| G03 | Aspen Way | Green | A_TOP → A_BASE | Vacationer-eligible, L4 |
| G04 | Easy Street | Green | A_TOP → A_BASE | Vacationer-eligible, L4 |
| U03 | Blue Jay | Blue | A_TOP → A_BASE | Vacationer-eligible, L4 |
| U04 | Sundowner | Blue | A_TOP → A_BASE | Vacationer-eligible, L4 |

**Totals:** 10 black (five connector edges, four full descents, one race), 2 parks, 4 greens, 4 blues = 20.

`PARK_MERGE` is an explicit internal vertex of B01 (zero-based polyline index 3); a skier completing P01 continues on the second portion of B01. `M_JOIN` is a true common endpoint: B03 or B08 → B09 → M_TOP. Intersections elsewhere do not automatically enable transfers.

**Baseline closures:** L4 closed → G03/G04/U03/U04 unavailable, plus B04/B07 unavailable (because Aspen Top otherwise cannot be exited). Both expert summit lifts and the west-side race remain usable.
