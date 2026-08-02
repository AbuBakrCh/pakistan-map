# pakistan-map

Interactive single-page explorer for proposals to redraw Pakistan's provinces.

**Status:** design agreed, scenario content in draft (6 of 17 variants migrated into the typed
module — L1, L4 and L5 on the Language basis, H1, H3 and H4 on the Historical one), pipeline and
bundle built, the map built through its **three strata with the basis
and variant selectors** (#18) over its **neighbour silhouettes and city dots** (#8), the
**variant card** rendering beside it (#19), the **adjacency graph** flagging each unit's
contiguity (#16), the **scorecard** (#20) carrying the figures a proposal is judged on, the
**compare gesture** holding a proposal off the map (#22), every view carrying a **deep link**
of its own (#23), the **About the data** panel (#21) putting every source, its vintage and the
bundle's own build dates on one auditable surface, and the **phone adaptation** (#33) turning the
card into a draggable bottom sheet and hover into tap.

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

A basis carries a **vintage** as well as a badge and a source (#21), and the field is checked
rather than assumed: a badge says which *kind* of claim a shading is and the vintage says which
census, and either alone is half a provenance. Three of the four declare exactly the project's one
vintage (D24, ADR-0001) and a `census` badge at any other date fails the build naming the basis;
Historical is the exception the rule allows for, since its demarcations are dated one by one, so it
declares that and each variant carries its own document's date. A variant may carry a `vintage` of
its own for the same reason — H2 draws 1947 — and where it does not, it is read at its basis's and
the resolution says so, so that no surface prints the census's year against a boundary the census
had nothing to do with.

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
| District boundaries | OSM `admin_level=6` | Fetch returns ~170 current-day; dissolved to the 136-district 2023 census set (ADR-0001). **Not** geoBoundaries — its PD set is 2019/126 districts, ~40 short. **Names are never trusted alone.** Matching is normalized-name-plus-alias, with relation ids overriding it wherever a name lies or collides — Karachi's four renamed districts, and every AJK district, whose names recur across the Line of Control. Anything unmatched fails the build. PBS's own documents disagree with each other on spelling, and OSM's primary `name` on AJK districts is Urdu. Only the English name is carried into the bundle and only the English name is displayed — OSM's `name:ur` is deliberately not surfaced |
| Coastline | OSM `natural=coastline` | A way network, not a relation: chained on shared node ids with direction preserved (**land lies to the LEFT**), the open coast closed against a lon/lat extent, islands added as land. District polygons are clipped to it where their bounding box meets the shoreline's — one rectangle over the whole coast, so it nominates ~23 of the 156 districts including a dozen plainly landlocked ones, which clip to a no-op. Biased that way deliberately: a false positive costs nothing, a false negative would leave sea drawn as land. Natural Earth was rejected — a second lineage at a different vintage, against ADR-0001; OSM keeps one of each |
| Line of Control | OSM, derived — not traced | A *segment* of the boundary we already draw, named by identity rather than by geometry: a way that belongs both to a drawn AJK/GB district relation and to India's own `admin_level=4` Jammu and Kashmir or Ladakh (strays the bbox fetch already caches) is on the line. 69 such ways, chaining into one 940 km run, emitted into the **same topology as the polygons** so line and boundary share arcs. Two exclusions fall out of the rule rather than being applied on top of it: Sialkot's and Narowal's shared ways are the **Working Boundary**, not the ceasefire line, and are excluded because Punjab is a province; GB's Karakoram frontier is shared with nobody in the cache. Its northern end, beyond NJ9842 in the Siachen area, was never delimited even as a ceasefire line — stated in copy, not smoothed over |
| Neighbour silhouettes | OSM `admin_level=2`, `ISO3166-1` in {AF, CN, IN, IR} | The four countries Pakistan borders, drawn faint and unlabelled so the outline — and the dashed ceasefire line above all — has ground on the far side of it rather than blank paper, which reads as a coast. Fetched **whole** and cut here, the opposite way round from the coastline and for the reason D12 gives: a country's silhouette is a closed polygon, and asking Overpass only for the ways near Pakistan returns an open run of boundary whose closure means choosing which side of it is the country — a decision with no source behind it. So the polygon comes from OSM closed and is intersected with a rectangle, and the rectangle is the only judgement. OSM draws these four **as administered, not as claimed**: India stops at the same Line of Control this app draws dashed, China covers Aksai Chin, and neither reaches over AJK or GB — checked against all 156 drawn districts rather than assumed, because a neighbour drawn over ground the map calls Pakistan-administered would be a claim made by accident |
| City dots | OSM `admin_centre`, per first-level relation | **"Major" is answered administratively because it cannot be answered demographically.** PBS publishes the 2023 census by district and a city is not a district — Karachi is seven of them and Islamabad *is* one — so no city population exists at this vintage from this source, and the governing rule is that data we do not have is not used. Ranking by OSM's own `population` tags would put a second lineage at an unstated vintage under a dot. The criterion is therefore **the seat of a first-level unit**: four provincial capitals, the federal capital, and each territory's capital. Seven dots, badged `official`; the position is the node the unit's *own* boundary relation names as its `admin_centre`, so a dot joins a unit by identity and not by a matching name. The cost is stated rather than hidden — Faisalabad, Rawalpindi, Gujranwala and Multan are larger than three of the seven and are not drawn, because a set mixing "capital" with "large" would be two criteria wearing one badge |
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
| `scripts/fetch-osm.ts` | `build:data:fetch` | Network only. Admin levels 4, 5, 6, the coastline, the four neighbour countries and the first-level `admin_centre` nodes → `data/raw/`, retrying across four Overpass mirrors. Level 4 sources ICT and, now, each unit's seat |
| `scripts/normalize-geometry.ts` | `build:data:normalize` | Filters strays → folds post-census units into their 2023 parent → injects ICT → stitches rings → clips coastal districts to the coastline → derives the Line of Control from ways shared with India's own relations → merges all three tiers **and the line** from one shared arc set → simplifies → `data/bundle/geography.topojson.json` |
| `scripts/build-scenarios.ts` | `build:data:scenarios` | Validates every variant in `scripts/lib/variants.ts` as a **complete partition** and bakes it to `data/bundle/scenarios.json`. Fails on a claimed district that is not a district, a district two units both claim, or a district no unit claims — naming the district and, for an overlap, both units. Resolves each claim onto the 2023 set through the same fold table the geometry uses, so the artifact carries the claim *and* the drawing: South Punjab is stated as 13 districts and drawn as 11. Then **dissolves each unit** out of its districts' arcs → `data/bundle/unit-outlines.json`, and derives the **district adjacency graph** from that same arc set → `data/bundle/adjacency.json`, which is what every unit's contiguity flag is read off. Also sums each unit's population out of `statistics.json` and bakes the **scorecard** (#20) onto every variant. Refuses, besides, a basis or a variant short of a badge, a source or a vintage; a badge outside the closed vocabulary; a `census` badge at a vintage that is not the project's; and a boundary this build derived that does not say so — each naming the basis or variant and the word (#21) |
| `scripts/build-context.ts` | `build:data:context` | Stitches each neighbour relation into closed polygons with the districts' own stitcher → intersects them with `CONTEXT_EXTENT` → pairs each first-level unit with its `admin_centre` node → simplifies to 4% and quantizes → `data/bundle/context.topojson.json`. Fails on a country whose ISO code is not in the cache, a ring that will not stitch shut, a silhouette that clips to nothing, a shape that does not contain its own capital, or a unit with no seat — each named. **A separate artifact from the geography bundle, deliberately:** nothing here shares an edge with anything in there, and merging them would renumber every arc in the country to add a background and imply the two sides of a border are one line. Quantization comes *after* simplification, the opposite order from the geometry build, because `presimplify` restores absolute coordinates for arcs and not for **points** — quantized first, every city dot lands in the Bay of Bengal |
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

**Scenario content is data, and it is baked like the rest.** The typed schema lives in
`scripts/lib/scenarios.ts` and the variants themselves in `scripts/lib/variants.ts` — the source
of truth that retires `SCENARIOS-DRAFT.md` (#36). The module is the reviewable form; the
committed `data/bundle/scenarios.json` is the *resolved* form, and the difference is the point:
it carries the claim as its advocates state it next to the 2023 districts the map draws it as,
with every fold recorded. A change to a proposal's territory is therefore a dated diff rather
than something that happens between two page loads, and the runtime reads one bundle directory
rather than reaching into `scripts/`.

Two things a partition has to state out loud, because both have two defensible answers:

| Question | How it is expressed | Current answer |
|---|---|---|
| **Which district set must a partition cover?** | `universe` on the variant — `drawn` (all 156, nothing left uncoloured) or `census` (the 136 with statistics; AJK and GB outside the partition, drawn and named and in no unit) | Per variant; all six written so far declare `drawn` |
| **May a variant claim AJK or GB territory?** (open item 2b) | `TERRITORY_CLAIM_POLICY` in `scenarios.ts`, both settings tested | **`forbid`** — a `proposed` unit taking a territory district fails the build, naming it. Those districts carry no PBS statistic, so the unit's population would be short by an unknowable amount. A product decision, not a technical one: settling it is a one-line change |

**A unit is drawn by dissolving its districts, and the dissolve is baked** (#15). An outline is
the merge of its districts' *arcs*, never a union of their polygons: the geography bundle draws
all three tiers out of one shared arc set, so an arc two of a unit's districts share is internal
and is dropped, and an arc only one of them uses is on the outside edge and is kept. Nothing is
recomputed and no vertex moves, which is what leaves no sliver and no seam where a district border
used to be — a geometric union would rebuild every boundary to whatever precision the clipper
happened to work to. `data/bundle/unit-outlines.json` carries the result and **no arcs of its
own**: it is arc indices into `geography.topojson.json`, so an outline and the boundary beneath it
cannot come apart, and it records the geometry build's own timestamp so a stale one fails the
suite rather than silently pointing at whatever edges now hold those positions. Every outline is
checked against the union of its districts before it is written — the same arcs, the same area to
floating point, every ring closed — and a disagreement fails the build naming the unit. A unit
whose districts do not touch draws as one piece per group without complaint (D7). Islands make
pieces of their own, so the recorded `polygons` is a drawing fact and **not** a contiguity
measure: South Punjab draws as three pieces because Rahim Yar Khan is three in OSM, two of them
under 200 km². Contiguity is a different question, asked of the adjacency graph.

**Adjacency is derived from shared arcs, and contiguity is read off it** (#16). Two districts are
neighbours *iff* they share an arc — the same one arc, seen once from each side, with `~i` and `i`
recognised as the one border they are. Asking the question of integers rather than of coordinates
is what makes the answer exact: a polygon-intersection test would answer to whatever tolerance a
clipper worked to, and two districts left a millimetre apart by simplification would come out
strangers, reporting a real proposal as broken because of a rounding. The coastline clip does not
disturb it, and that is checked rather than hoped: the clip replaced only the *seaward* part of a
coastal ring, so the inland arcs a district's neighbours use came through untouched — all 156 drawn
districts form **one connected component**, 401 shared borders, not one isolated, Gwadar included
after losing half its area to the clip. `data/bundle/adjacency.json` carries the graph and, like
the outlines, records the geometry build's own timestamp: it is district *names*, so a stale copy
is undetectable from its own contents — every name would still resolve, against a topology whose
borders had moved. Each unit then carries a `contiguity` block — `contiguous`, `pieces`, and
`detached`, which names every group *but the largest*, since the stranded districts are what a
reader wants said and the body of the unit is already listed. A non-contiguous unit is **flagged
and drawn** (D7); there is no error path, because refusing to draw a claim is a stronger editorial
act than drawing it with a note. Every variant also carries `counts.nonContiguousUnits`, over
**every** unit and not only the proposed ones — a variant that leaves a current province in two
pieces has done that to a real province, and filing it under "unchanged" would be the app choosing
what counts as its own doing. That count *is* the scorecard's contiguity line (#20), read off there
rather than derived a second time.

The graph is a fact about the geometry and is nonetheless built by the *scenario* script, because
its only consumer is the flag written in the same run and because building it in
`normalize-geometry.ts` would mean rewriting a 2.2 MB boundary artifact whose boundaries had not
changed — the whole value of committing that file is that a diff in it means a border moved.

**The scorecard is arithmetic, and it is baked with the rest** (#20). Every variant carries unit
count, population spread, largest:smallest ratio and districts moved, computed at build time in
`scripts/lib/scorecard.ts` and written into `scenarios.json` — a figure the runtime derived would be
a figure nobody reviewed. A unit's population is **the sum of its districts' census rows and nothing
else**: the census publishes by district, every unit is composed of districts, and nothing between
the two is interpolated. The fifth line, contiguity, is *not* computed there — #16 already answered
it off the adjacency graph and wrote it onto the units, and a second derivation would be a second
answer to one fact.

Two absences the scorecard has to keep apart, because printing a zero for either would be a claim
about Pakistan this app cannot make. A unit **wholly** outside the census — AJK and GB, whose twenty
districts PBS published nothing for (D25) — is not a gap in the data but the census's own coverage,
so it is set aside from the spread **by name** and the total says how many units it is over. A unit
**partly** outside it is a hole, and it voids the variant's population figures altogether, naming the
unit and the districts: a largest compared against a smallest that is missing people is worse than no
comparison. A variant may also withhold modern figures itself (H2 draws 1947's map), in its own
words. The scorecard carries a spread or a reason for having none, never both and never neither.

**"Districts moved" is measured against the district's current province**, keyed on the 2023 district
the map draws rather than the one a claim names — South Punjab moves 11, not the 13 it states. A
district has moved iff the unit holding it is not the one carrying its province forward, and
*carrying forward* is decided on the unit's **name**: the unit called Punjab is Punjab whatever it has
lost, and South Punjab is not, however much of Punjab it is made of. Both structural alternatives say
something false — counting every `proposed` unit's districts calls Gilgit-Baltistan's ten "moved" in a
variant that only changes its standing, and requiring a unit to be exactly its province calls the
twenty-five districts still in Punjab "moved" when it is the province that shrank. The cost is stated
rather than hidden: a variant that renamed a province it otherwise left alone would read as moving all
of it, which is a thing to catch in the content review the variants already get.

**The Administrative basis draws its own boundaries, and the rule is what keeps them from being ours**
(#27). No one publishes a district list for "no province above 25 million people", so
`scripts/lib/partitioner.ts` computes one: units grow outward from a capital across the **shared
district borders** of #16's graph — contiguous by construction, never by filtering — the unit with
the fewest people taking the next district each time, ties broken on the district and capital names
so nothing about the caller's ordering can move a boundary. Three rules, each of which determines a
partition on its own: a stated **unit count**, a **population ceiling** in the fewest units that
honour it, and a **distance to the capital** in the fewest units that honour that. For the last two
the unit count is a *finding*, and the statement the card prints says so. Capitals are the one choice
the engine makes, so it is made out loud and differently for the two questions — the most populous
districts, no two of them sharing a border, for the population rules; as far as possible from the
capitals already chosen for the distance rule, because seating every capital in Punjab would answer a
question about Balochistan with a fact about Lahore. **A district the census does not reach is refused
by name**, never counted as zero: a zero would let a unit take AJK's or GB's twenty districts of
ground for free under a ceiling it never came near (D25), so the engine partitions the 136 and the
variant carries the territories through as themselves. The engine is build-time only, and generates
nothing on its own — the variants it draws are #28's.

Still to come: the composite development index (#31, badged `synthesized` — the census publishes no
such figure). Shared pure logic lives in `scripts/lib/` with tests beside it.

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
`src/map.ts` and `src/panel.ts` are imperative D3 against the DOM and carry no tests; the repo has no
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
| Partition integrity — every variant covering the district set it declares exactly once, every unit's districts drawn by the geography bundle, no district in two units, no fold landing off the map, no unit both claiming and excluding a district | `bundle.test.ts` |
| Variant cards — every rendered field present on every variant, badges from the closed provenance vocabulary, an **Opposed by** line without exception, an unadvocated variant saying so rather than carrying an empty list, unique deep-link ids; both district counts wherever a claim and the drawing disagree, each with a `district-count` footnote saying why — South Punjab's 13-for-11 and Hazara's 9-for-8, with Allai named as the fold; and every card cross-reference pointing at a variant that exists, the L1↔H4 collision wired **both** ways so neither proposal reads as the uncontested one | `bundle.test.ts` |
| Unit outlines — every unit exactly the union of the districts it claims: its arcs are the ones its districts do not share, its area theirs to floating point, every ring closed; the outlines cut against the geometry that ships beside them rather than some other build; a unit of two districts that touch nowhere drawing as several pieces without error | `bundle.test.ts` |
| What a *wrong* dissolve looks like — an internal border left in, an outline that is not the union of its members, a ring that does not close — each named, on a topology of three squares | `unit-outlines.test.ts` |
| Adjacency — the shipped graph re-derived from the committed arcs and compared district by district, naming the ones whose neighbours moved; symmetric, nobody their own neighbour, no arc shared by three districts; borders checkable on any atlas rather than only against our own derivation (Islamabad's two, Chaman's one — every other side of it is Afghanistan, so a second would mean the graph had started joining across the Durand Line); no district cut loose by the coastline clip, and 156 districts in **one** component | `bundle.test.ts` |
| Contiguity flags — recomputed from the shipped graph and compared unit by unit rather than read back, `detached` empty exactly where the unit is whole, and the two numbers held apart on the unit where they visibly disagree: South Punjab is **one piece and three polygons**. A non-contiguous unit flagged over the real map — Lower Chitral and Karachi South — with nothing that can refuse it | `bundle.test.ts` |
| What a *non-contiguous* unit looks like — the one thing the shipped set cannot demonstrate, since every one of its 43 units hangs together: the stranded district named, the walk confined to the unit's own districts (unconfined, every unit on a one-component map reads contiguous and the flag becomes decoration), an asymmetric graph and an uncut three-way arc each named, on the same three squares | `adjacency.test.ts` |
| What the validator does when a partition is *wrong* — the one thing a valid bundle cannot demonstrate: the district named, both units named on an overlap, both answers to open item 2b expressible | `scenarios.test.ts` |
| Anchors inside the shape they name, a projection fitted to Pakistan, no two names overlapping, both territories named | `src/lib/*.test.ts` |
| The dashed line is the **right stretch** — every arc of it belongs to AJK or GB and to no province, it is the whole of AJK's outer boundary, and it is only part of GB's, the remaining 3 arcs being the China and Afghanistan frontier. Endpoints named (Chenab, Karakoram), districts named, length agreeing with the provenance that states it. A set question on arc indices, exact, because line and boundary share arcs | `src/lib/line-of-control.test.ts` |
| Palette — every census category coloured, colourblind separation re-derived from the hexes on the category pairs that actually share a border, the pairs it cannot separate named in the module | `src/lib/palette.test.ts` |
| Fill = data — every drawn district decided, each category fill agreeing with the census figure, Chitral and the twenty AJK/GB districts as two different absences | `src/lib/mother-tongue.test.ts` |
| Hover resolution — all 156 drawn districts reachable from inside themselves, nine cities standing in the district they actually stand in, the sea and the ground across the border resolving to nothing, the neighbour silhouettes answering nothing from anywhere on them, every city dot standing in the unit it is the seat of, and the shortlist a point costs bounded, which is the whole reason hover is not slow | `src/lib/hit-test.test.ts` |
| The context (#8) — four countries drawn and named, each containing its own ground so the name on a faint blob is a claim rather than a caption; **no silhouette over any of the 156 drawn districts**, and none over another; seven dots, one seat per first-level unit, each standing on the unit it names; the criterion, why it is administrative and which larger cities it omits | `src/lib/context.test.ts` |
| The Durand footnote — carried with Afghanistan's silhouette rather than typed into the renderer, naming 1893, saying no Afghan government has recognised it, and saying it is drawn *not dashed* because the dash belongs to the Line of Control. The only boundary note, because it is the only *ordinary* boundary in dispute. **Sourced and badged like any other surface**: every year the prose asserts as fact is a year its source line accounts for, checked by extracting both rather than by reading the sentence back at itself | `src/lib/context.test.ts` |
| The silhouette cut — a country inside the extent passed through untouched, one running off the edge cut rather than dropped, a ring that will not close reported; and the extent both wider than the widest frame at zoom 1 and inside 30° of the cone the map is projected on | `scripts/lib/neighbours.test.ts` |
| What the seat resolver does when the cache is wrong — the unit named rather than six dots drawn quietly, a `label` node refused where an `admin_centre` is wanted, and the area query's strays ignored without being reported. A seat the cache **lacks** and a seat it holds under an Urdu **name** are reported apart, with the node id on the second: one is a query to change and the other an alias to add, and one message for both sends a maintainer to the wrong file | `scripts/lib/seats.test.ts` |
| The simplification threshold — the fraction is of *points* and counted across every arc, the weights sorted however they arrive, both ends of the range meaning what they say, and unweighted ring endpoints ignored rather than counted as zero. Shared by both geometry builds instead of copied into each, which is what makes it reachable from here at all | `scripts/lib/simplify.test.ts` |
| City names — all seven seats named at default zoom, set off their own dots rather than on them, ranked under the provinces and over the divisions, and a division named after its own seat **qualified** (`Lahore Division` beside `Lahore`) rather than dropped — the other 31 left unqualified, the dot winning the frame too tight for both, and both names plus Mardan returning at 3× | `src/lib/labels.test.ts` |
| Which divisions go unnamed at **default zoom** — named, not counted: **Poonch and Mardan**. Mardan is the stated price of qualifying the six rather than dropping them, since restoring `Peshawar Division` crowds northern KP; a change to this pair is a change to the opening view of the country and belongs in a diff | `src/lib/labels.test.ts` |
| Tooltip — the three outcomes kept apart in words as they are in fill: a figure with its share and its table, Chitral's unnamed dominance quoted against **its own** residual, and the twenty AJK/GB districts saying the census does not cover them with no figures at all. Never a zero, never a blank, never `Others`; every figure badged with the release it came from. Placement clamped inside the frame from every pointer position, including a tooltip wider than the 390px bar | `src/lib/tooltip.test.ts` |
| Stratum 3 — every unit drawable from the committed outlines, the pair refusing to be read against geometry it was not cut against, the ceasefire line held out of every unit outline and held out of **exactly** the two units it runs along — asked of **every variant**, because those two units are not always called the same thing: H3 calls Gilgit-Baltistan the *Northern Areas*, so a renderer recognising the line by unit name would stroke it solid the moment a variant renamed a territory. Every drawn district owned by one unit and keyed on the district the map draws rather than the one the claim names; every unit's name anchored inside its own shape across all six variants, which is where a crescent (North-West Frontier Province around the tribal districts) and a 261-polygon province (West Pakistan) would put a name on someone else's ground; and the legend keying only the kinds a variant contains, over H1, which genuinely has no `unchanged` unit rather than an edited one | `src/lib/units.test.ts` |
| The selectors — all four bases offered in the spec's order, the three that cannot be drawn refused with *which half* is missing **per basis rather than one reason for all three**: Historical has its three variants and no fill, Administrative and Development have neither, and the refusal lines group accordingly. A basis entered on its first variant and never alone, a variant taking its basis from itself; and the sentence a screen reader is given, which names a proposal as a proposal | `src/lib/selection.test.ts` |
| Deep links — every selection this build can *reach* round-tripping through its own hash, the baseline's URL among them; a basis named alone entering its first variant and saying the URL was corrected; an unknown variant and an unshadeable basis both answered with the country rather than with the nearest proposal — `#/historical/h1`, `h3` and `h4` named one by one, since those are complete drawable variants whose basis has no fill yet and are exactly the URLs a reader may already have been sent; a hash whose two halves disagree settled by the variant; case, whitespace and stray slashes read as one link; and garbage — a lone `%`, four segments, 4,096 characters — answered without an exception | `src/lib/deep-link.test.ts` |
| Unit names replacing province names rather than doubling them, units outranking divisions, South Punjab anchored inside South Punjab and not inside the Punjab it leaves | `src/lib/labels.test.ts` |
| The scorecard — every figure recomputed from the committed census and the committed partition rather than read back, naming the unit whose numbers moved; each unit's population equal to its own districts' rows; the census join stamped, so a scorecard summed from a rebuilt census fails rather than adding up to the wrong vintage. Anchored outside our own derivation on the province totals typed from PBS Table 1 — Sindh, KP and Balochistan to the person, and South Punjab plus the Punjab it leaves behind equal to Punjab; the twenty uncounted districts set aside by name against `withoutCensusData`; a spread or a reason for having none, never both; contiguity absent from the block, because #16 answers it. Two states the shipped set can now show for itself: **H1** puts every census district in one unit, so there is one counted unit, its population *is* the national total, and the ratio is absent rather than 1; **H3** renames two first-level units and so counts 45 districts moved where only 7 change hands, with the footnote that says which seven asserted beside the figure | `bundle.test.ts` |
| What a *voided* scorecard looks like — the states the shipped set cannot show, on five districts: a unit reaching into ground the census does not cover, a variant withholding its own figures, one counted unit and no ratio to give, nothing counted at all. And the "moved" rule against the two readings it refuses — a shrinking province keeping its districts, a territory promoted keeping its ground | `scorecard.test.ts` |
| The scorecard on the card — five figures in a fixed order; census populations in full and never rounded to a headline; the total qualified by which units it is over and which are outside it; a missing ratio said rather than printed as 1; the stranded districts of a broken unit named; and population voided in the words of whatever is missing it — a variant's own reason and a census gap worded apart | `card.test.ts` |
| The variant card — an unadvocated variant saying so, and a missing **Opposed by** printed as a gap in our data rather than dropped; badges glossed on the card and refused outside the closed vocabulary, naming the variant *and* the word; both district counts wherever the claim and the drawing disagree, with the folds named; the discrepancy footnotes set above the asides; alternative names beside the advocates' own and never instead; the proposal listed ahead of the provinces it is carved out of; and Islamabad never called a province | `src/lib/card.test.ts` |
| Tooltip's third line — proposed said twice over, unchanged *said* rather than left to inference, a territory still a territory inside a variant, and the two ways a district can be in no unit worded apart; spoken last, and spoken even where there are no figures at all | `src/lib/tooltip.test.ts` |
| Provenance (#21) — every basis and every variant carrying a badge, a source **and a vintage**, held over `BASES` and `VARIANTS` where a content diff is actually made rather than only over the artifact; badges from the closed vocabulary at both tiers, naming the basis or variant *and* the word; both the **Advocated by** and the **Opposed by** line, with *unadvocated* held as the stated state it is; the one vintage (D24) anchored against the string all five committed artifacts stamp, and a `census` badge at any other vintage failing by name; and a boundary this build **derived** refused unless it says so — in both directions, since an unbadged derived line passes our arithmetic off as somebody's proposal and a `derived` badge over a transcribed one credits their document to us | `provenance.test.ts` |
| The About panel (#21) — every source row and every basis carrying all three, none blank and each named; a boundary dated by **OpenStreetMap's own edit date** and a figure by the census, and neither by the date the build ran; every drawn surface reached, named rather than counted, so a row lost to a renamed bundle key is a failure and not a silence; the discrepancies present **with their figures** — 1,041,342 people, 6,374 households, the flush-toilet share and the 48,010-household denominator — and the geometry's own disagreements with PBS quoted whole rather than summarised; what the panel leaves off said on the panel; and a date set by hand rather than by the browser's locale, for the reason `groupDigits` exists | `src/lib/about.test.ts` |
| The compare gesture — which presses are the app's and which belong to the page: an unmodified `Space` claimed, a modified one left to the browser and the system, and `Space` **never taken from a focused control**, which on this page means every button there is. The release named as the more forgiving of the two, and the reason; the auto-repeat reported as no change rather than as forty presses; the key and the button reaching one state that neither can quietly undo; and the sentence a screen reader is given, which says the proposal is held off the map rather than gone | `src/lib/compare.test.ts` |
| The rule engine — a rule partitioning the real 136 exactly once, every unit contiguous against the committed graph, every unit's people its own districts' census rows and the whole partition equal to Table 1's national figure; the same rule drawing a byte-identical map twice and again from a shuffled scope and every map reversed, which is the determinism claim; a ceiling holding on every unit and never in fewer units than the arithmetic floor; a distance limit re-measured from the committed geometry; the output validating as a variant, both universes, with `TERRITORY_CLAIM_POLICY` still `forbid`. And what it refuses, each naming the district — the twenty AJK and GB districts the census cannot see, Lahore where a ceiling is below a district that cannot be split, and a district no unit could grow into | `partitioner.test.ts` |
| The bottom sheet (#33) — the sheet never getting *shorter* as it is opened, held over viewports short enough to break it rather than over the phone it was designed on; a drag that went nowhere resting where it started, since there is no position between two detents; the flick answered where the distance would refuse it, and taken **over** the distance where the two disagree; one detent per drag, never two; `peek` as the floor, because the card leaves with the outlines and no view draws boundaries with nothing saying whose they are; and every detent reachable by press, so none is a state only a finger can enter | `src/lib/sheet.test.ts` |
| Hover becomes tap (#33) — a pan and a pinch each refused as the map being *moved* rather than read, the pinch counted across the whole gesture so one finger lifted early is not a tap; the long press left to the platform; the two ways a finger can dismiss a tooltip that a mouse gets free from `pointerleave`, and a different district moving it in one tap rather than two; and an unrecognised pointer left hovering, because a tooltip put up by a mistaken hover is taken down again and one put up by a mistaken tap is not | `src/lib/touch.test.ts` |
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

**The selectors (#18).** Two radio groups, never dropdowns: a basis and a variant are each
one-of-N and the alternatives *are* the product. The baseline sits first among the bases, because
returning to the real map is the same kind of act as choosing one. **A basis is never active on
its own** — selecting one selects its first variant (D13), so there is no state that means
"shaded, with nothing proposed over it". All four bases are always offered, and the three that
cannot yet be drawn are **refused out loud**: the control says whether the variants are missing,
the shading is missing, or both — said on being pressed and not only on hover, since `disabled`
takes no tap and the hard bar is a 390px phone. Which bases can be shaded is a property of the renderer, not of
the bundle, and is stated once in `main.ts` so the menu and the map cannot disagree.

Switching is a **cross-fade, never a cut**: outlines join on the unit's own id, so a unit both
variants contain keeps its element, and an edge that moves is swapped at the *trough* of a
dissolve rather than tweened — two outlines have different numbers of vertices, and interpolating
the path text between them draws nonsense. An edge that has not moved is left alone, or every
switch would announce eight changes and mean one. Returning to the baseline restores the previous
view exactly; the renderer holds nothing back, and the check was made by hand against a
screenshot, because the repo has no DOM seam to assert it in (see the test seam note).

Duration is stated **once, in the stylesheet** (`--switch`) and read from there by the renderer,
because the strata fade in CSS and the outlines fade in JS and the two have to agree or a switch
half-animates. That settles `prefers-reduced-motion` for free: the media query sets `--switch` to
`0ms` and both halves become a straight swap.

**Deep links (#23).** The hash *is* the selection — `#/language/l1` — so an argument can be
conducted by pointing at the live thing rather than at a screenshot, which is the same case D22
makes for the PNG export: a link arrives with the badges, the sources and the **Opposed by** line
still attached, and a screenshot strips all three off. The baseline has a URL of its own, `#/`,
because it is a view and not the absence of one — it is what every variant is argued against
(D17), so leaving a variant changes the URL rather than deleting it.

What an *unreadable* hash does is the decision here, and only one substitution is made. A hash
naming a **basis alone** resolves to that basis's first variant, because D13 says a basis is never
active on its own and there is no state to fall back to. A hash naming a variant this build has
never heard of — or a basis it cannot yet shade, which is three of the four — resolves to the
**baseline**, never to the nearest variant: substituting one proposal for another puts a claim on
screen that the link did not make, and a reader arriving from a stranger's URL cannot tell the two
apart. Nothing throws; the parser is handed strings typed by strangers and truncated by mailers,
and refusing to render over one would answer a bad link with a blank screen.

**A view the reader chose is a history entry; a view this app derived is not.** Selecting a basis
or a variant `pushState`s, so back and forward walk the proposals — a reader comparing three of
them expects the browser's own undo to walk back through the three. Every correction
`replaceState`s: `#/language` expanded to `#/language/l1`, a dead id dropped for the baseline, and
a first visit given `#/`. Following a basis-only link therefore leaves one entry and not two,
since the state back would restore is the one state this app has decided cannot exist. Traversal
is read on `hashchange` rather than `popstate` — `pushState` does not fire it, so the app's own
writes cannot loop, while every back, forward and hand-edited address does.

Parsing and serialising are pure and live in `src/lib/deep-link.ts` under test; `main.ts` holds
only the three history calls, which have no DOM seam to be asserted in.

**Three visual strata** — over a ground of context that is not one of them. The neighbour
silhouettes and the city dots (#8) are furniture: they never change with a basis or a variant,
they carry no data, and they sit outside the numbering because a stratum is something a selection
switches. The silhouettes go beneath the land; the dots and their names go above everything, in
screen space, because a circle has no `vector-effect` for its radius and a dot inside the zoomed
group becomes a blot at 24×.

1. **Fill = data** (dominant mother tongue, development band…) — *never* unit membership
2. **Current boundaries** — thin, faded, once a basis is active
3. **Unit outlines** — heavy, labelled, on top. **Drawn by arc, never by shape**: Azad Jammu &
   Kashmir is a unit in every variant and the Line of Control is part of its outline, so a solid
   stroke over the dash would fill its gaps in and leave a border (D12). The ceasefire line's arcs
   are held out of every unit, exactly as the province stratum already holds them out. Each
   outline is **cased** in the paper's own colour so it survives a busy fill beneath it; a unit's
   name is set at the province size and coloured to match its own outline — the accent belongs to
   `proposed` units and to nothing else, and a unit is **never filled**, because fill is data

Fill shows data so each proposal is displayed *against its own evidence*. Where a unit outline
disagrees with the shading beneath it, that disagreement is the most informative thing on the
map — and it's why a scenario misrepresenting its advocates' claim can't be footnoted away.

**Stratum 1 carries three outcomes, not one** (#17). Under the language basis a district is
shaded by its dominant mother tongue, *or* stippled because the census counted it and names no
dominant tongue (Chitral — Khowar has no column in Table 11), *or* left at the unshaded baseline
because PBS published no row for it at all (AJK and GB, D25). The last two are drawn differently
on purpose: one is an answer the census could not file, the other a question it did not ask
here, and a single grey for both would say the map knows less than it does. Neither is `Others`
— a residual is not a language, and the pipeline already refuses to let it win a dominance.

**Hover** — highlights district, current province, and proposed unit at once; tooltip names
all three (#13, #18). The district and its province are washed and named, with population,
dominant mother tongue and a source per figure; the unit line arrives with the variant and says
which of four things it is — a proposed province (named as proposed, in the accent), a province
the variant leaves alone (*said* to be unchanged, because the map looks identical either way), a
territory kept as itself, or **no unit at all**, which a `census`-universe variant means
deliberately and a `drawn` one can only mean as a gap. The tooltip is also the *only* hover
surface a screen reader gets, since `role="img"` on the map hides the shapes, so the live region
carries the same sentence — the unit included, and included even for the twenty districts with no
figures, which are exactly the ones a reader checks a proposal's edge against.

**Unit names replace province names, rather than joining them.** Seven of L1's eight units *are*
current provinces carried through, so drawing both tiers would set "Sindh" twice a few pixels
apart in two colours — and beside South Punjab it would set the proposal's name next to the name
of the province it is carved out of. The faded province *boundaries* stay; only the names hand
over.

**A division named after its own seat is qualified, not surrendered.** Six of the seven city dots
share a name with the division they administer — Karachi, Lahore, Peshawar, Quetta, Gilgit,
Muzaffarabad. Setting the bare word twice inside one division leaves a reader unable to tell which
of the two is being named; dropping the division name — which is what #8 first did — costs the
default view the administrative structure it exists to show, against the base map's rule that
provinces and divisions are drawn and named *always*. So both are set and the division says which
it is: **Lahore Division** beside **Lahore**. That is the unit's own full official style rather
than a coinage of ours, so it needs no source it does not have, and it is applied **only** to the
six that actually collide — suffixing all 37 would shout a distinction that matters six times.

Crowding is left to the layout rather than given a rule of its own: the dot already outranks the
division, `layoutLabels` drops what will not fit, and it is recomputed on every zoom, so the city
wins the tight frame and the qualified name returns with the room. The cost is paid at default
zoom by **Mardan**, which now gives way to `Peshawar Division` in the most crowded corner of KP —
named in the suite, not absorbed into a count, and back on the first zoom step.

**Compare (#22)** — hold `Space` (or press Compare) to drop strata 1 and 3 and restore the real
map at full strength. The *only* map comparison; no side-by-side, no cross-variant table (D17).

It is **held, never toggled** (CONTEXT.md reserves the word): the key holds it while it is down,
the button holds it until the button is pressed again, and the two reach *one* state — which is
what makes the button the same gesture for a reader with no keyboard rather than a second feature
that resembles it. Neither may quietly undo the other, so a key released over a comparison the
button is holding changes nothing.

**Releasing restores the view exactly, and that is a consequence rather than a feature.** The
compared map is `viewFor(BASELINE)` assembled whole — so a fourth stratum added later is dropped
by construction rather than by being remembered here — and the selection is never touched, so
there is nothing to put back. Zoom and pan survive because `show` re-projects nothing and never
reads the transform: the country does not move under the gesture, and the outlines return over
exactly the ground they left. The animation is the same cross-fade a variant switch already uses,
on the same `--switch` from the stylesheet, so reduced motion makes compare a straight swap for
free and nothing here states a second duration.

Three things it deliberately does not do. **It is absent at the baseline**, arriving and leaving
with the outlines exactly as the card does — the current map compared against itself is not a
comparison — and `Space` there is left to the page, where it scrolls. **The card, the legend and
the colophon do not change**: the reader is looking at the map with a key down, and rewriting
three blocks of prose underneath them would be the page changing rather than the map; the proposal
is still selected while it is held off the screen. And **choosing a variant ends it**, because a
reader who asks to see a proposal has asked to stop comparing.

`Space` is **not taken from any control that already answers it.** Every control on this page is
a `<button>` — the Compare button included — and a focused button fires its own click on `Space`;
firing the hold as well would press the button *and* hold the key, the two cancelling, leaving a
control that reads as dead. So the gesture is refused wherever focus is interactive and available
everywhere else, the map included, which carries `tabindex="0"` and is where a reader stands to
compare. The release is deliberately the more forgiving of the two — the key alone, whatever
modifiers arrived mid-hold and wherever focus went, plus the window's own `blur`, since
alt-tabbing with `Space` down delivers the `keyup` somewhere else entirely and a missed release
strands the map on the baseline while the card beside it argues for boundaries that are not drawn.
Auto-repeat is swallowed but not acted on: every repeat would scroll the page if its default were
let through, and none of them may restart a cross-fade mid-fade. The full accessibility pass is
#35's; this is the narrower obligation not to leave it a conflict to find.

**On a phone (#33)** — the card is a **bottom sheet**, hover is a **tap**, and Compare moves to the
corner a thumb reaches. None of the three is a second version of the app: the sheet holds the same
card, whole, because a card that hid its opposition line on a phone would read as an endorsement on
a phone; and the Compare button is the gesture it already was (#22), holding the comparison until it
is pressed again, moved rather than redefined.

The sheet rests at **three detents** — `peek`, the ticket's ~40% `half`, and `full`, which stops
short of the top so a strip of map stays visible and the reader is still on a map rather than on a
page they navigated to. `peek` is the **floor**: the card arrives and leaves with the outlines (#19),
so while a proposal is drawn there is no state in which nothing on screen says whose boundaries
those are, and the sheet can therefore be got out of the way but not got rid of. Where a drag
settles is decided in `lib/sheet.ts` under test, because a sheet that settles somewhere the reader
did not mean is the whole of what makes one feel broken and is not a thing that can be found by
reading the code back — **velocity is asked before distance**, since a reader who drags down and
then flicks back up has changed their mind and the last thing the hand did is the better evidence
than the furthest it got. One detent per drag, never two, or any brisk pull skips `half`, which is
the position the ticket is about. The grip is a **`<button>`** as well as something to drag, so
every detent a finger can reach a press can reach too, and the map is not left with a state only a
touchscreen can enter.

**Hover becomes tap, and the dismissal is the part that has to be invented.** A mouse clears the
tooltip by leaving the district; a finger cannot leave anything, so without a deliberate way to put
the box away it sits over the very ground it was tapped to explain for the rest of the visit. So a
tap on the district already showing puts it away, and so does a tap on the sea — while a tap on a
*different* district moves the tooltip in one press rather than two, because the common act is
comparing two districts and charging it double makes the map feel stuck. Only a **still, brief,
single** finger is a tap: a second finger is a pinch, travel is a pan, and a long hold already
belongs to the platform, and the map has its own answer to all three. Moves are not answered at all
on touch — every pan across the country is a `pointermove`, and answering those would drag a tooltip
along behind the thumb.

**Variant card (#19)** — name and tagline, the **basis** badge beside the **provenance** badges,
unit count, the 2–3 sentence rationale, the proposal's real-world status, where the boundary came
from, **Advocated by** *and* **Opposed by**, the units, the footnotes and the sources. It arrives
and leaves with the outlines: at the baseline there is no proposal on screen and no card either.

Four things it refuses to do quietly. **A missing opposition line prints as missing data**, not as
silence — the build refuses an empty `opposedBy`, so a card in that state came from a bundle this
build did not write, and dropping the line would turn a gap in our data into the finding that the
proposal is uncontested. An **unadvocated** variant says so in the advocacy's own words (L7 and D1
apply a rule nobody proposes the output of) rather than showing an empty list. A **badge outside
the closed vocabulary throws**, naming the variant and the word, and every badge is glossed *on the
card* rather than in a `title`, because the hard bar is a 390px phone and a `title` is reachable
there by nothing. And **both district counts are printed wherever a claim and the map disagree** —
South Punjab as 13 claimed and 11 drawn, with the folds named — with the footnote that explains the
difference set above the asides, since a reader counting districts on screen has found the most
alarming-looking thing on the card and is owed the answer before the context.

Units are listed **proposed first**, not in partition order, which is remainders after the claims
they are the remainder of; alternative names sit beside the advocates' own name and never instead
of it. Where the variant's own provenance disagrees with its basis's — L1 is a Language variant
whose boundary is `documented`, not `census · proxy` — the card says why, or the disagreement reads
as a mistake. Nothing on it calls Islamabad a province: the unit vocabulary has no word for a
capital territory, so an `unchanged` unit is said to be *unchanged from the current map*.

Two columns where there is room, stacked in the same order where there is not, and **not animated**
— the map cross-fades because a shape moves and the eye follows it; prose faded in over a third of
a second is prose the reader waits for. The words are decided in `src/lib/card.ts`, under test;
`src/panel.ts` composes no sentence of its own.

The **scorecard (#20)** — unit count, population spread, largest:smallest ratio, districts moved,
non-contiguous units — sits between the units it summarises and the footnotes that qualify them, set
as a table of figures rather than as prose, because a reader comparing two proposals reads down that
column and nothing else. The order is fixed across variants for the same reason. Not one of its
figures is computed on the page: they are read off the bundle, which summed them from the census, and
`card.ts` decides only what they are called.

Populations are printed **in full and grouped** — 87,311,346, never "87.3 m": the census counted
people one at a time and publishes the count, and rounding it is this app interpolating. The
qualification travels with its own figure rather than sitting below the block, because 241,499,431
described as the country's while two territories are missing from it is a wrong number and the note is
what makes it a right one. Where population is withheld, the sentence saying so is set **above** the
remaining lines and the population lines are gone rather than blank — so what is left reads as the
whole of the scorecard rather than as what survived of it. Each unit also carries its own population,
or the sentence saying the census does not reach it. Never a zero, never a dash, never nothing.

Contiguity is **flagged, never blocked** — computed at build time off the district adjacency graph
(#16) and carried on the unit, so the card names the stranded districts rather than reporting a
count, and never confuses being in two pieces with drawing as two shapes.

**About the data (#21)** — the audit surface. The working agreement's claim is that no surface
here is unsourced; until this panel existed that claim was checkable by us and by nobody else,
since the badges are on the card, the vintage is in the colophon and the reconciliations are
inside `data/bundle/statistics.json`. One `<details>` under the colophon now carries every source,
its badge, **its own vintage**, and the date each committed artifact was baked. A `<details>`
rather than a dialog or a route: it opens with no JavaScript, needs no hover to be found, takes a
tap, and collapses to one line — which is what makes the 390px bar free rather than a special
case. Closed by default, because it is the reference behind the map and not the map.

Three things it does that a source list would not. **Vintages are per source, never one string
repeated**: OpenStreetMap's own edit dates sit under the boundaries and PBS's census under the
figures, because printing the census's date under a border would say the border was surveyed by a
census — and neither is the date the build ran, which has a section of its own. **The
discrepancies get a section above the small print, not a footnote**: the 1,041,342 people Table 11
counts short of Table 1, the 6,374 households PBS's two releases of Table 23 disagree by, the
absence of any improved-*sanitation* column, the 48,010-household denominator, the division totals
that are a cross-table check and not a second source, and the geometry's own disagreements with
PBS's published areas. A panel that listed the tables and hid those would use the audit surface to
make the data look tidier than it is, which is the failure it exists to prevent. And **what it
leaves off is on it**: the SHA-256 cache digests, the province and division reconciliation tables
and the per-district mother-tongue excesses are an auditor's appendix of some hundreds of rows,
they stay in the artifacts where the suite re-derives them every run, and the panel says so and
names the files.

Nothing on it answers to the selection — the sources, the vintages and the build dates are the
same under every basis and every proposal — so it is rendered once, at load. The words are decided
in `src/lib/about.ts`, under test; `src/panel.ts` composes none, exactly as with the card.

---

## Politically sensitive rendering

- **AJK and Gilgit-Baltistan** drawn and named, styled as **territories, not provinces** —
  constitutionally they are not provinces. The distinction is carried by **texture, not by
  weight**: a hatched ground at a pitch counter-scaled against the zoom, and the *same* rule at
  the *same* weight as a province. A fainter or thinner outline is legible and says the wrong
  thing — provisional, or not quite ours — about ground Pakistan administers. **Not fully
  interactive:** PBS's 2023 results cover 136 districts — the four provinces and ICT only — so
  no AJK or GB district has a mother tongue, literacy, water or sanitation figure. They cannot
  be shaded under any basis, and carry no hover statistics beyond a name. Hovering names them
  and says *the census does not cover them*, so the absence reads as coverage and not as a zero
  or a failed load. AJK population exists only relayed via AJK BoS, never direct from PBS.
- **Line of Control drawn dashed and labelled** — a ceasefire line, not an international
  border. Solid would be a claim this app's data can't support. It is a stratum of its own and
  the **only** thing drawn along its stretch: the province and territory outlines are drawn by
  arc with those arcs held out, because a solid line beneath a dash fills the gaps in and leaves
  a line that looks solid and means the opposite. Width and dash are in screen px at every zoom.
  The name is set along whichever part of the line is on screen, on the side with no drawn land,
  and it **yields to** the tier names rather than displacing them — the territories are drawn
  *and named*. Yielding is absolute and ordered: the full name on clear paper, then the full name
  over land, then **`LoC`** on clear paper, then `LoC` over land, then no name at all. Sitting over
  land is a compromise; sitting over another name is a defect, since it costs a reader both names,
  and the dash is keyed in the legend under **every** basis — so an unnamed line is still an
  explained one. At default zoom the northern names are dense enough that the abbreviation is what
  gets set; from about 3× the full name returns. **"Clear paper" means paper, and had to be taught
  the difference once #8 landed**: until the neighbour silhouettes were drawn, the far side of the
  line was blank, so *outside Pakistan* and *on nothing* were the same question and asking only
  about the provinces answered it. India is drawn there now, and the top-ranked placement would
  have been the one over a silhouette while the code still scored it as empty. Both sides are
  asked, so the four-step order means what it says again.
- **The Working Boundary is not the Line of Control.** Punjab's Sialkot–Jammu stretch is a
  different line, south of the ceasefire line's terminus on the Chenab; it is not drawn dashed,
  and the colophon says so. Falls out of the derivation rule rather than being special-cased.
- **"GB as 5th province" is content, not baseline** — a live proposal (provisional status
  announced Nov 2020; GBLA resolution), so it's a switchable variant.
- **Durand Line — a normal boundary with a footnote, and the footnote is the whole treatment.**
  Nothing in the renderer knows the Pakistan–Afghanistan stretch from any other part of the
  outline: same solid rule, same province weight, no dash. That is the decision and not an
  omission. **The dash means *ceasefire line*** and there is exactly one of those on this map;
  spending it a second time on a disputed *international* boundary would tell a reader the two
  are the same kind of line, and cost the dash the meaning D12 exists to give it. So the dispute
  is carried in words — the 1893 agreement, the Loya Jirga of 1949 declaring it void, and that no
  Afghan administration since has accepted it as an international border. The note ships **with
  Afghanistan's silhouette**, exactly as the ceasefire line's note ships with its geometry, so it
  cannot be lost while the line is still on screen. Pakistan administers up to it and it bounds
  every figure in this app; what is disputed is its standing, not where it runs.
- **Faint, unlabelled neighbour silhouettes for context** (#8) — fill and *nothing else*. No
  stroke of any kind: each silhouette ends where the country begins, so a rule around India would
  double a line already drawn and spill half its width outside as a halo, and it would compete at
  province weight for something this map is not about. They are held subordinate **structurally**
  and not only by styling — a separate bundle sharing no arc with the country's, drawn beneath the
  land, and never asked a question, since hover is put to the district polygons in lon/lat
  (`hit-test.ts`) rather than to the DOM. Consequences accepted out loud: the four are told apart
  only in the artifact and the colophon, which is what *unlabelled* costs; and only the four
  Pakistan borders are drawn, so the far corner of a very wide frame shows paper where Tajikistan,
  Turkmenistan, Uzbekistan and Oman are — the silhouettes exist for the boundary, not for the
  corner of the frame.
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

- **Vanilla TypeScript + Vite + D3.** No framework — runtime state is five values (active
  basis, active variant, hovered district, compare-held, and on a phone the sheet's detent); no
  async, no forms. Routing is the URL hash and nothing else (#23): one parser, one `hashchange`
  listener, no router. The fifth is deliberately **not** in the URL and not in `main.ts`: how far
  a reader has pulled the card open is a property of the device in their hand, not of the view
  being argued, and a shared link that restored it would move a stranger's sheet.
- **Inline SVG, custom projection, no basemap.** Showing only Pakistan deletes the reason to
  use a mapping library. D3 owns the SVG *and* renders the panel lists.
- Pan/zoom via `d3-zoom`. Sparse major-city dots instead of a basemap — seven of them, and
  "major" means *seat of a first-level unit*, because no city population exists at this vintage
  from this source (#8). The dot is drawn whatever happens; it is the **name** that yields when
  the frame is crowded, the same order the ceasefire line's name follows.
- Deep-link URLs (`#/language/l2`).
- **Visual direction: editorial atlas, light.** Warm off-white canvas, muted desaturated
  categorical fills, hairline strokes, serif headings, one accent reserved for unit outlines.
  No dark mode in v1 — categorical palettes are harder to keep distinguishable on dark, and
  the editorial register signals *reference* rather than *toy* on a politically live subject.
- Palette validated via the `dataviz` skill for colourblind safety — and the validation lives in
  the suite (`src/lib/colour-vision.ts` + `palette.test.ts`), re-derived from the hexes on every
  run, because a palette checked once at authoring time and never again is a palette nobody can
  change safely. **Fifteen categories is past what any categorical palette separates pairwise**,
  so the gate is held on the pairs that actually share a border on the map — geography, not a
  scatter plot, decides which two fills a reader ever sees touching — and the pairs that fail
  when any two swatches sit side by side are named in `palette.ts` rather than left to be found.
- **Responsive, and the phone is not the degraded case** (#33). Hard bar: **map legible and
  variant switching functional at 390px.** Pakistan's internet is overwhelmingly mobile-first, so
  this is where most of the audience meets the app. Panel becomes a bottom sheet; hover becomes
  tap; `Space` becomes a button. The breakpoint is stated **once, in the stylesheet** (`--sheet`)
  and read from there by `sheet.ts`, the same arrangement `--switch` already has and for the same
  reason: a JS copy of `560px` eventually disagrees with the CSS one, and a sheet whose script
  thinks it is a sheet while its CSS thinks it is a column sets a height on a box that is not
  positioned to have one.

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
   are drawn but unshaded and carry no PBS-direct statistics. Product decision outstanding — the
   build's provisional answer is **no**: `TERRITORY_CLAIM_POLICY` is `forbid`, so the first
   variant that needs it fails loudly naming the district instead of settling a constitutional
   question by accident. Both answers are expressible and both are tested.
3. **Deployment target** — deliberately undecided. Static bundle, builds to `dist/`.
4. **`SCENARIOS-DRAFT.md` is temporary.** The typed data module now exists
   (`scripts/lib/variants.ts`, schema in `scripts/lib/scenarios.ts`) and carries L1, L4, L5, H1, H3
   and H4; the markdown is deleted once the other eleven have migrated into it (#36) — L2, L3, L6
   and L7, the five Administrative variants, H2, and D1. Until then the two coexist and
   the module wins — every field in the markdown (rationale, advocacy, opposition, footnotes) is
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
  figure or a published boundary, and carries a badge saying which — and a **vintage**, because a
  badge without a date is half a provenance. The claim is no longer only ours to check: the
  **About the data** panel (#21) puts every source, every vintage and every build date on one
  surface, discrepancies included, and the build refuses a basis or a variant that is short of any
  of the three.

---

## Agent skills

### Issue tracker

Issues live as GitHub issues in [AbuBakrCh/pakistan-map](https://github.com/AbuBakrCh/pakistan-map), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
