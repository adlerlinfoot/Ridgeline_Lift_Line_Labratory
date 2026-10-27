# Interface

Static HTML/CSS/modules, no paid/backend service. One physical Simulation instance drives the flat topology and interactive perspective 3D skeleton, with matching skier IDs, colors, queue counts, timing and selection. Both views/Flat map/3D skeleton buttons change presentation only. Small screens stack both views.

3D controls: pointer orbit, wheel/pinch zoom, Shift/right-drag pan, two-finger pan, arrow-key orbit, +/- zoom, Home/reset camera. Adjustable vertical exaggeration and node labels. Hover route/node metadata; click moving skiers to inspect memories and highlight in both views. Node elevations are supplied; interior heights are interpolated along planar route segments, explicitly anchored at junctions. No missing terrain surface is reconstructed.

Existing controls: play/pause/reset, seed, speed, infrastructure, opening count, flow rate and population mode. Settings lock on start; reset to reconfigure. Queue charts, state population and current-run CSV/JSON exports remain. Repeated-experiments panel and browser batch handlers are removed; CLI batch utilities remain.

Latest presentation update: default schematic cone wrap and opaque conical body, plus on-screen gyroscope drag/compass snap/reset. Cone can be unchecked to restore the earlier exact-planar-coordinate skeleton view. Supplied elevations and shared simulation state are unchanged; wrapping is display-only and routes are subdivided for curved rendering. No physical terrain is inferred.

Opaque-cone visibility: only front-facing route portions, skiers, queue markers, node labels and their hover/click targets are rendered. Visibility follows the perspective camera and vertical exaggeration as the mountain rotates. Display names: West peak, East Peak, Aspen peak, Meadow top; graph IDs remain unchanged.

Latest user-confirmed spawn rule supersedes random base placement: all opening and later-arrival skiers spawn at Main Lodge (LODGE), the explicit midpoint junction on T04 between M_BASE/L3 and A_BASE/L4. Split T04 internally in both directions without changing its full path length. Travel from lodge to admissible lifts consumes base-transit time; no direct initial queue placement. Initial queue memories remain simultaneously zero. Lodge is drawn in flat and 3D views with the existing occlusion rule. Departures still end at safe bases, without a required lodge return.
