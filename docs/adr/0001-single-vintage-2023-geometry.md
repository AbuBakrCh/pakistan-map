---
status: accepted
date: 2026-08-01
---

# Pin geometry to the 2023 census, not just statistics

The vintage rule originally pinned only *statistics* to the PBS 2023 Digital Census while
drawing current-day administrative geography from OSM. That produced a two-vintage map:
lines from today, numbers from 2023, and post-census districts rendered as shapes with no
data behind them. We now pin **both** to the census — the drawn district set is the 2023
set, reconstructed by dissolving post-census OSM districts back into their 2023 parents.

## Why

One vintage is far easier to defend on a politically live subject than "the lines are from
now, the numbers are from 2023". It also closes a structural hole: under the old rule a
district created after March 2023 was drawn (it exists in OSM at `admin_level=6`) but had
no census row, so it appeared on screen with nothing to shade it. Under single vintage,
every drawn polygon carries data by construction.

## What made it safe

The reconstruction is exact, not approximate. Verification (`docs/research/`) established:

- Every post-census Balochistan district folds into **exactly one** 2023 parent — no unit was
  carved from two parents, so no 2023 boundary was destroyed by a split. Dissolving recovers
  the original line precisely rather than approximating it.
- The 2023 Balochistan set is provably complete: its 34 district populations sum to
  14,894,402, exactly the published provincial total.
- AJK's administrative and census district sets are one-to-one; nothing folds.

Balochistan was the hard case — the most recently restructured region in the country. Had a
cross-parent carve existed, the affected district would have needed a documented
approximation and a provenance badge saying so. None does.

## Addendum: the coastline does not breach this (#38)

Coastal districts had to be clipped to a shoreline, and a shoreline is a new data source — so
the question of whether that crosses the single-vintage rule had to be answered before the
clipping was written, not after. **It does not, and this ADR needs no amendment.** Recording
the reasoning here rather than leaving it implicit is the point:

- The source chosen is OSM `natural=coastline`, fetched through the same Overpass query path,
  under the same ODbL licence, and stamped with the same `timestamp_osm_base` as the boundary
  relations it clips. It is the same lineage at the same vintage. Nothing about "the lines are
  from one place and the shore from another" arises.
- **Natural Earth was rejected for exactly this reason.** It is trivially easier to use — a
  ready-made polygon rather than a way network that has to be chained and closed — but it is a
  second provenance lineage at a different vintage, and it would have made the map's outline
  answer to a source the rest of the geometry does not.

The residual is a difference of *definition*, not of vintage: in the Indus delta PBS counts a
district's tidal creeks as its area and a shoreline does not, so Thatta and Sujawal read low.
That is recorded in the bundle's `knownLimitations`, where it belongs.

## Consequences

- The rendered map is knowably not today's map, uniformly. The app must say so.
- Post-census units (Quetta East/West, Barshore, Wadh, Tump, Upper Dera Bugti; divisions
  Pishin, Koh-e-Sulaiman) are **not drawn at all** — stronger than the previous "noted in
  copy, not drawn", which applied only to divisions.
- The build needs a fold mapping from current OSM districts to 2023 census districts. It is
  data, it changes when Pakistan reorganises, and it is committed and reviewable like every
  other artifact.
- Two district counts now coexist and must be carried explicitly so the difference never
  reads as a bug: **136** census districts (four provinces + ICT — the statistical atom) and
  the larger current-day OSM set the fetch returns.
