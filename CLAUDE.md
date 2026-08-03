# pakistan-map

Interactive single-page explorer for proposals to redraw Pakistan's provinces.

**Status:** design agreed, **scenario content complete — all 17 variants are in the typed module**
(the whole Language basis, L1 to L7, the whole Administrative one, A1 to A5, the whole Historical
one, H1 to H4, and the Development basis's D1; `SCENARIOS-DRAFT.md` is deleted, which is #36). L2 and
L3 are the two wider readings of the Seraiki claim, and L3 is the one *transcribed* proposal whose
province crosses an existing provincial boundary; L6 and L7 are the first two variants this build
**draws itself**, from census plurality rather than from anybody's document, A1 to A4 are the
four the rule engine draws from population and distance, and D1 is the one cut at a figure this
project defines rather than one anybody published — seven derived boundaries in all, every one
of them re-derived by the suite. A5 is the one variant that redraws nothing: it promotes
Gilgit-Baltistan and Azad Kashmir to provinces and moves not a single district, and H2 is the
oldest map in the app and the only one carrying **no population figure at all**. Pipeline and
bundle built, the map built through its **three strata with the basis
and variant selectors** (#18) over its **neighbour silhouettes and city dots** (#8), the
**variant card** rendering beside it (#19), the **adjacency graph** flagging each unit's
contiguity (#16), the **scorecard** (#20) carrying the figures a proposal is judged on, the
**compare gesture** holding a proposal off the map (#22), every view carrying a **deep link**
of its own (#23), the **About the data** panel (#21) putting every source, its vintage and the
bundle's own build dates on one auditable surface, the **phone adaptation** (#33) turning the
card into a draggable bottom sheet and hover into tap, and the **Development basis** (#31) shading
the country by the app's one **`synthesized`** figure — a composite of three published census
rates that nobody else publishes — with **two of the four bases now drawable**.

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
| **Administrative** | 2023 census population + derived geometry | `census` · `derived` |
| **Historical** | Documented past demarcations, 1947 onward | `documented` |
| **Development** | PBS 2023 Census Tables 12, 23, 24 — literacy (10+), improved drinking water, households with a flush toilet — shaded by **the unweighted mean of the three** | `census` · `synthesized` (#31) |

The Development basis is the only one carrying **two badges for one fill**, and the pair is the
point: the three rates are PBS's to the household, and the mean of them is **this project's own
figure, which nobody publishes**. `census` alone would pass our arithmetic off as the census's;
`synthesized` alone would disown figures PBS counted one household at a time. It is also the only
basis whose shading is not somebody else's number, which is why the composite states its formula on
the card, in the legend, in the colophon, on the export band and on every tooltip that prints it.

A basis carries a **vintage** as well as a badge and a source (#21), and the field is checked
rather than assumed: a badge says which *kind* of claim a shading is and the vintage says which
census, and either alone is half a provenance. Three of the four declare exactly the project's one
vintage (D24, ADR-0001) and a `census` badge at any other date fails the build naming the basis;
Historical is the exception the rule allows for, since its demarcations are dated one by one, so it
declares that and each variant carries its own document's date. A variant may carry a `vintage` of
its own for the same reason — H2 draws 1947 — and where it does not, it is read at its basis's and
the resolution says so, so that no surface prints the census's year against a boundary the census
had nothing to do with.

**Every Historical variant must date itself, and the build now says so.** Its basis declares a rule
for finding a date rather than a date, so a Historical variant that states none resolves to a
sentence where a date should be — *"stated per variant, not shared"*, printed against a variant that
states nothing. H1 is dated **14 October 1955 to 30 June 1970**, the fifteen years One Unit was in
force, and H3 **1 July 1970**, the four provinces as restored when it was dissolved. H4 is dated
differently on purpose: it is the one Historical variant whose *boundary* is not historical, since
what is drawn is Bahawalpur Division as PBS publishes it **today** — so its vintage is the district
set's, and the 1947–1955 province is the claim's history rather than its geometry. Dating it 1947
would say the app had drawn the 1947 state, which it has not.

The field also has to **survive the bake**, which it did not until #32 went looking for one. The
schema has carried an optional `vintage` since it was written and the validator has always checked
it, so the module was right and every content review passed; `build-scenarios.ts` simply never
emitted it, so every variant reached the runtime dated at its basis and nothing went red — because
until the PNG band, no surface printed a variant's date. It is written **only where the variant
states one**, since an absent field is the signal to read the basis's, and the suite compares the
two sides of the bake rather than asking the artifact whether it agrees with itself.

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
| District boundaries | OSM `admin_level=6` | Fetch returns ~170 current-day; dissolved to the 136-district 2023 census set (ADR-0001). **Not** geoBoundaries — its PD set is 2019/126 districts, ~40 short. **Names are never trusted alone.** Matching is normalized-name-plus-alias, with relation ids overriding it wherever a name lies or collides — Karachi's four renamed districts, and every AJK district, whose names recur across the Line of Control. Anything unmatched fails the build. PBS's own documents disagree with each other on spelling, and OSM's primary `name` on AJK districts is Urdu. Only the English name is carried into the bundle and only the English name is displayed — OSM's `name:ur` is deliberately not surfaced. And where OSM's English name and the territory's own government disagree, **the official name is displayed and OSM's is the alias**, never the other way round (#46): the join is on the relation id, so the display name costs the geometry nothing |
| Coastline | OSM `natural=coastline` | A way network, not a relation: chained on shared node ids with direction preserved (**land lies to the LEFT**), the open coast closed against a lon/lat extent, islands added as land. District polygons are clipped to it where their bounding box meets the shoreline's — one rectangle over the whole coast, so it nominates ~23 of the 156 districts including a dozen plainly landlocked ones, which clip to a no-op. Biased that way deliberately: a false positive costs nothing, a false negative would leave sea drawn as land. Natural Earth was rejected — a second lineage at a different vintage, against ADR-0001; OSM keeps one of each |
| Line of Control | OSM, derived — not traced | A *segment* of the boundary we already draw, named by identity rather than by geometry: a way that belongs both to a drawn AJK/GB district relation and to India's own `admin_level=4` Jammu and Kashmir or Ladakh (strays the bbox fetch already caches) is on the line. 69 such ways, chaining into one 940 km run, emitted into the **same topology as the polygons** so line and boundary share arcs. Two exclusions fall out of the rule rather than being applied on top of it: Sialkot's and Narowal's shared ways are the **Working Boundary**, not the ceasefire line, and are excluded because Punjab is a province; GB's Karakoram frontier is shared with nobody in the cache. Its northern end, beyond NJ9842 in the Siachen area, was never delimited even as a ceasefire line — stated in copy, not smoothed over |
| Neighbour silhouettes | OSM `admin_level=2`, `ISO3166-1` in {AF, CN, IN, IR} | The four countries Pakistan borders, drawn faint and unlabelled so the outline — and the dashed ceasefire line above all — has ground on the far side of it rather than blank paper, which reads as a coast. Fetched **whole** and cut here, the opposite way round from the coastline and for the reason D12 gives: a country's silhouette is a closed polygon, and asking Overpass only for the ways near Pakistan returns an open run of boundary whose closure means choosing which side of it is the country — a decision with no source behind it. So the polygon comes from OSM closed and is intersected with a rectangle, and the rectangle is the only judgement. OSM draws these four **as administered, not as claimed**: India stops at the same Line of Control this app draws dashed, China covers Aksai Chin, and neither reaches over AJK or GB — checked against all 156 drawn districts rather than assumed, because a neighbour drawn over ground the map calls Pakistan-administered would be a claim made by accident |
| City dots | OSM `admin_centre`, per first-level relation | **"Major" is answered administratively because it cannot be answered demographically.** PBS publishes the 2023 census by district and a city is not a district — Karachi is seven of them and Islamabad *is* one — so no city population exists at this vintage from this source, and the governing rule is that data we do not have is not used. Ranking by OSM's own `population` tags would put a second lineage at an unstated vintage under a dot. The criterion is therefore **the seat of a first-level unit**: four provincial capitals, the federal capital, and each territory's capital. Seven dots, badged `official`; the position is the node the unit's *own* boundary relation names as its `admin_centre`, so a dot joins a unit by identity and not by a matching name. The cost is stated rather than hidden — Faisalabad, Rawalpindi, Gujranwala and Multan are larger than three of the seven and are not drawn, because a set mixing "capital" with "large" would be two criteria wearing one badge |
| District areas | PBS 2023 Census **Table 1** | Published per district, per province. What the clipped geometry is measured against — and, since #49, a figure the app itself prints. Area is the **one Table 1 column `PakPC2023` does not republish**: its district table carries households, population and growth rates and no area, so the 136 figures are transcribed from the five PDFs PBS publishes Table 1 as and committed to `data/reference/pbs-table-1-district-areas.json`. Same source, same table, same vintage as the population beside it, reached a different way because the structured release drops the column. **Published, never measured**: the drawn districts are clipped to OSM's coastline and knowingly disagree with these figures — Gwadar read 25,913 km² against a published 12,637 before the clip — so measuring the polygons would put a number of ours under a `census` badge. Anchored the way the populations are, and it has to be, since a person typed it: the 136 sum exactly to each of the **five published province areas** and to the **796,096 km²** Table 1 prints for Pakistan. And each row carries the population Table 1 prints **beside** the area, read into no artifact and existing only so a row can be *shown* to be the district it claims to be — two areas swapped between neighbours sum to their province exactly and would otherwise pass. 128 of the 136 agree with the package to the person; the **eight that do not are PBS's own two releases disagreeing**, in four cancelling pairs of neighbours (Jhang/Toba Tek Singh, Karachi East/Malir, Kalat/Surab, Kachhi/Nasirabad), pinned per district and on the About panel |
| Population | PBS 2023 Digital Census | District level. Extracted from the `PakPC2023` `.RData` tables, committed as upstream bytes in `data/raw/pakpc2023-*.RData` and parsed by `scripts/lib/rdata.ts`, so the numbers trace to a published file rather than to a transcription. **Anchored outside the package** at exactly two tiers: the 5 province totals and the 241,499,431 national total, typed from PBS Census-2023 **Table 1 (national)** — both agree exactly. The **31 division totals** are checked against `pakpc2023-division.RData`, i.e. against another table of the same package whose district table is being validated: a cross-table consistency check, **not** an independent source. A division figure wrong in the package would agree with itself and pass. PBS publishes no division tier in Table 1 |
| Mother tongue | PBS 2023 Census **Table 11** | The structured release carries **tehsil rows only** — no district tier — so districts are summed from the 591 units under them, keyed on the table's own 136 district names. Safe because the sums reconcile exactly against PBS's printed province figures in **all fifteen categories**, typed from `table_11_national.pdf`: column by column, because a tehsil summed into the wrong district inside a province moves whole languages and leaves the total intact. Categories are the census's own, unmerged, including its spelling `Kohiostani`; an unknown one fails the build rather than falling into `Others`. Table 11's universe is **240,458,089** — 1,041,342 below Table 1, a difference PBS shares with Table 10 and does not explain, so it is stated and not closed. Khowar has no column, so **Chitral has no dominant language** and says so. See `docs/research/mother-tongue-table-11.md` |
| Development | PBS 2023 Census **Tables 12, 23 and 24** | Literacy (10+), improved drinking water, toilet facilities. Like Table 11 the structured release is **tehsil rows only**, so all three are summed from the 591 units and reconciled on **counts, not rates** — a province literacy rate is population-weighted and unrecoverable from district rates, so both halves of every rate are checked against the figures typed from the three `*_national.pdf` files. Seven of the eight counts reconcile exactly; **improved water does not** — PBS's tehsil rows count 6,374 more improved-water households than PBS's own printed province rows, a reclassification between sources that leaves the household totals exact. The deltas are pinned per province and any other value fails the build. **PBS publishes no improved-*sanitation* column:** it classifies water sources as improved or not, but for toilets prints only flush / non-flush / none, and a non-flush toilet may be improved or not. So the shaded share is **flush toilets, named as such**; combining them would be our definition wearing a `census` badge (that is #31, `synthesized`). Each rate keeps its own denominator — population 10+ for literacy, the **housing tables'** households for the other two, which are 48,010 below the district table's in all 136 districts. **Named *Development*, not *Poverty*:** the census sees service access, not income, consumption, child mortality or nutrition. MPI was dropped in favour of one source and one vintage. **The composite over the three is #31's**, is the unweighted mean of them, is badged `synthesized` and lives in an artifact of its own — see the Development composite note below. See `docs/research/development-indicators.md` |

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

- **AJK and Gilgit-Baltistan** drawn and named, styled as **territories, not provinces** —
  constitutionally they are not provinces. The distinction is carried by **texture, not by
  weight**: a hatched ground at a pitch counter-scaled against the zoom, and the *same* rule at
  the *same* weight as a province. A fainter or thinner outline is legible and says the wrong
  thing — provisional, or not quite ours — about ground Pakistan administers. **Not fully
  interactive:** PBS's 2023 results cover 136 districts — the four provinces and ICT only — so
  no AJK or GB district has a mother tongue, literacy, water or sanitation figure — and so none has
  a development composite either (#31), since a mean of three absent rates is not a low score but no
  score. They cannot
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
  announced 1 November 2020; GBLA resolution), so it's a switchable variant: **A5** (#28), which
  promotes Gilgit-Baltistan *and* Azad Kashmir and states plainly that the second claim is the
  weaker of the two. Nothing about the rendering of the ceasefire line changes there — the arcs
  are held out of every unit outline whatever the unit is called or classed, so a variant arguing
  for provincial status cannot put a solid international border along a line this app draws
  dashed.
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
  "proposed — not official" (#32). This content will travel as WhatsApp and X screenshots
  regardless; the sanctioned export exists so circulating copies carry their own disclaimer.
  A 2× raster of the current view with a footer band under it, produced **entirely on the
  machine** — the SVG is serialised into a `data:` URL, decoded by an `<img>` and read back off a
  canvas, so no server ever sees a reader's composition of a politically live picture (D19).

  Five things the band settles that a source list would not. **The standing line is not
  conditional prose**: every band carries one, and it says which of the two maps this is — a
  proposal says *Proposed — not official*, and the baseline says it is the official geography,
  because an export of the real provinces stamped "not official" would be this app disclaiming the
  government's own map. It is set in the accent **only when something is proposed**, since the
  accent means exactly that everywhere else. **An inherited vintage says whose it is, and a basis
  with no date to lend says that instead** — the Historical basis's declared vintage is not a date
  but the rule for finding one ("stated per variant, not shared"), so H1, H3 and H4 print *the date
  of this proposal's own source* and point at the Source line, where 1947, 1955 and 1970 actually
  are; quoting the deferral after "Vintage:" would put a sentence on the image saying the date is
  stated per variant, on a variant that states none. **The key is derived, never transcribed**,
  from the same `unitLegend`, `motherTongueLegend` and — since #31 — `developmentLegend` the
  on-screen legend is built from, less the six categories dominant in no district, which on a band
  would push the nine that matter onto a line of their own. It still **refuses by name** a basis it
  has no fill for: two of the four have one now and two do not, and a band that answered every
  shadeable basis with the mother-tongue key would print the wrong legend under the right badge.
  The development key is the four bands and the one absence, in the order the scale is read; the
  sentence saying no published source states the figure is deliberately *not* a key entry, because
  it is the badge's gloss and the band already prints that under Provenance. And **the badges are
  glossed in the image**, because a PNG has no hover and a provenance word a reader cannot check is
  a claim. And **the small print names no figure source the variant does not use** (#49): the licence
  line credited every picture's figures to the 2023 census and stamped it *pinned to* that vintage,
  H2's included — a provenance claim on the one variant whose whole argument is that 2023 numbers do
  not describe 1947 boundaries, printed where nothing beside the image can correct it. It is not a
  figure leaking, which is why #30's checks did not catch it. So the line has two forms and only one
  half of it is conditional: **every** band credits the boundaries to OpenStreetMap under ODbL and
  the **district set** to PBS's 2023 census — both true of every picture here, since the 156 drawn
  districts *are* the census's set under ADR-0001, which is why even H4 dates itself by the district
  set — and a variant that withholds says it carries no census figures instead of crediting figures
  it does not print. Dropping the line was not an option: the boundaries come under a licence that
  requires it. Which form a band takes is asked of **`figuresWithheld`** (#48), not of the field, so
  the image, the card and the tooltip cannot answer the withholding question three ways.

  **The band describes the picture, never the selection**, which is the one place this could have
  gone badly wrong. While compare is held the map has been given the baseline whole (#22), so a band
  built from the selection would caption the real provinces with a proposal's name, badge it and
  stamp it *Proposed — not official* — the single most damaging image this app could emit, and
  exactly the thing the ticket exists to prevent. So the export asks what the *map* is showing and
  gets the baseline's own band while the comparison is held; `shadedBy` is the renderer's answer for
  the same reason, since three of the four bases can be selected and shade nothing, and the band
  **refuses by name** to key a basis it has no fill for rather than printing one basis's colours
  under another's title.

  Two things had to be got right about the picture rather than the words, and both are stated
  because both were wrong first. The crop is the union of the drawn land **and every name and dot
  over it**, clipped to the frame — the ceasefire line's name is deliberately placed on clear paper
  beside the line, and a crop taken to the coastline slices it off the one copy that travels with
  nothing to explain the dash. And the export **photographs a settled map, never a cross-fade**:
  the strata fade in CSS and the outlines in the renderer, so both are stilled for the length of one
  read — otherwise pressing Download within `--switch` of a variant change bakes one proposal half
  dissolved into another, with nothing in the picture to say so. Stilling is `map.photograph`'s, a
  callback rather than a getter, because stilling the map and reading it have to be one operation
  and the knowledge of what animates belongs in the file that animates it. The band also defines its
  **own** hatch and stipple: the map's are counter-scaled by 1/k so their texture survives a 24×
  zoom, which is right inside the zoomed group and wrong in a legend, where it would collapse the
  pitch to a fraction of a pixel and leave a swatch keying nothing.

  The words and the arithmetic are decided in `src/lib/export-band.ts`, under test; the crop is
  `map.image()`'s; `src/export-image.ts` rasterises and composes no sentence of its own, exactly as
  `panel.ts` composes none of the card's.
- **Naming:** units named as *their own advocates* name them, alternatives shown in the card
  ("South Punjab (also: Saraikistan, Saraiki Wasaib)"). The app reports what people call
  things; it doesn't adjudicate.
- **Every scenario card carries an "Opposed by" line.** Without it the app reads as advocating
  whatever is on screen.

---

## Stack

- **Vanilla TypeScript + Vite + D3.** No framework — runtime state is six values (active
  basis, active variant, hovered district, compare-held, whether the division tier is drawn, and on
  a phone the sheet's detent); no async, no forms. Routing is the URL hash and nothing else (#23): one parser, one `hashchange`
  listener, no router.

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
  No dark mode in v1 — categorical palettes are harder to keep distinguishable on dark, and
  the editorial register signals *reference* rather than *toy* on a politically live subject.
- Palette validated via the `dataviz` skill for colourblind safety — and the validation lives in
  the suite (`src/lib/colour-vision.ts` + `palette.test.ts`), re-derived from the hexes on every
  run, because a palette checked once at authoring time and never again is a palette nobody can
  change safely. **Fifteen categories is past what any categorical palette separates pairwise**,
  so the gate is held on the pairs that actually share a border on the map — geography, not a
  scatter plot, decides which two fills a reader ever sees touching — and the pairs that fail
  when any two swatches sit side by side are named in `palette.ts` rather than left to be found.
- **The Development ramp is the one sequential scale, and it is held to a sequential scale's
  criteria** (#31). Lightness falls and chroma rises monotonically from the lowest band to the
  highest along a green-to-blue path — the order *is* the encoding, and a reader reads it against
  the legend in order rather than by recalling an absolute hue. It has about **0.14 of OKLab
  lightness to spend**, bounded below by the rule that a fill must clear 3:1 against the unit accent
  and above by the rule that it must not be mistakable for an unshaded district, and four steps
  inside that window are 0.042 apart. So **no two adjacent bands reach the ΔE the categorical
  palette is held to**, which is stated in `palette.ts` and asserted in the suite rather than
  smoothed over: the weakest step is named, the ends of the ramp clear every gate including for
  dichromats, and the relief is that every band is labelled with its own numbers in the legend and
  the tooltip prints the district's composite *and* its three components. It is also why there are
  four bands and not five.
- **Responsive, and the phone is not the degraded case** (#33). Hard bar: **map legible and
  variant switching functional at 390px.** Pakistan's internet is overwhelmingly mobile-first, so
  this is where most of the audience meets the app. Panel becomes a bottom sheet; hover becomes
  tap; `Space` becomes a button. Where the bar is **not** met it is met by name and not by silence:
  the seven unit labels A1 to A3 and H2 cannot set at this size are listed one by one in
  the suite, with what a reader gets instead — see the labelling section. It was twenty-one across
  nine variants before #51. The breakpoint is stated **once, in the stylesheet** (`--sheet`)
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

   **Half of it was applied backwards for a year, and the correction is #46.** Sudhnoti landed;
   Jhelum Valley did not — the roster carried OSM's *Hattian Bala*, which is the headquarters
   town and the tehsil, and aliased the AJK government's own name onto it. So the app displayed
   the wrong name for the district on precisely the ground it is least free to get wrong. The
   fix costs nothing but a rebake, because the join was never on the name: every AJK district is
   pinned by relation id, so inverting the pair left the geometry byte-identical and moved 68
   strings in `scenarios.json`, four in `adjacency.json` — a key and three neighbour entries,
   since that graph is keyed on names — and every rendered surface behind them. What is new is
   the **guard**: `reconcile.test.ts` now asserts the rule in both
   directions — the alias's *value* is what is displayed, its *key* is only how somebody else
   spells it, and no alias key may normalize to a name the roster displays. That general rule
   catches the *half* inversion and **not** a clean one of both sides at once, which is a
   well-formed table saying the wrong thing; the named pair is what catches that, and the two
   are kept apart here rather than the guard being described as more than it is. **Neelum was checked
   with it and was half missing**: the canonical name was right, OSM's *Neelam Valley* was
   aliased, and the AJK Election Commission's *District Neelum Valley* was not. A canonical name
   being correct is no evidence that its aliases exist, which is why the two are asserted apart.
2. ~~**Balochistan's division and district set** needs verification~~ — **resolved.** 8
   divisions, 34 districts, proved complete by population sum. Surab is *not* new (draw it);
   Taftan is not a district at all. See `docs/research/balochistan-division-district-set.md`.
   The current-day 41-district roster remains unresolvable without the provincial gazette —
   which no longer blocks anything, since under ADR-0001 none of it is drawn.
2b. **Can a variant claim AJK or GB territory?** Those districts are drawn but unshaded and carry
   no PBS-direct statistics. Product decision outstanding — the
   build's provisional answer is **no**: `TERRITORY_CLAIM_POLICY` is `forbid`, so the first
   variant that needs it fails loudly naming the district instead of settling a constitutional
   question by accident. Both answers are expressible and both are tested.

   **Two narrowings have been made and neither is an answer to it.** Both take the *stated* reason
   for `forbid` — which is arithmetic, and only arithmetic — and observe that it does not reach a
   particular shape. Both are made out loud, tested at both seams, and asserted to fire for exactly
   the units they were written for, since an exclusion that never excludes anything passes a test
   perfectly. The question 2b actually asks is still open, and what still asks it is a hypothetical
   rather than a shipped variant: **a unit that carries population figures and reaches into ground
   the census does not cover.** Nothing in the app does that, and the build would refuse it by name.

   **A5 (#28) does not move it, and the reason is worth reading rather than assuming.** A5
   promotes both territories to provinces, which looks like the case this policy forbids and is
   not. The stated reason for `forbid` is arithmetic: those districts carry no PBS statistic, so a
   unit holding *some* of them has a population short by an unknowable amount and looks exactly
   like a unit whose population is right. That reason does not reach a unit that is **one
   territory's whole district set under that territory's own name** — nothing is taken from
   anybody, no boundary moves, and the population is not short but absent, which the scorecard
   already sets aside by name exactly as it does for a `territory` unit. So `promotedTerritoryOf`
   in `scenarios.ts` admits that one shape and the policy is untouched. Three conditions, each
   load-bearing: **exactly one territory** (nine of GB's ten is reaching in), **whole** (ten of
   them plus a Punjab district is a population that is short), and **under its own name** (moved
   districts are decided on a unit's name, so a territory promoted *and* renamed would read as ten
   districts changing hands when none has, and is refused rather than counted wrongly). The
   narrowing is a change to what counts as a *claim*, made out loud and tested at both seams.

   **H2 (#30) is the second, and it is the wider of the two.** It draws Hunza and Nagar as the
   princely states they were, and both are Gilgit-Baltistan districts today — two of ten, so
   `promotedTerritoryOf` does not reach them and should not: a promotion is a change of standing,
   and this is a demarcation predating the territory it sits inside. What admits them is
   `withoutModernFigures`: H2 publishes **no population figure anywhere**, so it has no unit whose
   population can be short by an unknowable amount, and the arithmetic reason has nothing to
   protect. Unlike the promotion carve-out this one is about the *variant* rather than the unit, so
   it admits any shape of territory claim on a variant that withholds — stated here rather than
   discovered later. What keeps it honest is that withholding is a declaration with a reason
   printed on the card where the figures would be, and that the reason is checked: a variant may
   not buy the exception with a blank field, and a variant that carries figures is refused exactly
   as before.
3. **Deployment target** — deliberately undecided. Static bundle, builds to `dist/`.
4. ~~**`SCENARIOS-DRAFT.md` is temporary.**~~ — **resolved (#36).** The typed data module
   (`scripts/lib/variants.ts`, schema in `scripts/lib/scenarios.ts`) carries all seventeen variants,
   D1 last (#31), and the markdown is **deleted** — recoverable at
   `git show 20c2f67:SCENARIOS-DRAFT.md`, deleted in `728faf0`. Keeping both would have been two
   sources of truth, and the draft had already drifted from the build in the one place it mattered
   most: it named the third development indicator "improved sanitation", which is a column PBS does
   not publish, and the shipped basis shades by the flush-toilet share and says so.

   **The deletion was made before the audit that should have gated it, so the audit was done
   afterwards and written down**: `docs/research/scenario-migration.md` reconciles all seventeen
   variants field by field — rationale, status, boundary provenance, advocates, opposition,
   alternative names, units, footnotes and sources — and separates the three outcomes by name.
   *Carried*, which is nearly all of it. *Drift*, nine places where the two disagree and the module
   is right, each recorded rather than "restored", since restoring a falsehood is not migration:
   the sanitation column above, A1's "~9 units" against the 16 the ceiling actually costs, D1's
   claim to reproduce three regions when it reproduces one, five unit counts that counted only the
   units their prose was about (H1, H3, H4, A5 and L7, the last also predicting three Balochi
   regions where the rule finds two), L7's badge,
   L3's Waziristan percentage, A5's "26th Amendment" — a number since taken by a different
   instrument — and two political assertions narrowed to what a source carries. And *not migrated*,
   the draft-process material that is not variant content, each with its reason, the largest being
   two anchoring figures that would have had to be asserted without a source. **Nothing in the draft
   was found to be content the module lacks**, so nothing was restored into `variants.ts`; what the
   audit added is the record, and a suite check so the claim does not depend on it being re-read.

5. **`GB` as Gilgit-Baltistan's short form is unconfirmed.** Added for #34, where the alternative
   was leaving the territory drawn and anonymous at 390px — the one thing the politically sensitive
   rendering section forbids. Every other entry in `SHORT_FORMS` names a publishing agency; this one
   rests on general usage by the territory's own government and assembly. It wants the treatment
   open item 1 gave AJK's district names: a check against a published document, recorded in
   `docs/research/`. Related, and the owner's call rather than the build's: **what H3's advocates
   call the *Northern Areas* short**, what H2's ***Gilgit Agency and Baltistan*** is called short —
   at 279px the longest unit name in the app, and the second territory this build cannot name at the
   bar (#30) — and what L7's *Pushto (Keamari)* and *Kohiostani* are called short, since without
   attested forms those four cannot be named at the 390px bar at all. All
   four are named at desktop size, so this is a legibility gap on one device rather than a unit
   the app cannot draw. **H2's *Khairpur*, *Dir* and *Nagar* are not this item**: they are proposed
   units already at their shortest true names, crowded out by neighbours the same size, which is the
   A1-to-A3 case below rather than a missing source.

   **A1 to A3's fourteen unnamed units are not this open item**, and filing them here would be asking
   a question with no one to answer it (#28). A rule-drawn unit has no advocates to have a short
   form: the engine names each after its capital district, so *Gujranwala* and *Faisalabad* are
   already the shortest true names those units have. Nothing is outstanding — the bar is simply not
   met for those three variants, which is stated where the labelling doctrine is rather than left
   waiting on a source that does not exist.

**Scenario content: 17 variants approved, 17 built** — Language 7, Administrative 5, Historical 4,
Development 1. Nothing is outstanding, and `SCENARIOS-DRAFT.md` is deleted (#36): the typed module
is the only source of scenario content, and `docs/research/scenario-migration.md` is the
variant-by-variant record of what the draft said and where it went. H2 omits Amb and Phulra (sub-district, cannot be drawn
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

## Agent skills

### Issue tracker

Issues live as GitHub issues in [AbuBakrCh/pakistan-map](https://github.com/AbuBakrCh/pakistan-map), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
