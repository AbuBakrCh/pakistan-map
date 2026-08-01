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
Building block:        District (~165)            ← every unit is composed of these
Statistics join:       District                   ← census + MPI both publish here; exact, never interpolated
```

Districts are the atom because **every real proposal in Pakistan is stated in districts**
("11 districts", "13 districts", "six districts — Haripur, Abbottabad, Mansehra…"). District
lines are *not* drawn on the base map; they surface only where an active scenario's boundary
cuts through a division, or on zoom.

### Structure

```
Basis (4)  →  Variant (3–4 each, ~14 total)  →  Units  →  Districts
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
| **Economic** | District Multidimensional Poverty Index (Planning Commission + OPHI) | `survey 2014/15` |

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
| District boundaries | OSM `admin_level=6` | ~165. **Not** geoBoundaries — its PD set is 2019/126 districts, ~40 short |
| Population | PBS 2023 Digital Census | District level |
| Mother tongue | PBS 2023 Census **Table 11** | Published at province, division, district *and* tehsil |
| Deprivation | District MPI, PSLM 2014/15 | 15 indicators. **A decade older than everything else — must be badged** |

Structured census extraction path: `PakPC2023` (CRAN, GPL-2, GitHub `myaseen208/PakPC2023`).
PBS publishes primarily as PDF.

### Vintage rule

**Everything pins to the 2023 census.** Administrative units created after the census fold
into their parent, because a unit with no census row cannot carry a population.

Consequence: newer Balochistan divisions (Pishin, Koh-e-Sulaiman, ~2025–26) are **noted in
copy, not drawn**. The baseline is stale *on purpose*, and the app says so.

### Pipeline

Build-time bake, **artifacts committed** — not gitignored.

`scripts/build-data.ts` fetches → filters → injects ICT → joins census and MPI by district
code → simplifies geometry → precomputes the adjacency graph and every variant's derived
stats → emits one TopoJSON + JSON bundle stamped with generation date and source URLs.

Committing the output means **every boundary change is a reviewable diff with a date on it**.
Runtime makes zero network calls.

> Overpass is rate-limited and periodically down. Build-time problem only — and the reason
> runtime fetching was rejected: upstream OSM edits would silently mutate boundaries between
> page loads.

---

## Interaction

**Default:** current provinces and divisions, named. Nothing else.

**Selecting a basis:** current boundaries fade back, districts shade by that basis's data,
the active variant's unit outlines draw prominently on top.

**Three visual strata:**

1. **Fill = data** (dominant mother tongue, deprivation band…) — *never* unit membership
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

- **AJK and Gilgit-Baltistan** included and fully interactive, styled as **territories, not
  provinces** — constitutionally they are not provinces.
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
| D23 | Districts as the building block | Every real proposal is stated in districts; MPI has no division-level source |

---

## Open items

1. **`SCENARIOS-DRAFT.md` needs rewriting at district resolution.** Drafted at division level,
   which broke on its first scenario. Mostly transcription now — the sources state districts.
2. **L3 (Saraikistan Qaumi Council)** — resolved by districts. The claim names D.I. Khan and
   Tank; D.I. Khan *Division* also contains the Waziristans (888,675 people, 95–98% Pashto-
   speaking) which the claim excludes. At division resolution the app would have shaded those
   districts Pashto while enclosing them in a Seraiki province — a visible self-contradiction.
3. **H2 (princely states, 1947–55)** — mostly resolved by districts. Swat, Dir, Chitral, Kalat,
   Las Bela, Kharan map cleanly. **Amb, Phulra, Hunza, Nagar are still sub-district.** Attach
   no modern population figures to 1947 boundaries.
4. **Economic basis** — may support only one honest variant (E2: split each province at its
   internal deprivation fault line). Deprivation doesn't form contiguous blocs the way language
   does. Consider folding it into other bases as supporting evidence rather than standing alone.
5. **Deployment target** — deliberately undecided. Static bundle, builds to `dist/`.

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
