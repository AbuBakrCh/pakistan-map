# pakistan-map

Interactive single-page explorer for proposals to redraw Pakistan's provinces.

**Status:** design agreed, scenario content in draft, **no application code written yet.**

---

## What it is (and isn't)

A **polished explorer of curated, sourced proposals**. The user switches between complete
scenarios and compares each against the map as it actually is.

It is **not** a sandbox. No drawing, no painting, no hand-building of units — decided
deliberately (D1, D10).

Vocabulary: a proposed new province is a **unit**.

---

## Core model

```
Base map (rendered):   Province └── Division      ← always; keeps the map uncluttered
Building block:        District (136)             ← every unit is composed of these; 2023 census set
Statistics join:       District                   ← the census publishes here; exact, never interpolated
```

Districts are the atom because **every real proposal in Pakistan is stated in districts**
("11 districts", "13 districts", "six districts — Haripur, Abbottabad, Mansehra…"). District
lines are *not* drawn on the base map; they surface only where an active scenario's boundary
cuts through a division, or on zoom.

### Structure

```
Basis (4)  →  Variant (17 total)  →  Units  →  Districts
```

- **Basis** — the ground on which boundaries are argued. Selecting one fades the current
  administrative boundaries back and shades districts by that basis's data.
- **Variant** — a complete, named, sourced partition of Pakistan. **Atomic**: you switch
  between them, you don't edit them.
- Every variant is always a **complete partition** — no gaps, no unassigned territory.

### The four bases

