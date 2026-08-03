<!-- Moved verbatim out of the root CLAUDE.md (see its pointer) so it loads only when
     working under this directory. -->

### Pipeline

Build-time bake, **artifacts committed** — not gitignored.

Split by failure mode, so network flakiness never contaminates geometry work:

| Script | npm script | Does |
|---|---|---|
| `scripts/fetch-osm.ts` | `build:data:fetch` | Network only. Admin levels 4, 5, 6, the coastline, the four neighbour countries and the first-level `admin_centre` nodes → `data/raw/`, retrying across four Overpass mirrors. Level 4 sources ICT and, now, each unit's seat |
| `scripts/normalize-geometry.ts` | `build:data:normalize` | Filters strays → folds post-census units into their 2023 parent → injects ICT → stitches rings → clips coastal districts to the coastline → derives the Line of Control from ways shared with India's own relations → merges all three tiers **and the line** from one shared arc set → simplifies → `data/bundle/geography.topojson.json` |
| `scripts/build-scenarios.ts` | `build:data:scenarios` | Reads the census, the borders **and the development composite** first, because `variants.ts` is a function of all three — ten variants are literals, L6 and L7 are drawn here from Table 11's plurality (#26), A1 to A4 from population and distance (#28) and D1 from the composite (#31). Refuses a composite computed over a census join stamped differently from the one it is reading, since a boundary cut at scores taken over figures the rest of the map no longer carries is undetectable from its own contents. Then validates every variant as a **complete partition** and bakes it to `data/bundle/scenarios.json`. Fails on a claimed district that is not a district, a district two units both claim, or a district no unit claims — naming the district and, for an overlap, both units. Resolves each claim onto the 2023 set through the same fold table the geometry uses, so the artifact carries the claim *and* the drawing: South Punjab is stated as 13 districts and drawn as 11. Then **dissolves each unit** out of its districts' arcs → `data/bundle/unit-outlines.json`, and derives the **district adjacency graph** from that same arc set → `data/bundle/adjacency.json`, which is what every unit's contiguity flag is read off. Also sums each unit's population out of `statistics.json` and bakes the **scorecard** (#20) onto every variant. Refuses, besides, a basis or a variant short of a badge, a source or a vintage; a badge outside the closed vocabulary; a `census` badge at a vintage that is not the project's; and a boundary this build derived that does not say so — each naming the basis or variant and the word (#21) |
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

**Ten of the seventeen variants are literals; seven are functions of the census** (#26, #28, #31).
`variants.ts` exports `variantsFrom(context)` rather than a constant, because those seven have no
document to transcribe — nobody publishes a district list for "the Pashto-plurality districts of
Balochistan", nobody at all proposes assigning every district in Pakistan by its plurality mother
tongue, nobody publishes one for "no province above 25 million people" either, and nobody publishes
one for "split each province where its development gradient is steepest".
Their boundaries are computed in the one build that already reads the census and the adjacency
graph, which is what keeps the repo to a single derivation: baking the district lists into a
committed reference file would have put a second one in the tree to keep honest. Two of the seven
need an input the others do not, and both take it from a committed artifact rather than recomputing
it. A4 needs district **centroids**, since its rule is stated in kilometres, taken from the drawn
geometry through `scripts/lib/centroids.ts`; D1 needs the **development composite**, taken from
`development-index.json` — the same file the shading reads, so the map cannot shade a district on
one number while the line drawn over it was decided on another. Both are shared by the build and
the suite for the reason everything else here is: a figure derived twice is two figures, and a rule
stated in one is exactly the constraint that would pass its own re-derivation while disagreeing
with the drawn map by a district.

Two things a partition has to state out loud, because both have two defensible answers:

| Question | How it is expressed | Current answer |
|---|---|---|
| **Which district set must a partition cover?** | `universe` on the variant — `drawn` (all 156, nothing left uncoloured) or `census` (the 136 with statistics; AJK and GB outside the partition, drawn and named and in no unit) | Per variant; all seventeen declare `drawn` |
| **May a variant claim AJK or GB territory?** (open item 2b) | `TERRITORY_CLAIM_POLICY` in `scenarios.ts`, both settings tested | **`forbid`** — a non-`territory` unit taking a territory district fails the build, naming it. Those districts carry no PBS statistic, so the unit's population would be short by an unknowable amount. One narrow exception, and only one: a **promotion** — a `proposed` unit that is *exactly* one territory's whole district set under that territory's exact name (`promotedTerritoryOf`), where nothing is taken, no boundary moves and the population is not short but absent. Nine of ten, ten plus a Punjab district, the same ten renamed, and the same ten held as `unchanged` are all still refused by name. The policy itself is a product decision, not a technical one: settling it is a one-line change |

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

**Where it carries no population it carries ground instead, and that substitution is the whole of
#49.** #30 took the last modern figure off H2 — 2023 counts do not describe 1947 boundaries — and
left the one scorecard in the app with nothing quantitative on it at all, which is not what that
ticket asked for: its brief said *the card shows area and composition only*, and only the
composition shipped. Area is the right figure and not merely an available one, because **a
district's area is a fact about ground that has not moved since 1947** where its population is a
count taken in 2023. It is **PBS's published figure and never a measurement of the drawn polygons**,
for the reason the geometry build already records at length: those polygons are clipped to a
coastline and disagree with PBS by thousands of km² on the Indus delta, so a measured area would be
this project's own number wearing the census's badge. It is set aside on exactly the terms the
population is — a unit reaching ground PBS published no area for carries **`null`** and never a
partial sum, and the units left out of the total are *the same units* the spread leaves out, since
Table 1 is the same census and there is one coverage rather than two lists.

**Carried on every variant, printed only where the population lines are missing** — which is #49's
open product call, settled here. Both halves are deliberate. The arithmetic is done for all
seventeen because a figure derived for one card is a figure nothing else can check, and the suite
re-derives every unit's area over every variant; the printing is conditional because the scorecard
is a fixed column a reader compares straight down between two proposals, and a sixth line on all
seventeen would be a change to that comparison surface no ticket has asked for. Area earns its place
exactly where the lines above it are gone.

**Two surfaces ask it, and they ask different questions rather than one question twice.** The
scorecard's Area line is asked of the scorecard's own `population`, so all three ways a variant can
end up with no spread reach the substitute and not only the one H2 exercises. A *unit's* area is
asked of `figuresWithheld` (#48), the same predicate its population sentence is: a variant voided by
a census hole still prints every unit's population, so ground beside it would be a second figure
nobody is missing, where a withholding variant's unit line has none at all. The Area line's own
qualification is read off the units that have **no published area**, which is a third list again —
`outsideTheCensus` is the units *wholly* outside the census, and a unit only partly outside it drops
out of the total the same way while appearing on neither list. Areas are printed **in full and
grouped** — 796,096 km², never "796k" — for the reason populations are: PBS published the figure,
and abbreviating it is this app interpolating.

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

**And what it draws is four maps whose disagreement is the finding** (#28). A1 states a ceiling of
25 million and finds it costs **16 units**, spread 2.3:1; A2 and A3 state **12** and **14** and
come out at 3.1:1 and 3.5:1; A4 states 300 km to a capital, finds **10 units**, and comes out at
**68.8:1**. Read together they say three things no one of them says alone. A rule stated as a
*ceiling* binds the largest unit directly and produces a more even map than one stated as a
*count*, which only bounds the average — A1 is more even than A3 at more units. Fourteen provinces
are **less** even than twelve, because the extra capitals are seated where the population is
thinnest. And **contiguity is not what any of these rules trades away**: a unit is grown outward
across shared district borders and cannot be in two pieces, so every one of the four scores zero
non-contiguous units, and the quantity that actually moves between them is population parity — by
a factor of thirty between A1 and A4. That is said on the cards rather than left to be inferred,
because the obvious reading of "the scorecard shows the trade-off" is a trade-off against
contiguity, and there is none to show.

**The generated units are named for their capitals, and that is a decision rather than a
placeholder.** #27 left the naming to "reviewed copy" here; #28 did not write one, deliberately. A
unit is not the same unit from rule to rule — the one seated at Lahore is 2 districts under A1 and
17 under A4 — so a reviewed name would be a conclusion drawn about a shape that changes with the
rule, and inventing "Central Punjab" is exactly the editorial voice the engine exists to keep out.
The card says the name is a description of an output and not a name anybody uses for a place,
which is the answer L7 already gives its language regions. Two more costs are stated on the same
cards: the rule partitions the 136, so **Islamabad is inside a generated unit** and nothing here
preserves it as a federal territory, and **every census district counts as moved**, because not one
of them stays inside a unit carrying the name of the province it is in today.

**A5 is the variant that redraws nothing, and the one that settles open item 2b's near miss**
(#28). Gilgit-Baltistan and Azad Jammu & Kashmir become provinces; every boundary stays where it
is, the ceasefire line included, and the scorecard reads **nought districts moved** — the only
variant in the app of which that is true. Their **units** are `proposed` rather than `territory`, so
each takes the accent on its outline and on its name and is said to be a proposed province in the
card, the tooltip and the legend — which is the whole of what A5 argues, and the reason the
variant's scorecard counts nought districts moved rather than twenty.

**The hatched ground beneath them does not follow the unit kind, and this is a stated cost rather
than a claim.** The hatch is stratum 1 and the territory stroke stratum 2, and both are keyed on the
*geography bundle's* province kind — `land-${kind}` in `map.ts` against `.land-territory`, and the
`province-territory` rule beneath it — which is a fact about what Pakistan administers today and is
the same under every variant, exactly as the faded current boundaries are. So under A5 the two
territories are outlined and named as proposed provinces over ground still textured as territory.
The alternative is not obviously better: making the base map's texture answer to the active variant
would make stratum 1 a function of the selection, which is what D14 exists to prevent, and it would
mean the one variant that redraws nothing changed the drawing. It is left as it is, said here rather
than in the prose of a card. That is admitted with `TERRITORY_CLAIM_POLICY` still at **`forbid`**:
see open item 2b for why a promotion is not a claim. The two halves are **not equally sourced** and
the card says so at length — GB has a dated announcement, a drafted amendment and a resolution of
its own assembly; AJK has none of the three and provincial status for it is not government policy —
because drawing them identically and saying nothing would report the weaker claim as an equal one.
Both still carry no population, since PBS published none for either (D25): calling a territory a
province does not conjure a figure, and both are set aside from the spread by name.

**H2 is the map with no figures on it, and that is what lets it draw 1947 at all** (#30). It is the
oldest demarcation in the app — the four provinces with the eleven acceding princely states this
map can draw, from Bahawalpur and Khairpur through Kalat, Las Bela, Kharan and Makran to Swat, Dir,
Chitral, Hunza and Nagar — and the **only variant in the app that publishes no population figure
anywhere**: not on a unit, not as a total, not as a spread. 2023 figures counted people inside
districts that did not exist in 1947, in states abolished sixty-eight years before the count, so
attaching them would describe a Pakistan nobody has ever counted. The variant withholds them in its
own words, `scorecard.ts` voids the spread on the `variant` branch rather than the census one, and
the build gives **every unit of a withholding variant a `null` population** — the scorecard's
voided total is not enough on its own, because a unit's own line is a second place a figure appears.

**What it shows instead is ground, which is the half of #30's brief that took until #49 to land.**
Its scorecard prints an **Area** line where the two population lines would be — 796,096 km², the
whole of the census's Pakistan, since it is a complete partition of the drawn map — and each unit
prints its own: Bahawalpur 45,588 km², Punjab 160,663. Hunza, Nagar, the Gilgit Agency and Azad
Jammu & Kashmir print none, because PBS published no area for their districts any more than a
population (D25), and their existing line already says the census does not reach them rather than
saying it twice. Every figure is PBS's own from Table 1, never a measurement of the drawn polygons.

**A figure appears in a third place, and it took a review to find it: the district tooltip.** Its
figures were variant-blind, so tapping a district under H2 printed that district's 2023 count with
the 1947 unit named beside it — the exact claim the variant exists to refuse. The membership the
tooltip is handed now carries the variant's own reason, and where there is one the figures are
replaced by it. **Both figures go, not only the population.** That is a decision rather than a
reading of the ticket: the dominant-mother-tongue line quotes a headcount inside its own note
("of the N the census counted"), so dropping the population alone would leave a 2023 count on
screen under the sentence saying there are none — and "2023 census numbers do not describe 1947
boundaries" is as true of Table 11 as of Table 1.

That makes **three absences the tooltip words apart**, and none may share a sentence with another:
a district the census never reached (D25), a district it reached and named no dominant tongue for
(Chitral), and a district it reached whose figures *this variant* declines. The census's own
coverage is asked **first**, in the tooltip and on the card alike — a district PBS never counted has
no figure for a variant to withhold, and answering the withholding first would describe the census
as reaching ground it does not. So on H2 no unit carries a figure, and Punjab's is *declined* where
Azad Jammu & Kashmir's *does not exist*.

**Whether a variant withholds, and what its reason is, is asked once** (#48). `figuresWithheld` is
exported from beside the tooltip and answers for both surfaces — the card prints it above its units,
the tooltip prints it where the district's figures would be, and `main.ts` hands it over rather than
deriving it, exactly as it composes no sentence of its own. It was three ternaries over one field,
and the copy `main.ts` held was the one nothing asserted, since that file has no test seam by
design. That copy is still answered **structurally rather than by assertion** — re-inlining the
ternary there would leave the suite green, which is what having no seam costs — so what the one
export buys is that there is no second derivation left for it to disagree with. What the suite does
reach is held the way the regions list's standing words are: the card's sentence and the tooltip's
are both taken from the value the predicate returns and compared against **each other**, never each
against its own literal, because pinned to literals both pass while two vocabularies are live.

**H2's Punjab is `proposed`, and the reason is worth reading rather than assuming.** `unchanged`
prints one sentence — *Unchanged from the current map* — so it is a claim and not a default. The
rule this app states is that the unit called Punjab is Punjab **whatever it has lost**, which is why
Sindh and Balochistan stay `unchanged` here after losing Khairpur and the four Baloch states. But
H2's Punjab also *gains*: it holds the ground Islamabad Capital Territory now covers, which was part
of Rawalpindi district throughout this period, and gaining is not losing. A reader tapping Islamabad
was being told they were in a Punjab unchanged from today's, when today that ground is not Punjab at
all. The geography is right and unchanged; only the word was wrong, and it is the same correction
NWFP beside it already carried.

**Its `districtsMoved` figure does not move as a result, and that is the rule working rather than a
gap in it.** "Moved" is decided on a unit's **name** and never on its kind, so Punjab's 33 remaining
districts still carry the province forward and the count stays 59. Counting them would be the
alternative `scorecard.ts` rejects by name — "calls the twenty-five districts left in Punjab moved
when it is the province that shrank" — and it would break A5, whose two `proposed` units move nought
districts and are asserted to. The independence of `kind` from "moved" is load-bearing in both
directions and is now asserted from both ends.

**That absence is also what admits Hunza and Nagar, and it is the second narrowing of open item
2b.** Both were states in their own right and both are Gilgit-Baltistan districts today — two of
ten, so neither is a whole territory under its own name and A5's `promotedTerritoryOf` correctly
does not reach them. What admits them is `withoutModernFigures` in `scenarios.ts`, on the same
shape of argument #28 used: the *stated* reason `TERRITORY_CLAIM_POLICY` is `forbid` is arithmetic —
a unit holding *some* uncounted districts has a population short by an unknowable amount and looks
exactly like a unit whose population is right — and that reason cannot reach a variant with no
population figures to be short. **The width is stated rather than discovered:** this is the wider of
the two carve-outs, admitting *any* shape of territory claim on a withholding variant rather than
one named whole territory. What keeps it honest is that withholding is itself a loud declaration
with a reason printed where the figures would be, and that the reason is checked — a variant may not
buy the exception with a blank field. `TERRITORY_CLAIM_POLICY` is untouched at **`forbid`**, and 2b
is still open for the case it is actually about: a variant that carries figures and reaches in.

**Three things H2 says out loud rather than tidying away.** Its **Balochistan is the first genuinely
non-contiguous unit in the shipped set** — with Kalat, Las Bela, Kharan and Makran drawn around it,
**Awaran** touches no other district of the province it is left in. Flagged and drawn (D7), named on
the card, and the footnote says the stranding is this map's approximation of Kalat rather than the
1947 arrangement's. **Gwadar is drawn inside Makran and for part of the period was Omani** — the town
and its coastal strip were an exclave of Oman until 8 September 1958, after this map ends, and the
district cannot be split without inventing the boundary. And the **tribal agencies are drawn inside
North-West Frontier Province**, which they were not: they were federally administered throughout, and
separating them is H3's subject rather than this one's. Islamabad sits inside Punjab here for the
same class of reason — the capital territory was carved out of Rawalpindi district in 1960 — which is
the call H1 already made.

**Its districts-moved figure is 59 and decomposes into four things**, because the bare number reads
as a redraw of a third of the country: 22 districts drawn as princely states, 28 as North-West
Frontier Province (Khyber Pakhtunkhwa under the name it carried until 2010), 8 left in the Gilgit
Agency once Hunza and Nagar are drawn out of it, and Islamabad. Only the first group is ground held
by something other than a province; the rest is this map using the names of 1947, which the "moved"
rule counts because it decides what carries a unit forward on the unit's **name**. Azad Jammu &
Kashmir keeps its name and moves nothing. The four figures are on the card and the suite checks them
against the partition rather than against themselves.

**Every year H2's prose asserts is a year its sources reach**, which is the working agreement's
"no unsourced surface" applied to card copy rather than to badges — the check `context.ts` has
always made of the Durand footnote, generalised to variant cards. It is held over **every** variant
with the pre-existing gaps named one by one, on the same principle as the 390px list:
an exact list of known gaps fails when a new one appears, where a loosened check lets it through in
silence. Closing them is a ticket of its own and not #30's.

**And it asks the whole card, because for a year it asked five fields and claimed to ask all of
them** (#47). `unsourcedYears` read `rationale`, `status` and three kinds of note; `tagline`,
`opposedBy`, `advocacy` and a unit's `alsoKnownAs` are rendered copy and were not read, so the
test's own name and this file were both broader than the code. It now walks the **card
`variantCard` composes**, which is what makes a prose field added to the schema later covered by
construction rather than by somebody remembering this file: the walk takes whatever is in the
object. Two branches are left out and both are the other side of the question — `sources`, which is
what accounts for a year, and `basis`, whose gloss is the basis's own source line ("Documented past
demarcations, 1947 onward") and is not a dated claim H1 or H3 makes. Neither is put on the sourced
side either. Sentences `card.ts` composes for itself get no exemption: they quote the census's own
2023, and every variant's source list already reaches it because every one cites the PBS district
list — an exemption for the bundle's vintage was tried, changed nothing, and was taken out rather
than left as a hole. The residual is stated where the code is: a field the card renders without
putting it in the object would still be missed, and there is none, because `panel.ts` composes no
sentence of its own.

**What the widening found was on the line this app is least free to get wrong**, and it is closed by
a citation rather than by a wider list. H3's second **Opposed by** entry says that restoring the name
*Northern Areas* would undo "the provisional provincial status announced in 2020", and nothing in
H3's sources reached 2020 — the one piece of card copy where a variant could assert any year with
nothing checking it. A5 already carries the sourced form of that same fact, so H3 now cites **the
same line**: the announcement by Prime Minister Imran Khan of 1 November 2020 and the drafted
amendment prepared for it. Five gaps remain and each is named with the year it asserts: A1 to A3 and
**A5** assert 1970, H1 asserts 1961. A5's is the one the widening added — its note is titled
*Relationship to the 1970 restoration*, which is H3's own name, and A5 cites nothing dated 1970. It
is the same class as the other four, a content edit on somebody else's variant, and is left named
rather than tidied away by loosening the check.

**The mother-tongue rule engine draws the two Language variants nobody published** (#26).
`scripts/lib/mother-tongue-partition.ts` assigns each district to the region of its dominant
mother tongue in Table 11, then splits each language into the **connected groups its districts
actually form** across #16's shared borders — so contiguity is the method rather than a filter,
and Balochi comes out as two regions (the Makran coast and the Nasirabad plains, with the Brahvi
belt between) instead of one province in two pieces. L6 is that rule run over Balochistan's 34
districts, taking the Pushto region: twelve districts, one connected group, 6,163,599 people — the
whole of Quetta and Zhob divisions, three of Loralai's four (Barkhan is Balochi-plurality), and
Harnai and Ziarat out of Sibi's five, with the Brahvi belt outside it entire.
L7 is the same rule run over all 136, and it is the only variant in the app **nobody advocates** —
so it says so in the advocacy's own words and points at the attributed claims its output resembles
rather than taking credit for their politics.

Three absences the engine keeps apart, none of them a zero. A district the census does not reach
(AJK's ten and GB's ten, D25) is **refused by name** if it is handed to the engine at all. A
district the census reaches and names no dominant tongue for — Upper and Lower Chitral, since
Khowar has no column — is returned **unassigned**, and L7 draws the two as a unit that says on the
card why the rule does not reach them; the build fails if that set is ever anything but those two,
because the copy names Khowar and Chitral in so many words. And a residual is not a language: the
census join already refuses to let `Others` win a dominance, so nothing here special-cases it.

The rule is run to the end without being stopped anywhere it produces something awkward, and it
produces two things nobody would propose: **Keamari** as a Pashto region of one district inside
Karachi (Pushto is the largest single mother tongue there at 33.1%, a plurality where nothing has
a majority) and **Hyderabad** as an Urdu region detached from Karachi's, the districts between them
being Sindhi-plurality. Both are drawn rather than absorbed into a neighbour, because absorbing
them would be a second rule with nothing behind it but our sense of how a map should look.

**The development composite is the app's one `synthesized` figure, and it is baked in an artifact of
its own** (#31). PBS publishes literacy, improved drinking water and toilet facilities; it publishes
no index over them and nor does anybody else at this vintage, so `scripts/lib/development-index.ts`
defines one — the **unweighted mean of the three published rates**, each keeping the denominator PBS
gave it. Three choices, each made the way this repo makes them: **unweighted**, because a weighted
mean is a claim that literacy is worth some stated amount more than a toilet and no source states
that number; **over PBS's own denominators**, which are not one denominator — literacy is over
people aged 10 and above, the other two over the housing tables' households — so the result is
called an *index* and never a rate; and **not re-scaled to the observed range**, or a district's
score would move because another district moved and the legend would mean something different at
each census.

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
preference: see the palette note in **Stack**.

**The third component is flush toilets, named as such, everywhere.** PBS classifies water sources as
improved or not and prints the result; for toilets it prints only flush / non-flush / none, and a
non-flush toilet may be improved or not. There is no improved-*sanitation* column to average in, and
adding flush to non-flush would be a definition of ours inside a composite of ours — a judgement
squared, and invisible. The tooltip, the card and the About panel each say so where the figure is.

**And it is not a poverty measure**, which is said on the card, in the colophon and on the panel
rather than assumed. The census sees service access and attainment; it does not ask about income,
consumption, child mortality or nutrition. The suite holds the word out of every development
surface, and the two places the card does use it are the sentences refusing it.

Shared pure logic lives in `scripts/lib/` with tests beside it.

**D1 is the variant that composite draws** (#31) — each province cut in two where the census says
its internal gradient of service access divides most sharply, and the last of the seventeen.
`scripts/lib/development-partition.ts` computes it in two steps. The lower unit grows outward from
the province's lowest-scoring district across shared district borders, taking the lowest-scoring
district on its edge each time, so **every candidate cut is connected by construction** — and the
*complement* is checked too, since a whole lower half can still leave the rest of a province in two
pieces, and such a cut is simply not a candidate. Among those cuts the rule takes the
**one-dimensional natural break**, `k(n−k)(mean high − mean low)² ÷ n²`, which is Fisher's and
Jenks's criterion and not ours. The obvious reading of "steepest" — the largest single step between
two consecutive districts — was tried and rejected on the data: it peels off one district per
province (Punjab would be Rajanpur and everything else), because a largest gap finds an outlier
where a natural break finds a division. The cost of the choice is stated on the card: in **Punjab**
the two districts either side of the break are 0.2 points apart, because Punjab's gradient is a long
smooth slope rather than a cliff, so what the rule finds there is where the province divides most
cleanly overall and not where two neighbours differ most.

**What it draws is 11 units and one finding that is only half the finding #31 expected.** Eight
halves out of the four provinces, named for the most populous district in each — Shangla and
Peshawar, Rahim Yar Khan and Lahore, Sanghar and Karachi East, Khuzdar and Quetta — plus
Islamabad Capital Territory, which is a single district with no internal gradient and is carried
through unchanged, plus the two territories, which have no index at all because PBS published none
of the three rates for their twenty districts (D25). 135 of 156 districts move, every census
district but Islamabad's, for the reason A1 to A4 already give: not one of the eight halves carries
the name of the province it came out of. Spread 39.3 : 1, and **nought non-contiguous units**,
because contiguity is the method here as it is in the other two engines.

**Punjab is the case the ticket was right about and Sindh and Balochistan are not, and the card says
so rather than the rule being tuned until they are.** The lower half of Punjab contains **9 of South
Punjab's 11 drawn districts** — all but Multan and Khanewal — and adds the Thal, including exactly
the two districts (Mianwali and Bhakkar) that L2's wider reading of the Seraiki claim adds. That
convergence is computed from L1's own district list in the same run rather than asserted, because it
is the sentence on that card most able to become false without anybody noticing. What separates in
**Sindh** is the south-east — Tharparkar, Umerkot, Badin, Mirpur Khas, Sanghar, Sujawal, Thatta and
Tando Mohammad Khan — and not the interior against Karachi; in **Balochistan** it is a belt
running from the eastern districts south-west through the Kalat highlands, and not everything
outside Quetta. A rule adjusted to agree
with the claims it is meant to be independent of has nothing left to say about them.

Every relation must be classified. A relation matching no 2023 district and no fold rule
**fails the build** rather than being skipped — a silent discard is how the district set drifts
without anyone noticing, and the point of committing the bundle is that boundary changes are
reviewable diffs.

Committing the output means **every boundary change is a reviewable diff with a date on it**.
Runtime makes zero network calls.

> Overpass is rate-limited and periodically down. Build-time problem only — and the reason
> runtime fetching was rejected: upstream OSM edits would silently mutate boundaries between
> page loads.

