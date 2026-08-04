# pakistan-map

Interactive single-page explorer for proposals to redraw Pakistan's provinces.

**Status:** design agreed, **scenario content complete — all 13 variants are in the typed
module** (Language L1–L7, Administrative A6, Historical H1–H4, Development D1;
`SCENARIOS-DRAFT.md` is deleted, which is #36). Pipeline and bundle built; the map built through
its **three strata with the basis and variant selectors** (#18) over its **neighbour silhouettes
and city dots** (#8), the **variant card** beside it (#19), the **adjacency graph** flagging each
unit's contiguity (#16), the **scorecard** (#20), the **compare gesture** holding a proposal off
the map (#22), a **deep link** per view (#23), the **About the data** panel (#21), the **phone
adaptation** (#33), the **Development basis** (#31), the **Administrative fill** and the **method
note** saying in prose how the map on screen was built (#52) — **three of the four bases are drawable**,
and Historical is short of both a shading and a method summary, which are now the same basis's two
gaps. **That basis is withheld from the UI**: rather than offering a chip nobody can press, the menu
now carries only the three that are live (`HIDDEN_BASES` in `src/lib/selection.ts`). The withholding
is the menu entry and nothing else — H1 to H4 stay in the bundle, in the suite, and on the About
panel, and `#/historical/…` still resolves the way it did.

Four of the thirteen boundaries this build **derives rather than transcribes**, every one
re-derived by the suite: L6 and L7 from census plurality, **A6** from the rule engine's
headquarters, population and distance, and D1 at a figure this project defines rather than one
anybody published. Three variants are worth knowing by name before touching anything: **L3**, the
one *transcribed* proposal whose province crosses an existing provincial boundary; **H2**, the
oldest map in the app and the only one carrying **no population figure at all**; and **D1**, whose
thirty-five units are where the 390px bar goes most badly unmet.

**A rule-drawn unit is named for the district it is built around** — A6's headquarters and D1's
most populous district — with one exception, and it is a city rather than a rule about words.
Karachi is published as four districts carrying the city's own name (`Karachi East` and the rest),
so a unit built around one of them is called **Karachi**: a proposed province named *Karachi East*
reads as a claim about the east side of the city. The district it was named for is still on the
card, where the provenance belongs, and where two units would both want the short name each keeps
its district's full one (`scripts/lib/unit-names.ts`). Nothing else is shortened — *South
Waziristan* is a district in its own right and stays.

**A6 replaced the four rule-drawn Administrative maps A1 to A4**, which partitioned the whole
country from a bare population ceiling, a stated unit count and a distance to a capital, and drew
units across provincial boundaries to do it. The restated rule draws **inside the provinces that
already exist** and one rule draws one map. **A5 was retired after them**, for a different reason:
*Constitutional regularisation* promoted Gilgit-Baltistan and Azad Jammu & Kashmir and moved not
one district, which argues about constitutional standing on a basis about administrative size. So
the Administrative basis is **one variant, A6**. All five ids are **retired, never reused**: a link
to `#/administrative/a1` or `#/administrative/a5` resolves to the baseline, because answering a
stranger's link with a *different* proposal at the same address is the one substitution #23
refuses outright.

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
Base map (rendered):   Province └── Division      ← the division tier on request; see the toggle
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
| **Administrative** | 2023 census population + derived geometry — shaded by **district population**, in four fixed bands. Its one rule-drawn variant gates its centres on the development composite, so **A6** carries `synthesized` too | `census` · `derived` |
| **Historical** | Documented past demarcations, 1947 onward | `documented` |
| **Development** | PBS 2023 Census Tables 12, 23, 24 — literacy (10+), improved drinking water, households with a flush toilet — shaded by **the unweighted mean of the three** | `census` · `synthesized` (#31) |

Rules the build enforces, reasoning in **`docs/provenance.md`**:

- Development is the only basis carrying **two badges for one fill**, and the pair is the point:
  the rates are PBS's, the mean of them is ours and nobody publishes it. The composite states its
  formula on the card, in the legend, in the colophon, on the export band and on every tooltip.
- A **vintage** is checked, not assumed — a badge without a date is half a provenance. Three of
  the four bases declare exactly the project's one vintage (D24, ADR-0001); a `census` badge at
  any other date fails the build naming the basis. **Historical is the exception**: it declares a
  *rule* for finding a date rather than a date, so **every Historical variant must date itself**,
  and one that states none resolves to a sentence where a date should be.
- A variant may carry its own `vintage` and is otherwise read at its basis's, with the
  resolution said out loud — so no surface prints the census's year against a boundary the census
  had nothing to do with. It is emitted by the bake **only where the variant states one**, since
  an absent field is the signal to read the basis's.

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

Every source, its reasoning, its anchoring arithmetic and the discrepancies it is pinned
against is in **`docs/data-sources.md`**. Read it before changing anything that touches a
figure or a boundary. In summary:

| What | Source |
|---|---|
| Division / district boundaries | OSM `admin_level=5` / `=6`. **Names are never trusted alone** — relation ids override wherever a name lies or collides, and where OSM and a territory's own government disagree the **official name is displayed and OSM's is the alias** (#46) |
| Coastline | OSM `natural=coastline` — a way network, chained by hand; districts clipped to it. Natural Earth rejected (D26) |
| Line of Control | OSM, **derived — not traced**: the ways shared by a drawn AJK/GB district and India's own `admin_level=4`. 69 ways, one 940 km run, same topology as the polygons |
| Neighbour silhouettes | OSM `admin_level=2` for AF, CN, IN, IR — fetched **whole** and cut here, so the closure is never our judgement. Drawn **as administered, not as claimed** |
| City dots | OSM `admin_centre`. **"Major" is answered administratively** — the seat of a first-level unit, seven dots — because no city population exists at this vintage from this source |
| District areas | PBS 2023 Census **Table 1**, transcribed from the PDFs. **Published, never measured** |
| Population | PBS 2023 Digital Census via `PakPC2023` `.RData`, anchored outside the package at the province and national tiers |
| Mother tongue | PBS 2023 Census **Table 11**, summed from 591 tehsils, reconciled column by column |
| Development | PBS 2023 Census **Tables 12, 23, 24**, reconciled on **counts, not rates**. The shaded third is **flush toilets, named as such** — PBS publishes no improved-*sanitation* column |

### Vintage rule

**Everything pins to the 2023 census** — geometry as well as statistics (D24, ADR-0001).
Administrative units created after the census fold into their parent, because a unit with no
census row cannot carry a population; post-census districts are dissolved back into their 2023
parents rather than rendered. Verified safe — every post-census unit folds into exactly one
parent, so the dissolve recovers the original boundary exactly.

Consequence: the Balochistan restructuring of **8 July 2026** is **noted in copy, not drawn**.
The baseline is stale *on purpose*, and the app says so.

Three district counts coexist and all three belong in the bundle, because any one alone makes
the others read as a bug: **136** census districts (the statistical atom), **156** drawn (plus
AJK's 10 and GB's 10, which have boundaries but no census indicators — D25), and ~170 current-day
relations OSM returns, never drawn. Detail in `docs/data-sources.md`; research in `docs/research/`.

### Pipeline

Build-time bake, **artifacts committed** — not gitignored, and split by failure mode so
network flakiness never contaminates geometry work. Every script, what it does and why —
and the fold table, the vintage stamps and the derivation rules — is in
**`scripts/CLAUDE.md`**, which loads whenever this session works under `scripts/`.

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
`src/map.ts` and `src/panel.ts` are imperative D3 against the DOM and carry no tests; the repo has no
jsdom, deliberately. Where a rendering criterion is worth holding, it is held over the real
bundle through the real projection instead — which is why the label tests name the divisions
that go unlabelled at default zoom rather than counting them.

What the suite holds, property by property and naming the file each is asserted in, is in
**`docs/test-seam.md`** — around a hundred rows, one per property. Read it before changing
a test or adding one; each row names its own file.

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

How the map, the card, the selectors, the labels, the tooltip, the export and the phone
adaptation actually behave — and why each was decided that way — is in **`src/CLAUDE.md`**,
which loads whenever this session works under `src/`. The politically sensitive rendering
rules below are **not** there: they stay here, because they must be loaded whatever is
being edited.

---

## Politically sensitive rendering

These are the rules. The reasoning behind each — and, where it applies, what was got wrong
first — is in **`docs/political-rendering.md`**. Read it before changing any of them.

- **AJK and Gilgit-Baltistan** drawn and named, styled as **territories, not provinces** —
  constitutionally they are not. The distinction is carried by **texture, not by weight**: a
  hatched ground, and the *same* rule at the *same* weight as a province. A fainter or thinner
  outline says the wrong thing about ground Pakistan administers. **Not fully interactive:** PBS's
  2023 results cover 136 districts, so no AJK or GB district has a mother tongue, literacy, water,
  sanitation or development figure. They cannot be shaded under any basis and carry no hover
  statistics beyond a name; hovering says *the census does not cover them*, so the absence reads
  as coverage and not as a zero or a failed load. AJK population exists only relayed via AJK BoS,
  never direct from PBS.
- **Line of Control drawn dashed and labelled** — a ceasefire line, not an international border.
  Solid would be a claim this app's data can't support. It is a stratum of its own and the
  **only** thing drawn along its stretch: the province and territory outlines are drawn by arc
  with those arcs held out, because a solid line beneath a dash fills the gaps in and leaves a
  line that looks solid and means the opposite. Width and dash are in screen px at every zoom.
  Its name is set on the side with no drawn land and **yields to** the tier names rather than
  displacing them, conceding **length and nothing else**: the full name on clear paper, then
  **`LoC`** on clear paper, then no name at all — never over land, and "clear paper" means paper
  on *both* sides, silhouettes included. The dash is keyed in the legend under **every** basis,
  which is the only thing that makes an unnamed line affordable.
- **The Working Boundary is not the Line of Control.** Punjab's Sialkot–Jammu stretch is a
  different line, south of the ceasefire line's terminus on the Chenab; it is not drawn dashed,
  and the colophon says so. Falls out of the derivation rule rather than being special-cased.
- **"GB as 5th province" is content, not baseline, and the app currently carries no such
  content.** It was **A5** (#28) — a live proposal, provisional status announced 1 November 2020
  with a GBLA resolution behind it — which promoted Gilgit-Baltistan *and* Azad Kashmir and said
  plainly that the second claim was the weaker of the two. A5 has been **retired**, so the
  proposal is not on the map at all; what has not changed is that it could never be the *baseline*,
  and that the baseline draws both as territories. The rendering rule it proved stands untouched
  and is still held over every variant: the ceasefire line's arcs are held out of every unit
  outline whatever the unit is called or classed, so a variant arguing for provincial status
  cannot put a solid international border along a line this app draws dashed.
- **Durand Line — a normal boundary with a footnote, and the footnote is the whole treatment.**
  Nothing in the renderer knows the Pakistan–Afghanistan stretch from any other part of the
  outline: same solid rule, same province weight, no dash. **The dash means *ceasefire line***
  and there is exactly one of those on this map. So the dispute is carried in words — the 1893
  agreement, the Loya Jirga of 1949 declaring it void, and that no Afghan administration since has
  accepted it as an international border — and the note ships **with Afghanistan's silhouette**,
  so it cannot be lost while the line is still on screen.
- **Faint, unlabelled neighbour silhouettes for context** (#8) — fill and *nothing else*, no
  stroke of any kind. Held subordinate **structurally** and not only by styling: a separate bundle
  sharing no arc with the country's, drawn beneath the land, and never asked a question. Two costs
  accepted out loud: the four are told apart only in the artifact and the colophon, and only the
  four borders Pakistan has are drawn.
- **PNG export bakes in** scenario name, legend, provenance badge, data vintage, source, and
  "proposed — not official" (#32). This content will travel as WhatsApp and X screenshots
  regardless; the sanctioned export exists so circulating copies carry their own disclaimer. A 2×
  raster of the current view with a footer band under it, produced **entirely on the machine** —
  no server ever sees a reader's composition of a politically live picture (D19). Five rules hold
  the band honest, each argued in `docs/political-rendering.md`:
  - **The standing line is not conditional prose.** Every band carries one and it says which of
    the two maps this is — a proposal says *Proposed — not official*, the baseline says it is the
    official geography. Set in the accent **only when something is proposed**.
  - **An inherited vintage says whose it is**, and a basis with no date to lend says that instead
    rather than quoting its own deferral onto the image.
  - **The key is derived, never transcribed**, from the same legends the screen is built from —
    and it **refuses by name** to key a basis it has no fill for.
  - **The badges are glossed in the image**, because a PNG has no hover and a provenance word a
    reader cannot check is a claim.
  - **The small print names no figure source the variant does not use** (#49). Every band credits
    the boundaries to OSM under ODbL and the district set to the 2023 census; a variant that
    withholds says it carries **no census figures** rather than crediting figures it does not
    print. Which form it takes is asked of **`figuresWithheld`** (#48), so the image, the card and
    the tooltip cannot answer the withholding question three ways.

  **The band describes the picture, never the selection.** While compare is held the map has been
  given the baseline whole (#22), so a band built from the selection would caption the real
  provinces with a proposal's name and stamp them *not official* — the single most damaging image
  this app could emit. The export asks what the *map* is showing. The crop is the union of the
  drawn land **and every name and dot over it**, so the ceasefire line's name is not sliced off;
  and the export **photographs a settled map, never a cross-fade**, via `map.photograph`.
  Words and arithmetic are `src/lib/export-band.ts`'s, under test; `src/export-image.ts` composes
  no sentence of its own.
- **Naming:** units named as *their own advocates* name them, alternatives shown in the card
  ("South Punjab (also: Saraikistan, Saraiki Wasaib)"). The app reports what people call
  things; it doesn't adjudicate.
- **Every scenario card carries an "Opposed by" line.** Without it the app reads as advocating
  whatever is on screen.

---

## Stack

- **Vanilla TypeScript + Vite + D3.** No framework — runtime state is six values (active
  basis, active variant, hovered district, compare-held, whether the division tier is drawn, and on
  a phone the sheet's detent); no async, no forms. Routing is the URL hash and nothing else (#23):
  one parser, one `hashchange` listener, no router.

  Two near-misses, counted deliberately. The sheet's detent (#33) **is** one of the six, but it is
  kept out of the URL and out of `main.ts`: how far a reader has pulled the card open is a property
  of the device in their hand, not of the view being argued, and a shared link that restored it
  would move a stranger's sheet. The export button's busy state (#32) is **not** one at all — it
  belongs to the control, which disables itself for the length of one encode, and the app is never
  told: a download in flight changes nothing about what the map shows.
- **Inline SVG, custom projection, no basemap.** Showing only Pakistan deletes the reason to
  use a mapping library. D3 owns the SVG *and* renders the panel lists.
- Pan/zoom via `d3-zoom`. Sparse major-city dots instead of a basemap — seven of them, and
  "major" means *seat of a first-level unit*, because no city population exists at this vintage
  from this source (#8). The dot is drawn whatever happens; it is the **name** that yields when
  the frame is crowded, the same order the ceasefire line's name follows.
- Deep-link URLs (`#/language/l2`).
- **Visual direction: editorial atlas, light.** Warm off-white canvas, muted desaturated
  categorical fills, hairline strokes, serif headings, one accent reserved for unit outlines.
  **The one bold line is the current provincial boundary**, in the map's own neutral grey
  (`--rule-boundary`); the proposal is the thinner line and the different colour. Weight says
  *this is the standing boundary*; hue says *and it is not part of the proposal drawn over it*.
  The ceasefire line is kept a step above the boundary whatever the boundary weighs. No dark mode
  in v1.
- Palette validated via the `dataviz` skill for colourblind safety, and the validation lives in
  the suite (`src/lib/colour-vision.ts` + `palette.test.ts`), re-derived from the hexes on every
  run. Fifteen categories is past what any categorical palette separates pairwise, so **the gate
  is held on the pairs that actually share a border on the map**.
- **Two sequential scales, and neither borrows the other's hexes.** The Development ramp (#31)
  runs green-to-blue and the Administrative one — district population — runs violet-to-coral; both
  are monotonic in lightness and chroma, both four bands and not five. One basis is drawn at a time
  (D9) so they never share a map, but they share a *page*, so the suite holds **every band of one
  past the categorical floor from every band of the other** — a stronger separation than either
  reaches internally, deliberately. **No two adjacent bands of either reach the ΔE the categorical
  palette is held to** — stated in `palette.ts` and asserted in the suite rather than smoothed over.
  Both ends of the population ramp sit *at* their gate: the pale end is bounded by the warm paper
  and the dark end by the accent, which is where its fourth band's worth of room ran out.
- **Responsive, and the phone is not the degraded case** (#33). Hard bar: **map legible and
  variant switching functional at 390px** — Pakistan's internet is overwhelmingly mobile-first.
  Eleven of the thirteen variants meet it outright; **D1 and A6** do not. D1 leaves six of its
  thirty-five unit names unset at that size and A6 leaves one — *Islamabad*, a unit of a single
  district — each listed by name in the suite. The breakpoint is stated
  **once, in the stylesheet** (`--sheet`) and read from there by `sheet.ts`.

The reasoning behind the last four — the boundary hierarchy, the palette gates, the two ramps'
lightness budget and the phone bar — is in **`docs/visual-design.md`**.

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
| D12 | LoC dashed, AJK/GB as territories | Consistency with the app's own provenance discipline. The line is **derived, never traced** (#7): a hand-drawn polyline would be the one boundary in the bundle with no source behind it |
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

The full record — resolved items included, each with the history behind it — is in
**`docs/open-items.md`**. What is live:

- **2b. Can a variant claim AJK or GB territory?** Product decision **outstanding**. The build's
  provisional answer is **no**: `TERRITORY_CLAIM_POLICY` is `forbid`, so the first variant that
  needs it fails loudly naming the district instead of settling a constitutional question by
  accident. Both answers are expressible and both are tested. **Two narrowings have been made and
  neither is an answer to it** — both observe that the stated reason for `forbid` is arithmetic
  and does not reach a particular shape. `promotedTerritoryOf` admits **one territory's whole
  district set under its own name** (#28 — three load-bearing conditions: exactly one, whole, own
  name). It was written for A5 and **no shipped variant exercises it** now that A5 is retired,
  which the suite asserts rather than leaves unsaid: it stays because deleting it would answer 2b
  by tidying, and a promotion arriving later must arrive in a diff somebody read. `withoutModernFigures` admits **any** territory claim on a variant that publishes no
  population figure anywhere (H2, #30), which is the wider of the two. What still asks 2b is a
  hypothetical: a unit that carries population figures *and* reaches into ground the census does
  not cover. Nothing in the app does that, and the build would refuse it by name.
- **3. Deployment target** — deliberately undecided. Static bundle, builds to `dist/`.
- **6. The method note is short in three places, all of them content** (#52). The on-paper summary of how
  the map was built covers three bases: **Historical has none**, asserted as an absence rather than
  left to be noticed. **Language's shared paragraph states census plurality, which is how L6 and L7
  were derived and not how L1–L5 were got** — those five are transcribed, each says so in its own
  paragraph, and the shared sentence above them wants rewording to the ground they are *argued on*;
  the same question is smaller but live on Development. And it is **not drawn at 390px**, where —
  unlike the two keys, whose rows the legend repeats — nothing else carries the prose.
- **5. `GB` as Gilgit-Baltistan's short form is unconfirmed.** Every other entry in `SHORT_FORMS`
  names a publishing agency; this one rests on general usage by the territory's own government and
  assembly, and wants a published document recorded in `docs/research/`. Not a legibility gap —
  all four names in question are set at the 390px bar — a **provenance** one. D1's six unnamed
  units at that bar are *not* this item: a rule-drawn unit has no advocates to have a short form.

Resolved and kept for reference: **1** (AJK district set and the #46 name inversion), **2**
(Balochistan's set), **4** (`SCENARIOS-DRAFT.md` deleted, audited afterwards in
`docs/research/scenario-migration.md`).

**Scenario content: 17 variants approved, 13 built** — Language 7, Administrative 1, Historical 4,
Development 1. The four the count is short by are A2, A3 and A4, retired with A1 when the
Administrative rule was restated to draw inside the existing provinces, and **A5**, retired after
them because it proposed no boundary at all; the suite holds the approved set against the built one
with both retirements named, so nothing can go missing quietly. Nothing is outstanding. H2 omits Amb and Phulra (sub-district, cannot be drawn
without inventing a boundary) and names both on the card. Karachi and Pashtun Balochistan are
attributed variants, not algorithmic by-products.

---

## Working agreement

- Scenario content is reviewed **as content, before code, and in a diffable form**. The variants
  are the product; the machinery is not, and a political judgment gets reviewed in a diff rather
  than through the distraction of a running UI. The diffable form was `SCENARIOS-DRAFT.md` and is
  now `scripts/lib/variants.ts` (#36) — which is prose and district lists with a type around it,
  reads in a pull request exactly as the markdown did, and unlike the markdown cannot fall out of
  step with what the cards say, because it *is* what the cards say. A variant is still written and
  reviewed before anything renders it.
- No unsourced surface anywhere. Every fill, every number, every boundary traces to a published
  figure or a published boundary, and carries a badge saying which — and a **vintage**, because a
  badge without a date is half a provenance. The claim is no longer only ours to check: the
  **About the data** panel (#21) puts every source, every vintage and every build date on one
  surface, discrepancies included, and the build refuses a basis or a variant that is short of any
  of the three.

---

## Where the rest of the documentation is

| File | Loads | Carries |
|---|---|---|
| `src/CLAUDE.md` | working under `src/` | Every runtime rule — map, selectors, strata, tooltip, compare, labels, phone, card |
| `scripts/CLAUDE.md` | working under `scripts/` | Every script, the fold table, the partition rules, the dissolve and the adjacency graph |
| `docs/data-sources.md` | on demand | The full source table, anchoring arithmetic, pinned discrepancies |
| `docs/provenance.md` | on demand | Badges, vintages, and how a variant's date is resolved |
| `docs/political-rendering.md` | on demand | The reasoning behind every rule in the section above |
| `docs/visual-design.md` | on demand | Boundary hierarchy, palette gates, the Development ramp, the phone bar |
| `docs/open-items.md` | on demand | All open items, resolved ones included, with their history |
| `docs/label-layout.md` | on demand | The whole labelling doctrine and the per-variant 390px record |
| `docs/map-furniture.md` | on demand | Unit key, fill key, method note, division toggle, the page's regions |
| `docs/phone-and-touch.md` | on demand | Sheet detents, the tap gesture, the docked tooltip |
| `docs/accessibility.md` | on demand | Keyboard, focus, the regions list, the district walk |
| `docs/panel-surfaces.md` | on demand | Card, scorecard and About panel, in full |
| `docs/derived-variants.md` | on demand | The seven rule-drawn variants, plus H2's withholding |
| `docs/scorecard.md` | on demand | The scorecard's arithmetic, its absences and the area substitution |
| `docs/test-seam.md` | on demand | ~100 rows, one per property the suite holds, each naming its file |
| `docs/adr/`, `docs/research/` | on demand | Decision records; the district-set, census-table and migration research |

---

## Agent skills

### Issue tracker

Issues live as GitHub issues in [AbuBakrCh/pakistan-map](https://github.com/AbuBakrCh/pakistan-map), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