| Basis | Source | Badge |
|---|---|---|
| **Current** (default view) | Official administrative geography | `official` |
| **Language / dialect** | PBS 2023 Census Table 11, mother tongue by district | `census` · `proxy` |
| **Administrative** | 2023 census population + derived geometry | `census` · `derived` |
| **Historical** | Documented past demarcations, 1947 onward | `documented` |
| **Development** | PBS 2023 Census Tables 12, 23, 24 — literacy, drinking water, toilet facilities | `census` for the three published rates; `synthesized` for any composite of them (#31) |

**Deliberately cut:**

| Cut | Reason |
|---|---|
| Sectarian (Sunni/Shia) | Pakistan's census has never asked. No subnational data exists from anyone. |
| Culture | Nothing measurable that isn't already language or religion. |
| Religion | Data exists, but ~96% Muslim — nothing to partition. |
| Natural geography | Real data, but no one actually proposes it; would have been our editorial voice. |
| Population (standalone) | Absorbed into Administrative. |

Governing rule from the owner: **if we don't have data, we don't use it for demarcation.**
A second rule emerged alongside it: *data existing isn't enough — it must actually support
drawing something.*

---

## Data

### Sources

| What | Source | Notes |
|---|---|---|
| Division boundaries | OSM `admin_level=5` | ~39 real + ICT injected; strays from India/Afghanistan filtered |
| District boundaries | OSM `admin_level=6` | Fetch returns ~170 current-day; dissolved to the 136-district 2023 census set (ADR-0001). **Not** geoBoundaries — its PD set is 2019/126 districts, ~40 short. **Names are never trusted alone.** Matching is normalized-name-plus-alias, with relation ids overriding it wherever a name lies or collides — Karachi's four renamed districts, and every AJK district, whose names recur across the Line of Control. Anything unmatched fails the build. PBS's own documents disagree with each other on spelling, and OSM's primary `name` on AJK districts is Urdu |
| Coastline | OSM `natural=coastline` | A way network, not a relation: chained on shared node ids with direction preserved (**land lies to the LEFT**), the open coast closed against a lon/lat extent, islands added as land. District polygons are clipped to it where their bounding box meets the shoreline's — one rectangle over the whole coast, so it nominates ~23 of the 156 districts including a dozen plainly landlocked ones, which clip to a no-op. Biased that way deliberately: a false positive costs nothing, a false negative would leave sea drawn as land. Natural Earth was rejected — a second lineage at a different vintage, against ADR-0001; OSM keeps one of each |
| District areas | PBS 2023 Census **Table 1** | Published per district, per province. What the clipped geometry is measured against |
| Population | PBS 2023 Digital Census | District level. Extracted from the `PakPC2023` `.RData` tables, committed as upstream bytes in `data/raw/pakpc2023-*.RData` and parsed by `scripts/lib/rdata.ts`, so the numbers trace to a published file rather than to a transcription. **Anchored outside the package** at exactly two tiers: the 5 province totals and the 241,499,431 national total, typed from PBS Census-2023 **Table 1 (national)** — both agree exactly. The **31 division totals** are checked against `pakpc2023-division.RData`, i.e. against another table of the same package whose district table is being validated: a cross-table consistency check, **not** an independent source. A division figure wrong in the package would agree with itself and pass. PBS publishes no division tier in Table 1 |
| Mother tongue | PBS 2023 Census **Table 11** | The structured release carries **tehsil rows only** — no district tier — so districts are summed from the 591 units under them, keyed on the table's own 136 district names. Safe because the sums reconcile exactly against PBS's printed province figures in **all fifteen categories**, typed from `table_11_national.pdf`: column by column, because a tehsil summed into the wrong district inside a province moves whole languages and leaves the total intact. Categories are the census's own, unmerged, including its spelling `Kohiostani`; an unknown one fails the build rather than falling into `Others`. Table 11's universe is **240,458,089** — 1,041,342 below Table 1, a difference PBS shares with Table 10 and does not explain, so it is stated and not closed. Khowar has no column, so **Chitral has no dominant language** and says so. See `docs/research/mother-tongue-table-11.md` |
| Development | PBS 2023 Census **Tables 12, 23 and 24** | Literacy (10+), improved drinking water, toilet facilities. Like Table 11 the structured release is **tehsil rows only**, so all three are summed from the 591 units and reconciled on **counts, not rates** — a province literacy rate is population-weighted and unrecoverable from district rates, so both halves of every rate are checked against the figures typed from the three `*_national.pdf` files. Seven of the eight counts reconcile exactly; **improved water does not** — PBS's tehsil rows count 6,374 more improved-water households than PBS's own printed province rows, a reclassification between sources that leaves the household totals exact. The deltas are pinned per province and any other value fails the build. **PBS publishes no improved-*sanitation* column:** it classifies water sources as improved or not, but for toilets prints only flush / non-flush / none, and a non-flush toilet may be improved or not. So the shaded share is **flush toilets, named as such**; combining them would be our definition wearing a `census` badge (that is #31, `synthesized`). Each rate keeps its own denominator — population 10+ for literacy, the **housing tables'** households for the other two, which are 48,010 below the district table's in all 136 districts. **Named *Development*, not *Poverty*:** the census sees service access, not income, consumption, child mortality or nutrition. MPI was dropped in favour of one source and one vintage. See `docs/research/development-indicators.md` |

Structured census extraction path: `PakPC2023` (CRAN, GPL-2, GitHub `myaseen208/PakPC2023`).
PBS publishes primarily as PDF.

### Vintage rule

**Everything pins to the 2023 census.** Administrative units created after the census fold
into their parent, because a unit with no census row cannot carry a population.

**This pins geometry as well as statistics** (ADR-0001). The drawn district set *is* the 2023
set: post-census districts are dissolved back into their 2023 parents rather than rendered.
Verified safe — every post-census unit folds into exactly one parent, so the dissolve recovers
the original boundary exactly rather than approximating it.

Consequence: the Balochistan restructuring of **8 July 2026** (divisions Pishin and
Koh-e-Sulaiman; districts Quetta East/West, Barshore, Wadh, Tump, Upper Dera Bugti) is **noted
in copy, not drawn**. The baseline is stale *on purpose*, and the app says so.

Three district counts coexist and all three belong in the bundle, because any one alone makes
the others read as a bug:

| Count | What it is |
|---|---|
| **136** | Census districts across the four provinces and ICT — the **statistical** atom |
| **156** | Everything **drawn**: the 136 plus AJK's 10 and GB's 10, which have boundaries but no census indicators (D25) |
| ~170 | Current-day district relations OSM returns, including post-census creations. Never drawn |

See `docs/research/`.

### Pipeline

Build-time bake, **artifacts committed** — not gitignored.

Split by failure mode, so network flakiness never contaminates geometry work:

| Script | npm script | Does |
|---|---|---|
| `scripts/fetch-osm.ts` | `build:data:fetch` | Network only. Admin levels 4, 5, 6 and the coastline → `data/raw/`, retrying across four Overpass mirrors. Level 4 exists solely to source ICT |
| `scripts/normalize-geometry.ts` | `build:data:normalize` | Filters strays → folds post-census units into their 2023 parent → injects ICT → stitches rings → clips coastal districts to the coastline → merges all three tiers from one shared arc set → simplifies → `data/bundle/geography.topojson.json` |
| `scripts/join-census.ts` | `build:data:census` | Reads the committed `PakPC2023` `.RData` cache → resolves census spellings onto the roster → sums districts and reconciles them upward: divisions against the package's own division table, provinces and the national total against PBS Table 1; sums Table 11's tehsils into districts and reconciles every language column against PBS's printed province figures; sums Tables 12, 23 and 24's tehsils into districts and reconciles all eight development counts against PBS's printed province figures → `data/bundle/statistics.json`. Fails on an unplaced row, an uncovered district, an unknown language category, a count larger than the universe it is part of, or a total that does not add up. The emitted artifact records, per tier, which source the check was against |

The fold table — post-census district → 2023 parent — is data, not code:
`data/reference/post-census-district-folds.json`. Both pipelines read it.

**The fold table follows the fetch, it never leads it.** Entries are keyed by the name the
current OSM fetch actually carries, never by an official name OSM has not adopted yet; when a
rename lands upstream, the fetch and the table are updated in the same commit. So a build
failing on an unrecognised name is the intended signal that upstream moved — not a defect to
be pre-empted by guessing. Leading the fetch would accumulate entries nothing can falsify.

A **rename** and a **split** are different events, and only the first has a display answer.
Karachi's four renamed districts are pure renames, resolved by relation id. Dera Bugti is a
split: the census counted it whole, February 2026 bifurcated it, and July 2026 renamed the two
halves North and South. There is therefore no current official name for the unit we draw —
*North Dera Bugti is half of it, not another word for it* — so the 2023 census name stands,
and the restructuring is noted in copy per the vintage rule.

The numbered tables — 11, 12, 23, 24 — are the cache files the package ships **xz**-compressed
rather than gzip; the build decompresses them (`xz-decompress`) rather than committing
re-compressed copies, so the committed bytes still match CRAN's published MD5s and the provenance
rests on no conversion of ours.

Still to come: the adjacency graph (#16), per-variant derived stats (#20) and the composite
development index (#31, badged `synthesized` — the census publishes no such figure). Shared pure
logic lives in `scripts/lib/` with tests beside it.

Every relation must be classified. A relation matching no 2023 district and no fold rule
**fails the build** rather than being skipped — a silent discard is how the district set drifts
without anyone noticing, and the point of committing the bundle is that boundary changes are
reviewable diffs.

Committing the output means **every boundary change is a reviewable diff with a date on it**.
Runtime makes zero network calls.

> Overpass is rate-limited and periodically down. Build-time problem only — and the reason
> runtime fetching was rejected: upstream OSM edits would silently mutate boundaries between
> page loads.

### Test seam

One command, no arguments, no fixtures:

```
npm test          # vitest run — the whole suite, once
npm run typecheck # tsc --noEmit
```

The suite is a **single seam over the committed bundle** (#12). It runs against
`data/bundle/` — the exact artifact that ships — so there is no network, no Overpass, no mocks
and no fixtures, and it is fast and deterministic. Everything that can go seriously wrong with
this app is a property of that artifact: if a unit's population is wrong, we have published a
false figure about Pakistani provinces.

The renderer is tested at its **pure seams only** — projection, tier extraction, label layout.
`src/map.ts` is imperative D3 against the DOM and carries no tests of its own; the repo has no
jsdom, deliberately. Where a rendering criterion is worth holding, it is held over the real
bundle through the real projection instead — which is why the label tests name the divisions
that go unlabelled at default zoom rather than counting them.

What it holds:

| Property | Where |
|---|---|
| Referential integrity — every district under a real division and a real province, the two agreeing; no empty division; every fold landing on a drawn district | `bundle.test.ts` |
| Vintage rule — every one of the 136 census districts present exactly once, none null or zero, 2023 fields only, AJK/GB listed as absent rather than as zero | `statistics.test.ts` |
| Statistical integrity — districts summing to all 31 division totals, to the 5 province totals and to the 241,499,431 national total, against figures typed from PBS Table 1 rather than read back off the artifact | `statistics.test.ts` |
| Mother tongue — every census district carrying all fifteen categories, summing to the district figure and to the language totals PBS printed per province; a dominant language only where the census names one, Chitral named as the two it does not; the districts PBS counts above their own population listed rather than smoothed | `statistics.test.ts` |
| Development — every census district carrying all three indicators with both halves of each rate; shares proportions in 0–1 and equal to their own halves; toilet categories partitioning their own households; districts summing to the counts PBS printed per province and nationally; the 6,374-household improved-water difference asserted exactly rather than tolerated; folded districts inheriting their parent's indicators | `statistics.test.ts` |
| Anchors inside the shape they name, a projection fitted to Pakistan, no two names overlapping, both territories named | `src/lib/*.test.ts` |
| No network, and one entry point | `seam.test.ts` |

Failures name the offending district or unit, never only a count. `seam.test.ts` enforces the
offline property rather than assuming it: no module under `scripts/lib/` **or `src/`** may name
a network primitive, nothing may import `fetch-osm.ts`, and every input must be committed — so
a fresh clone runs the suite with the machine unplugged. `src/` is the half that matters, since
D19's zero-network claim is about the runtime; the scan covers both directories entire, and
asserts that it still reaches the renderer.

CI (`.github/workflows/ci.yml`) runs exactly those two commands on every push and pull request,
on a pinned Node 22. It has nothing else to do: the artifacts are baked and committed, so there
is no build to guard.

---

## Interaction

**Default:** current provinces and divisions, named. Nothing else.

**Selecting a basis:** current boundaries fade back, districts shade by that basis's data,
the active variant's unit outlines draw prominently on top.

**Three visual strata:**

1. **Fill = data** (dominant mother tongue, development band…) — *never* unit membership
2. **Current boundaries** — thin, faded, once a basis is active
3. **Unit outlines** — heavy, labelled, on top

Fill shows data so each proposal is displayed *against its own evidence*. Where a unit outline
disagrees with the shading beneath it, that disagreement is the most informative thing on the
map — and it's why a scenario misrepresenting its advocates' claim can't be footnoted away.

**Hover** — highlights district, current province, and proposed unit at once; tooltip names
all three. Resolution follows the active scenario's atom.

**Compare** — hold `Space` (or tap Compare) to drop strata 1 and 3 and restore the real map
at full strength. The *only* map comparison; no side-by-side, no cross-variant table.

**Variant card** — name, basis badge, provenance badge, unit count, 2–3 sentence rationale,
**Advocated by** *and* **Opposed by**, and a scorecard (population spread, largest:smallest
ratio, districts moved, non-contiguous units).

Contiguity is **flagged, never blocked**.

---

## Politically sensitive rendering

- **AJK and Gilgit-Baltistan** drawn and named, styled as **territories, not provinces** —
  constitutionally they are not provinces. **Not fully interactive:** PBS's 2023 results cover
  136 districts — the four provinces and ICT only — so no AJK or GB district has a mother
  tongue, literacy, water or sanitation figure. They cannot be shaded under any basis, and
  carry no hover statistics beyond a name. AJK population exists only relayed via AJK BoS,
  never direct from PBS.
- **Line of Control drawn dashed and labelled** — a ceasefire line, not an international
  border. Solid would be a claim this app's data can't support.
- **"GB as 5th province" is content, not baseline** — a live proposal (provisional status
  announced Nov 2020; GBLA resolution), so it's a switchable variant.
- **Durand Line** — normal boundary with a footnote.
- Faint, unlabelled neighbour silhouettes for context.
- **PNG export bakes in** scenario name, legend, provenance badge, data vintage, source, and
  "proposed — not official". This content will travel as WhatsApp and X screenshots regardless;
  the sanctioned export exists so circulating copies carry their own disclaimer.
- **Naming:** units named as *their own advocates* name them, alternatives shown in the card
  ("South Punjab (also: Saraikistan, Saraiki Wasaib)"). The app reports what people call
  things; it doesn't adjudicate.
- **Every scenario card carries an "Opposed by" line.** Without it the app reads as advocating
  whatever is on screen.

---

## Stack

- **Vanilla TypeScript + Vite + D3.** No framework — runtime state is four values (active
  basis, active variant, hovered district, compare-held); no routing, no async, no forms.
- **Inline SVG, custom projection, no basemap.** Showing only Pakistan deletes the reason to
  use a mapping library. D3 owns the SVG *and* renders the panel lists.
- Pan/zoom via `d3-zoom`. Sparse major-city dots instead of a basemap.
- Deep-link URLs (`#/language/l2`).
- **Visual direction: editorial atlas, light.** Warm off-white canvas, muted desaturated
  categorical fills, hairline strokes, serif headings, one accent reserved for unit outlines.
  No dark mode in v1 — categorical palettes are harder to keep distinguishable on dark, and
  the editorial register signals *reference* rather than *toy* on a politically live subject.
- Palette validated via the `dataviz` skill for colourblind safety.
- **Responsive, desktop-primary.** Hard bar: **map legible and variant switching functional
  at 390px.** Panel becomes a bottom sheet; hover becomes tap; `Space` becomes a button.

---

## Decisions

Numbered by the grilling question that settled each.

| # | Decision | Why |
|---|---|---|
| D1 | Curated explorer, not a sandbox | Simplicity; a blank map is intimidating and stats are meaningless until complete |
| D2/D3 | OSM for boundaries, pinned to census vintage | GADM-derived data (PakData) is a ~2000s snapshot — says "N.W.F.P.", "F.A.T.A.", "Northern Areas" |
| D4/D5 | No sect, culture, religion, or natural-geography basis | No data / no partitionable structure / would be our editorial voice |
| D6 | Always a complete partition | Every intermediate state stays valid and comparable |
| D7 | Contiguity flagged, not blocked | Hard enforcement breaks legitimate intermediate states |
| D8 | Conflicting units mutually exclusive | Never draw a mutilated claim carrying a real movement's name |
| D9 | One basis at a time | Eliminates cross-basis conflicts for free |
| D10 | Variants atomic | Owner's call, for simplicity |
| D11 | D3 + SVG, no map library | No basemap needed; variant morphs trivial in D3, painful in MapLibre |
| D12 | LoC dashed, AJK/GB as territories | Consistency with the app's own provenance discipline |
| D13 | Basis *is* the overlay | One control, self-explaining map |
| D14 | Fill = data, not unit membership | Otherwise every basis looks identical and the justification layer vanishes |
| D17 | Compare = variant vs. reality only | The current map is what every proposal argues against |
| D19 | Bake at build time, commit artifacts | Reproducibility; boundaries must not mutate without a commit |
| D20 | Vanilla TS | Four state values; React would be walled out of 90% of the UI anyway |
| D22 | PNG export with baked provenance | Screenshots travel regardless; make the honest one the easy one |
| D23 | Districts as the building block | Every real proposal in Pakistan is stated in districts |
| D24 | Single vintage — 2023 geometry *and* statistics (ADR-0001) | Two vintages meant drawing districts that had no data; verified that every post-census unit folds into exactly one parent, so the dissolve is exact |
| D25 | AJK/GB drawn but not shaded | PBS 2023 publishes 136 districts — provinces + ICT only. No AJK/GB indicator data exists to shade with |
| D26 | Coastline from OSM `natural=coastline`, not Natural Earth (#38) | Same source, licence and base timestamp as the boundaries, so clipping costs no second provenance lineage and ADR-0001 needs no amendment. Harder to use — a way network rather than a polygon — which is the price of that |

---

## Open items

1. ~~**AJK district list** is from memory~~ — **resolved.** 10 districts in 3 divisions,
   confirmed against AJK BoS and PBS. The set was right; the *names* were not (officially
   **Jhelum Valley**, not Hattian Bala; **Sudhnoti**, not Sudhanoti) and Haveli sits in Poonch
   division, not Muzaffarabad. See `docs/research/ajk-district-set.md`.
2. ~~**Balochistan's division and district set** needs verification~~ — **resolved.** 8
   divisions, 34 districts, proved complete by population sum. Surab is *not* new (draw it);
   Taftan is not a district at all. See `docs/research/balochistan-division-district-set.md`.
   The current-day 41-district roster remains unresolvable without the provincial gazette —
   which no longer blocks anything, since under ADR-0001 none of it is drawn.
2b. **Can a variant claim AJK territory?** L2 (#24) and H2 (#30) reference AJK districts, which
   are drawn but unshaded and carry no PBS-direct statistics. Product decision outstanding.
3. **Deployment target** — deliberately undecided. Static bundle, builds to `dist/`.
4. **`SCENARIOS-DRAFT.md` is temporary.** Once approved it becomes a typed data module and the
   markdown is deleted — every field in it (rationale, advocacy, opposition, footnotes) is
   rendered variant-card content, not documentation. Keeping both would be two sources of truth.

**Scenario content: 17 variants approved** — Language 7, Administrative 5, Historical 4,
Development 1. H2 omits Amb and Phulra (sub-district, cannot be drawn without inventing a
boundary). Karachi and Pashtun Balochistan are attributed variants, not algorithmic by-products.

---

## Working agreement

- Scenario content is reviewed as **markdown, before code**. The variants are the product; the
  machinery is not. Political judgments get reviewed in a diffable table, not through the
  distraction of a running UI.
- No unsourced surface anywhere. Every fill, every number, every boundary traces to a published
  figure or a published boundary, and carries a badge saying which.

---

## Agent skills

### Issue tracker

Issues live as GitHub issues in [AbuBakrCh/pakistan-map](https://github.com/AbuBakrCh/pakistan-map), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
