# Bid Tracker

End-to-end bid handling for concrete/construction jobs — lead through walk-down,
estimate, scheduling, and completion. Mobile-first, vanilla HTML/CSS/JS, no
build step, no framework, no API keys.

## Stack

- **Map tiles**: OpenStreetMap via Leaflet
- **Geocoding/autocomplete**: Photon (komoot)
- **Routing**: OSRM public demo server (Trip API, optimized stop order)
- **Storage**: browser localStorage (per-device, no backend)

Free tier, fine for a client demo. Not sized for production traffic.

## Files

```
index.html      shell: tabs, board/map/schedule views, job modal
base.css        reset, nav, layout (mobile-first, desktop override at 700px)
components.css  board, map toolbar, modal (mobile-first, desktop override)
calendar.css    month/week/day calendar styling
state.js        job model, localStorage persistence, pub/sub
map.js          Leaflet init, origin geolocation, job pins, OSRM trip routing
board.js        kanban board — mobile shows one status at a time via pills,
                desktop shows all columns side by side
calendar.js     month/week/day calendar (replaces the old flat schedule list)
jobDetail.js    create/edit/delete modal, Photon address autocomplete
main.js         tab switching, wires everything together
```

## Status pipeline

| Status | Meaning |
|---|---|
| Walk-down | needs a site visit |
| Estimate | needs a bid sent |
| Sent | estimate sent, awaiting reply |
| Scheduled | on the books |
| Done | job complete |
| Lost | didn't get the job |

Matches Caleb's existing color system (red/purple/black/blue/green/yellow) 1:1.
Drag a card between columns on desktop, or open a job and change its Status
field on mobile, to move it through the pipeline.

## Views

- **Board** — kanban by status. Mobile: pill switcher up top, one column at a
  time. Desktop: all columns visible, drag-and-drop between them.
- **Map** — filter by status, pins color-matched to status, "Route these jobs"
  runs an optimized multi-stop route from your current location.
- **Schedule** — real calendar: month grid (dots per day, colored by status),
  week view, day agenda view. Shows both `scheduledStart` and `walkdownDate`
  entries. Tap a day in month view to jump to its day agenda.

## Running it

No build step. Serve the folder any way you like:

- **GitHub Pages**: push to a repo, enable Pages on the root
- **Locally**: `python3 -m http.server` (or any static server) from this folder
  — opening `index.html` directly via `file://` will break the ES module imports

## Known limitations

- Single device only — localStorage doesn't sync across phone/desktop
- No Google Calendar import yet (planned: one-time `.ics` file import — no
  OAuth/credentials needed, but Google's basic export won't carry his existing
  color-coding, so imported jobs land in one default status to be re-sorted)
- No reminders/notifications
- No call/text history tied to a job
- No audit trail on edits