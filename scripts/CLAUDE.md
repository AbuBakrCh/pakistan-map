<!-- Moved verbatim out of the root CLAUDE.md (see its pointer) so it loads only when
     working under this directory. Two blocks have since moved on into `docs/` — the derived
     variants and the scorecard — each pointed at from the section that used to hold it. -->

### Pipeline

Build-time bake, **artifacts committed** — not gitignored.

Split by failure mode, so network flakiness never contaminates geometry work:

| Script | npm script | Does |
|---|---|---|
| `scripts/fetch-osm.ts` | `build:data:fetch` | Network only. Admin levels 4, 5, 6, the coastline, the four neighbour countries and the first-level `admin_centre` nodes → `data/raw/`, retrying across four Overpass mirrors. Level 4 sources ICT and, now, each unit's seat |
| `scripts/normalize-geometry.ts` | `build:data:normalize` | Filters strays → folds post-census units into their 2023 parent → injects ICT → stitches rings → clips coastal districts to the coastline → derives the Line of Control from ways shared with India's own relations → merges all three tiers **and the line** from one shared arc set → simplifies → `data/bundle/geography.topojson.json` |
| `scripts/build-scenarios.ts` | `build:data:scenarios` | Reads the census, the borders **and the development composite** first, because `variants.ts` is a function of all three — ten variants are literals, L6 and L7 are drawn here from Table 11's plurality (#26), A6 from divisional headquarters, population and distance (#28) and D1 from the composite (#31). Refuses a composite computed over a census join stamped differently from the one it is reading, since a boundary drawn at scores taken over figures the rest of the map no longer carries is undetectable from its own contents. Then validates every variant as a **complete partition** and bakes it to `data/bundle/scenarios.json`. Fails on a claimed district that is not a district, a district two units both claim, or a district no unit claims — naming the district and, for an overlap, both units. Resolves each claim onto the 2023 set through the same fold table the geometry uses, so the artifact carries the claim *and* the drawing: South Punjab is stated as 13 districts and drawn as 11. Then **dissolves each unit** out of its districts' arcs → `data/bundle/unit-outlines.json`, and derives the **district adjacency graph** from that same arc set → `data/bundle/adjacency.json`, which is what every unit's contiguity flag is read off. Also sums each unit's population out of `statistics.json` and bakes the **scorecard** (#20) onto every variant. Refuses, besides, a basis or a variant short of a badge, a source or a vintage; a badge outside the closed vocabulary; a `census` badge at a vintage that is not the project's; and a boundary this build derived that does not say so — each naming the basis or variant and the word (#21) |
| `scripts/build-context.ts` | `build:data:context` | Stitches each neighbour relation into closed polygons with the districts' own stitcher → intersects them with `CONTEXT_EXTENT` → pairs each first-level unit with its `admin_centre` node → simplifies to 4% and quantizes → `data/bundle/context.topojson.json`. Fails on a country whose ISO code is not in the cache, a ring that will not stitch shut, a silhouette that clips to nothing, a shape that does not contain its own capital, or a unit with no seat — each named. **A separate artifact from the geography bundle, deliberately:** nothing here shares an edge with anything in there, and merging them would renumber every arc in the country to add a background and imply the two sides of a border are one line. Quantization comes *after* simplification, the opposite order from the geometry build, because `presimplify` restores absolute coordinates for arcs and not for **points** — quantized first, every city dot lands in the Bay of Bengal |
| `scripts/build-development.ts` | `build:data:development` | Reads the three published rates out of `statistics.json` → takes the **unweighted mean** of them per district → bands each at fixed cuts → `data/bundle/development-index.json`, with the formula, the band method, the range, the counts per band and the twenty districts the census does not reach recorded beside the scores. Fails on a census district with no development block, a rate that is not a proportion in 0–1, a score that falls in no band, or a district set that is not the 136 — each naming the district. **A separate artifact from the census join, deliberately:** that one is PBS's figures and this one is the figure nobody published, and a `synthesized` number inside a `census` artifact is one field away from being read as another published column |
| `scripts/join-census.ts` | `build:data:census` | Reads the committed `PakPC2023` `.RData` cache → resolves census spellings onto the roster → sums districts and reconciles them upward: divisions against the package's own division table, provinces and the national total against PBS Table 1; sums Table 11's tehsils into districts and reconciles every language column against PBS's printed province figures; sums Tables 12, 23 and 24's tehsils into districts and reconciles all eight development counts against PBS's printed province figures; joins the transcribed **Table 1 district areas** (#49) onto the same roster and reconciles them to the five published province areas and the 796,096 km² national one, checking each transcribed row against the population printed beside it → `data/bundle/statistics.json`. Fails on an unplaced row, an uncovered district, an unknown language category, a count larger than the universe it is part of, a total that does not add up, an area row that matches no district or lands on one twice, a census district with no published area, or a transcribed population that is neither the package's nor one of the eight pinned differences. The emitted artifact records, per tier, which source the check was against |

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
of truth that retired `SCENARIOS-DRAFT.md` (#36) — the draft is deleted, recoverable at
`git show 20c2f67:SCENARIOS-DRAFT.md`, and reconciled against the module field by field and variant
by variant in `docs/research/scenario-migration.md`, which names every drift, every deliberate
omission and the six card obligations the draft states — five footnotes and one withholding, marked
three different ways in the draft and counted rather than rounded. The module is the reviewable form; the
committed `data/bundle/scenarios.json` is the *resolved* form, and the difference is the point:
it carries the claim as its advocates state it next to the 2023 districts the map draws it as,
with every fold recorded. A change to a proposal's territory is therefore a dated diff rather
than something that happens between two page loads, and the runtime reads one bundle directory
rather than reaching into `scripts/`.

**Ten of the fourteen variants are literals; four are functions of the census** (#26, #28, #31).
`variants.ts` exports `variantsFrom(context)` rather than a constant, because those four have no
document to transcribe — nobody publishes a district list for "the Pashto-plurality districts of
Balochistan", nobody at all proposes assigning every district in Pakistan by its plurality mother
tongue, nobody publishes one for "each province divided at its own divisional headquarters, no unit
above 25 million people and none reaching further than 300 km" either, and nobody publishes one for
"the districts the census serves alike, grouped where they touch".
Their boundaries are computed in the one build that already reads the census and the adjacency
graph, which is what keeps the repo to a single derivation: baking the district lists into a
committed reference file would have put a second one in the tree to keep honest. Two of the four
need inputs the others do not, and both take them from committed artifacts rather than recomputing
them. **A6** needs district **centroids**, since one of its two limits is stated in kilometres,
taken from the drawn geometry through `scripts/lib/centroids.ts`, and the **development composite**,
which gates which districts may seat a unit; D1 needs that same composite, taken from
`development-index.json` — the same file the shading reads, so the map cannot shade a district on
one number while the line drawn over it was decided on another. A6 also needs the census's own
**division per district**, which is what its centres are seats of, read off `statistics.json`
through `districtDivisions`. All are shared by the build and the suite for the reason everything
else here is: a figure derived twice is two figures, and a rule stated in one is exactly the
constraint that would pass its own re-derivation while disagreeing with the drawn map by a district.

**What each of the four rules is, what it draws, and every cost stated on its card, is in
`docs/derived-variants.md`** — the partitioner behind A6, A5's promotion, the mother-tongue
engine behind L6 and L7, and the composite partition behind D1. H2 is there too: it is a literal,
but it carries the app's only withholding and the second of open item 2b's two narrowings.

Two things a partition has to state out loud, because both have two defensible answers:

| Question | How it is expressed | Current answer |
|---|---|---|
| **Which district set must a partition cover?** | `universe` on the variant — `drawn` (all 156, nothing left uncoloured) or `census` (the 136 with statistics; AJK and GB outside the partition, drawn and named and in no unit) | Per variant; all seventeen declare `drawn` |
| **May a variant claim AJK or GB territory?** (open item 2b) | `TERRITORY_CLAIM_POLICY` in `scenarios.ts`, both settings tested | **`forbid`** — a non-`territory` unit taking a territory district fails the build, naming it. Those districts carry no PBS statistic, so the unit's population would be short by an unknowable amount. One narrow exception, and only one: a **promotion** — a `proposed` unit that is *exactly* one territory's whole district set under that territory's exact name (`promotedTerritoryOf`), where nothing is taken, no boundary moves and the population is not short but absent. Nine of ten, ten plus a Punjab district, the same ten renamed, and the same ten held as `unchanged` are all still refused by name. The policy itself is a product decision, not a technical one: settling it is a one-line change |

A second exception, `withoutModernFigures`, admits **any** shape of territory claim on a variant
that publishes no population figure anywhere (H2, #30) — the wider of the two, and argued in
`docs/derived-variants.md`. `TERRITORY_CLAIM_POLICY` is untouched at `forbid` by both.

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
districts form **one connected component**, 404 shared borders, not one isolated, Gwadar included
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

### The scorecard (#20)

Arithmetic, absences and the area substitution are in **`docs/scorecard.md`**. The rules:

- Every variant carries unit count, population spread, largest:smallest ratio and districts
  moved, **computed at build time** in `scripts/lib/scorecard.ts` and written into
  `scenarios.json` — a figure the runtime derived would be a figure nobody reviewed. The fifth
  line, contiguity, is *not* computed there: #16 already answered it.
- A unit's population is **the sum of its districts' census rows and nothing else**.
- **Two absences kept apart, because a zero for either would be a claim this app cannot make.** A
  unit **wholly** outside the census (AJK, GB — D25) is set aside from the spread **by name**. A
  unit **partly** outside it is a hole, and it **voids the variant's population figures
  altogether**, naming the unit and the districts. A variant may also withhold in its own words.
  **The scorecard carries a spread or a reason for having none, never both and never neither.**
- **Where it carries no population it carries ground instead** (#49) — PBS's published Table 1
  area, **never a measurement of the drawn polygons**, set aside on exactly the terms the
  population is. Carried on every variant, **printed only where the population lines are missing**.
- **"Districts moved" is measured against the district's current province**, keyed on the 2023
  district the map draws, and *carrying forward* is decided on the unit's **name** — the unit
  called Punjab is Punjab whatever it has lost.
- Areas printed **in full and grouped** — 796,096 km², never "796k" — for the reason populations
  are.

### The development composite (#31)

**The app's one `synthesized` figure, baked in an artifact of its own.** PBS publishes literacy,
improved drinking water and toilet facilities; it publishes no index over them and nor does anybody
else at this vintage, so `scripts/lib/development-index.ts` defines one — the **unweighted mean of
the three published rates**, each keeping the denominator PBS gave it. Three choices, each made the
way this repo makes them: **unweighted**, because a weighted mean is a claim that literacy is worth
some stated amount more than a toilet and no source states that number; **over PBS's own
denominators**, which are not one denominator — literacy is over people aged 10 and above, the
other two over the housing tables' households — so the result is called an *index* and never a
rate; and **not re-scaled to the observed range**, or a district's score would move because another
district moved and the legend would mean something different at each census.

It goes in `data/bundle/development-index.json` rather than into `statistics.json`, and the
separation is the whole of its provenance. That artifact is PBS's figures; this one is the figure
nobody published, and putting a `synthesized` number one field away from the rates it is a mean of
would let it be read as another census column. It is **baked rather than computed on the page** on
the scorecard's reasoning (#20): a figure the runtime derived is a figure nobody reviewed — and it
would be derived twice besides, once to shade a district and once to draw D1's boundary over it,
which is two answers to one number. The suite re-derives the whole file from the committed census on
every run.

The **shading bands are four, at fixed cuts** — under 50%, 50–65%, 65–80%, 80% and above — rather
than quantiles, so a district's colour is not a function of every other district's score and the
legend says the same thing at every vintage. Four rather than five is a constraint and not a
preference: see `docs/visual-design.md`.

**The third component is flush toilets, named as such, everywhere.** PBS classifies water sources as
improved or not and prints the result; for toilets it prints only flush / non-flush / none, and a
non-flush toilet may be improved or not. There is no improved-*sanitation* column to average in, and
adding flush to non-flush would be a definition of ours inside a composite of ours — a judgement
squared, and invisible. The tooltip, the card and the About panel each say so where the figure is.

**And it is not a poverty measure**, which is said on the card, in the colophon and on the panel
rather than assumed. The census sees service access and attainment; it does not ask about income,
consumption, child mortality or nutrition. The suite holds the word out of every development
surface, and the two places the card does use it are the sentences refusing it.

### Two build checks that are not about one variant

- **Whether a variant withholds, and what its reason is, is asked once** (#48). `figuresWithheld`
  is exported from beside the tooltip and answers for the card, the tooltip and the export band
  alike; `main.ts` hands it over rather than deriving it. The card's sentence and the tooltip's
  are compared **against each other** in the suite, never each against its own literal.
- **Every year a variant's prose asserts is a year its sources reach** — the working agreement's
  "no unsourced surface" applied to card copy. It walks the card `variantCard` composes, so a
  prose field added later is covered by construction. Five known gaps are named one by one rather
  than the check being loosened. Both are argued in `docs/derived-variants.md`.

Shared pure logic lives in `scripts/lib/` with tests beside it.

Every relation must be classified. A relation matching no 2023 district and no fold rule
**fails the build** rather than being skipped — a silent discard is how the district set drifts
without anyone noticing, and the point of committing the bundle is that boundary changes are
reviewable diffs.

Committing the output means **every boundary change is a reviewable diff with a date on it**.
Runtime makes zero network calls.

> Overpass is rate-limited and periodically down. Build-time problem only — and the reason
> runtime fetching was rejected: upstream OSM edits would silently mutate boundaries between
> page loads.
