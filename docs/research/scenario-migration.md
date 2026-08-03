# Retiring `SCENARIOS-DRAFT.md` — the field-by-field reconciliation

What the deleted scenario markdown said, what the typed module says now, and where the two
disagree. Written for #36, whose acceptance criterion with teeth is *no sources or footnotes are
lost in the migration* — a claim that until this file existed rested on an agent's say-so.

## The two artefacts being compared

| | |
|---|---|
| The draft | `SCENARIOS-DRAFT.md`, 310 lines, "draft for approval — no application code written yet" |
| Last commit that contained it | **`20c2f67`** — recover with `git show 20c2f67:SCENARIOS-DRAFT.md` |
| Deleted in | **`728faf0`** (#31), alongside the commit that finished the migration by adding D1 |
| The module | `scripts/lib/variants.ts`, schema in `scripts/lib/scenarios.ts` |
| The resolved form | `data/bundle/scenarios.json`, which is what every surface reads |

The draft is **not** gone: it is in the history at a named commit, and this file names it. What is
gone is its standing as a source of truth, which is the whole of #36 — two copies of the political
content would have drifted, and one of them had already (see *Drift*, below).

## Method

Every heading, table row, bolded field and `⚠` marker in the draft was read
against the corresponding field of the module, and against the emitted variant in
`data/bundle/scenarios.json` where the module computes rather than states. Seventeen variants, and
for each: rationale, real-world status, boundary provenance, advocates, opposition, alternative
names, unit district lists, footnotes and sources.

Three outcomes are possible and all three occur, so they are kept apart by name:

- **Carried** — the draft's content is in the module, in card copy rather than in a comment.
- **Drift** — the draft and the module disagree and the module is right. Recorded rather than
  "restored", because restoring a falsehood is not migration.
- **Not migrated** — draft-process material that is not variant content: estimates made at
  division resolution, decisions about what to cut, and figures the module would have had to
  assert without a source.

No fourth outcome was found. **Nothing in the draft is content the module lacks**, so nothing was
restored into `variants.ts` by this audit.

## Variant by variant

| | Draft | Module | Result |
|---|---|---|---|
| **L1** South Punjab Secretariat | 13 districts across Multan, Bahawalpur and Dera Ghazi Khan divisions; secretariat operational 15 October 2020; PTI position; ⚠ footnote on "11 districts"; opposed by central Punjab interests | `SOUTH_PUNJAB`, the same 13 claims in the same order; status, advocacy and opposition as stated; `district-count` footnote carrying **three** counts (11 then, 13 now, 11 drawn) rather than the draft's two | Carried, and widened — the draft did not know the drawn count |
| **L2** PPP reading | L1 + Mianwali and Bhakkar = 15; both in Sargodha Division; PPP states it as 13; contested edge, local opinion rejects inclusion citing "Potohar/Punjabi identity" | Built from L1's list rather than restated; `district-count` and `contested-edge` footnotes; the Saraiki shares of both districts quoted from Table 11 (73.7%, 79.4%), which the draft did not have | Carried; *Potohar* dropped — see Drift |
| **L3** Saraikistan | L2 + Dera Ismail Khan, Tank, Paharpur = 18; Waziristans excluded, "888,675 people, 95.5–97.8% Pashto-speaking"; the only province crossing a provincial boundary; SQC; opposed by KP parties and Pashtun opinion in D.I. Khan | The same three additions and the same exclusion, carried in `excludes` rather than in prose; 888,675 exactly; the only-crossing claim is a footnote *and* a suite assertion | Carried; the percentage range superseded — see Drift |
| **L4** Hazara | The 9 districts of Hazara Division, named; HQM 1987; April 2010 mobilisation; 12 April 2010, seven killed at Abbottabad; ⚠ footnote on "six districts"; opposed by ANP | The same nine, in PBS's spellings; every date and the seven deaths in `status`; `district-count` footnote carrying six claimed, nine today, eight drawn | Carried |
| **L5** Karachi / urban Sindh | The 7 districts of Karachi Division; MQM/MQM-P, raised as recently as 2026; "mother tongue Sindh" and exchanged land; the revenue argument; ⚠ footnote that urban Hyderabad, Sukkur and Mirpur Khas have no published district list; opposed by PPP, GDA, Awami Tehreek | The same seven; the revenue argument reported **as its advocates'**, with the card saying this app carries no revenue data; `omission` footnote naming all three cities; PPP, the GDA and Awami Tehreek all three on the opposition line, with *Sindhi nationalist opinion broadly* beside them | Carried; the revenue claim narrowed — see Drift. The draft's *"close to a cross-party consensus in rural Sindh and must be on the card"* is carried as the three parties and the broad line rather than as that sentence: the obligation was that the opposition not read as one faction's, and this app has no constituency data with which to assert a consensus in so many words |
| **L6** Pashtun Balochistan | Pashto-plurality districts of northern Balochistan from Table 11, Mastung excluded; ⚠ boundary is data-determined, not transcribed; two readings, one territory; live since 1970, Achakzai and the NAP; PkMAP; opposed by Baloch nationalist parties | Derived at build time by `mother-tongue-partition.ts`; `derived-boundary` footnote naming Quetta and Zhob whole, three of Loralai's four with Barkhan out, and Harnai and Ziarat; both readings on the card; `census · proxy · derived` | Carried, and made checkable — the suite re-runs the rule |
| **L7** Mother tongue everywhere | ~13 units by census plurality, contiguity enforced; `census · synthesized`; no named advocate, must say so; where it coincides with a real claim, point at the attributed variant; Karachi the most contested unit | Derived; `unadvocated` with the note the card prints; a note pointing at L1, L4, L5 and L6; PPP, GDA and Awami Tehreek on the opposition line; Keamari and Hyderabad drawn rather than absorbed | Carried; badge widened to `census · proxy · synthesized`, and the unit count and the Balochi region sketch both superseded — see Drift |
| **A1** No unit above 25M | "~9 units" | Rule engine; the count is a **finding** and comes out at 16, which the card says | Carried; the estimate superseded — see Drift |
| **A2** Twelve units | Twelve, population as equal as contiguity allows | Rule engine, `unit-count: 12`, spread 3.1:1 | Carried |
| **A3** Fourteen units | Fourteen | Rule engine, `unit-count: 14`, spread 3.5:1, with the card saying fourteen is *less* even than twelve | Carried, and given the finding the draft could not have had |
| **A4** 300 km to a capital | "computed" | Rule engine, `distance-to-capital: 300`, 10 units, spread 68.8:1, Gwadar–Quetta at 635 km re-measured by the suite | Carried |
| **A5** Constitutional regularisation | GB (10) and AJK (10) become provinces; announced 1 November 2020 by PM Imran Khan; "draft 26th Amendment"; GBLA resolution; opposed by India; LoC treatment identical | Both units `proposed`, holding exactly their own districts; the announcement, the drafted amendment and the assembly resolution in `status`; India first on the opposition line; a footnote on the dashed line; and a footnote the draft has no equivalent of, saying the two halves are **not equally sourced** | Carried; the amendment's number dropped and the unit count corrected — see Drift |
| **H1** One Unit | Consolidated 14 October 1955, dissolved 1 July 1970; "1 unit"; the whole map one colour | `WEST_PAKISTAN` plus AJK and the Gilgit Agency as themselves — three units, because neither was inside the province; both Acts cited; `unadvocated`; vintage carries the fifteen years | Carried; the unit count corrected — see Drift |
| **H2** Provinces and princely states | Eleven states with a district list each, two marked approximate; Amb and Phulra omitted with a footnote; ⚠ hard rule: attach no modern population figures; card shows area and composition only | Every one of the eleven with the draft's exact district list; Kalat and Swat footnoted as approximate; the Amb and Phulra `omission` footnote; `statistics.modernFigures: false` with the reason the scorecard prints; and four footnotes the draft has no equivalent of — Gwadar's Omani exclave, the tribal agencies, Baltistan, and the 59-district decomposition | Carried; *area* not migrated — see Not migrated |
| **H3** 1970 restoration | Punjab, Sindh, NWFP, Balochistan, FATA and the Northern Areas; "6 units"; before the FATA merger and GB's renaming | The same six plus ICT and AJK, which the draft's count omitted; the seven agencies as FATA with the six Frontier Regions footnoted as undrawable; the 25th Amendment and the 2009 Order cited | Carried; the unit count corrected — see Drift |
| **H4** Bahawalpur restored | Three districts; a province 1947–1955; movement from 1970; BMM won 4 NA and 9 provincial seats in 1970; "near-impossible to win a seat in the region while opposing it"; PML-N's two-province position; collision with L1–L3 | The same three; every date and both seat figures, sourced to the Election Commission; PML-N's position on the card and in the sources; the collision wired to L1, L2, L3 **and** H2, in both directions | Carried; the electoral assertion narrowed and the unit count corrected — see Drift |
| **D1** Development fault lines | Split each province where its internal development gradient is steepest; claimed to reproduce South Punjab, interior Sindh and interior Balochistan | `development-partition.ts` computes the cut from the committed composite; the card states the rule, the four seams, and **what it does not reproduce** | Carried; the convergence claim corrected — see Drift |

### The bases

All four basis headers in the draft — source line and badge pair — are in `BASES`
(`scripts/lib/scenarios.ts`) and are checked by `provenance.test.ts`. Language `census · proxy`,
Administrative `census · derived`, Historical `documented`, Development `census · synthesized`, the
last with its source line rewritten (see Drift). Historical is the one basis whose vintage is a
rule rather than a date, which the draft did not distinguish and #32 does.

### The six card obligations the draft states

The draft marks its card obligations three different ways, and they are counted here rather than
described as one kind, because "the six `⚠ Footnote required` markers" would be a round number that
is not true of the file: there are **three** of those. Two more carry a bare `⚠`, and one is stated
in ordinary prose. Every one of the six is met.

| Draft | How the draft marks it | Where it lives now |
|---|---|---|
| L1 — sources say "11 districts", the pre-2022 count | `⚠ Footnote required` | `district-count` footnote on L1 |
| L4 — the movement names "six districts" | `⚠ Footnote required` | `district-count` footnote on L4 |
| L5 — urban Sindh reaches Hyderabad, Sukkur and Mirpur Khas; no published district list | `⚠ Footnote required` | `omission` footnote on L5 |
| L6 — the boundary is data-determined, not transcribed | `⚠ Boundary is data-determined` | `derived-boundary` footnote on L6 |
| H2 — Amb and Phulra omitted, and why | prose: "with a footnote on the card naming them" | `omission` footnote on H2 |
| H2 — attach no modern population figures | `⚠ Hard rule for this scenario` | `statistics.modernFigures: false` with its reason, which the scorecard prints where the population lines would be |

Five of the six are footnotes and are asserted against the committed bundle in
`scripts/lib/bundle.test.ts` — keyed on the footnote *kind* and on a phrase the draft demanded be
said, since a footnote of the right kind saying something else passes a kind check perfectly, and
keyed on the **draft's** phrasing rather than the card's, since a regex copied off `variants.ts`
asserts only that the card says what the card says. The sixth is the withholding, held beside them.

## Drift — where the draft and the module disagree, and the module is right

Recorded rather than reconciled in the draft's favour. Each of these is a place where keeping both
files would have left a false sentence in the repo with nothing to contradict it, which is #36's
case in miniature.

1. **"Improved sanitation" is a column PBS does not publish.** The draft's Development table lists
   the third indicator as *households with improved sanitation* and says all three are "published
   directly at district level — no derivation". Both halves are wrong. PBS classifies water sources
   as improved or not, but for toilets prints only flush / non-flush / none, and a non-flush toilet
   may be improved or not; so the shipped indicator is the **flush-toilet share, named as such**. And
   the structured release carries tehsil rows only for all three tables, so every district figure in
   this app is **summed from 591 tehsils** and reconciled against PBS's printed province counts. See
   `development-indicators.md`.
2. **A1's "~9 units" is 16.** The estimate was made at division resolution. The rule is a ceiling,
   the count is a finding, and the card says so.
3. **D1 does not reproduce all three regions.** The draft calls the convergence "the most
   interesting single result in the app". Run to the end, the rule is right about Punjab — the lower
   half is South Punjab plus the Thal, and it picks up exactly the two districts L2 adds — and wrong
   about the other two: what separates in Sindh is the south-east rather than the interior against
   Karachi, and in Balochistan the eastern belt rather than everything outside Quetta. The card
   reports the rule as it ran. A rule tuned until it agreed with the claims it is meant to be
   independent of would have nothing left to say about them.
4. **Five of the draft's unit counts are counts of something else.** H1 is three units and not one;
   H3 is eight and not six; **A5 is seven and not nine; H4 is eight and not five; L7 is fifteen and
   not "~13"**. One cause under all five: the draft counted the units its prose was about. H1 draws
   AJK and the Gilgit Agency as themselves, because neither was inside the province of West
   Pakistan; H3, H4 and A5 carry ICT, AJK and GB through; L7 was an estimate of how many regions the
   rule would produce, and the rule produced fifteen, two of them the Keamari and Hyderabad pockets
   nobody would have predicted. Every variant is a complete partition (D6), so a count that ignores
   the carried-through units is a count of something else, and the module states the partition's.
   The draft's L7 sketch is wrong in the same direction one step down: it predicted three Balochi
   regions (Makran, Rakhshan, Nasirabad) and the rule finds **two**, the Brahvi belt lying between
   them. The Administrative counts are *not* in this group: A1's 16, A2's 12, A3's 14 and A4's 10
   are the rule-drawn units, a figure the scorecard carries separately as `proposedUnits` beside the
   partition's own total, and the cards say which they are quoting.
5. **L7's badge gains `proxy`.** The draft says `census · synthesized`. The Language basis carries
   `proxy` and L7 leans on it hardest — every boundary on it is mother tongue standing in for the
   identity the argument is actually about.
6. **L3's "95.5–97.8% Pashto-speaking" does not describe the district this map draws.** The draft
   quoted a range across the two present-day halves of South Waziristan. Both fold into the one
   district this map draws (ADR-0001), and the figure for that district, read off Table 11, is
   **98.0%** — outside the range, so this is a figure corrected rather than a figure refined. The
   population, 888,675, is unchanged.
7. **A5's "draft 26th Amendment" loses its number.** The amendment drafted for Gilgit-Baltistan in
   2020–21 was widely reported as the 26th. A Twenty-sixth Amendment has since been enacted and is
   about the judiciary, so printing the number now would point a reader at a different instrument.
   The card says *a draft constitutional amendment was prepared*, which is the substance and is not
   overtaken.
8. **Two political assertions narrowed to what a source can carry.** The draft says Karachi's
   Urdu-speaking population "generates the large majority of Sindh's tax revenue" and that it is
   "near-impossible to win a seat in [Bahawalpur] while opposing" restoration. This app carries no
   revenue data and no constituency data. The cards report the first as its advocates' own argument
   and say the app does not adjudicate it, and state the second as the restoration having been a
   fixture of the region's electoral politics since 1970, which the 1970 seat figures support.
9. **L2's "Potohar" identity is not restored, deliberately.** The draft has opposition in Mianwali
   and Bhakkar "citing Potohar/Punjabi identity". Potohar is the plateau around Rawalpindi, Attock,
   Chakwal and Jhelum; Mianwali and Bhakkar are Thal districts and are not in it. The card states
   the opposition as argued on the grounds of a Punjabi rather than a Seraiki identity, which is the
   part of the draft's sentence a source reaches. This is the one place in the audit where content
   present in the draft was examined and **not** carried, and it is recorded here rather than
   dropped silently.

## Not migrated — draft-process material, and why each stays out

None of this is variant content. It is listed so that "nothing was lost" can be checked against the
draft as a whole rather than against its variant sections only.

- **The administrative anchoring figures.** "Division populations range 6M–24M in Punjab, 4M–20M in
  Sindh, 3M–10M in KP, 0.9M–4M in Balochistan", and "four provinces served 60M in 1970; at 240M,
  Pakistan needs 12–14". The 12–14 range *is* on A2's and A3's cards, as the low and high end of the
  number usually named. The division ranges and the 1970 figure are not: PBS publishes no division
  tier in Table 1, and A1 to A3 already carry a named, tolerated gap for asserting 1970 without a
  source line (`bundle.test.ts`, `KNOWN_GAPS`). Adding an unsourced population figure to that would
  be the working agreement's one rule broken to preserve a draft's margin note.
- **"Card shows area and composition only" (H2).** No card in this app prints an area, for any
  variant. Areas exist in the bundle and their disagreements with PBS's published figures are on the
  **About the data** panel, which is where a measured quantity with a known discrepancy belongs.
  What H2 actually needed from that sentence was the prohibition beside it, and that is carried in
  full: no population figure anywhere, on any unit, in any total, in any spread, and not in the
  district tooltip either (#30).
- **The MPI history.** "Earlier drafts used the national MPI (PSLM 2014/15, then 2019-20). Replaced
  because the census gives one source and one vintage." The decision is in CLAUDE.md's Data section
  and in `development-indicators.md`; the superseded PSLM vintages are recorded here and nowhere
  else, which is the right place for the history of a rejected source.
- **D1's cut alternatives.** Quartile-banding ("works as shading, weak as a partition") and
  poorest-districts-as-one-unit ("non-contiguous, would be flagged invalid"). Both are reasons a
  variant does *not* exist, and a card has no field for them.
- **The Development basis's standing reservation.** "Deprivation is arguably the true engine of the
  debate — the South Punjab case is fundamentally about it, not language — but it doesn't form
  contiguous blocs the way language does." The first half is the finding D1's own note now makes
  from the partition rather than by assertion; the second half is an observation about the data that
  the shipped rule tests directly, since it grows both halves of every province across shared
  district borders.
- **The draft's own open items.** Its two verification tasks — the AJK district list and
  Balochistan's division and district set — are CLAUDE.md open items 1 and 2, both resolved, each
  with a file in this directory.
- **The resolution model, the vintage rule and the "resolved by moving to districts" list.** All of
  it is CLAUDE.md's Core model, its Vintage rule and ADR-0001, stated at more length than the draft
  states it.

## What the suite holds, so this file does not have to be re-read

`scripts/lib/bundle.test.ts` — *carries every variant the retired draft approved, and every footnote
it required*: the seventeen ids as a set, and five of the six card obligations above — the
footnotes — keyed on kind and on a phrase quoted from the draft, plus the sixth, H2's withholding
and its reason. A footnote deleted from `variants.ts` fails there, naming the variant and the
phrase, rather than being found by somebody re-reading a document.

Everything else the draft asserted about a variant's territory is already held: the partition
checks, the three readings of the Seraiki claim as containment, the eleven princely states named one
by one, the rule engines re-run against the committed census and the committed graph, and the
card-content checks in `card.test.ts` and `provenance.test.ts`.
