# The card, the scorecard and the About panel

The three prose surfaces beside the map — what each carries, what it refuses to do quietly,
and why. `src/CLAUDE.md` carries the rules. The words are decided in `src/lib/card.ts` and
`src/lib/about.ts`, both under test; `src/panel.ts` composes no sentence of its own.

---

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
that are a cross-table check and not a second source, the **eight districts PBS's own Table 1 and
its structured release put different numbers of people in** (#49) — four cancelling pairs of
neighbours, which is why both agree to the person at province level and why it changes no figure
this app publishes, and exactly why it could quietly have been left off — and the geometry's own
disagreements with PBS's published areas. A panel that listed the tables and hid those would use the audit surface to
make the data look tidier than it is, which is the failure it exists to prevent. And **what it
leaves off is on it**: the SHA-256 cache digests, the province and division reconciliation tables
and the per-district mother-tongue excesses are an auditor's appendix of some hundreds of rows,
they stay in the artifacts where the suite re-derives them every run, and the panel says so and
names the files.

**The development composite has a row of its own on it, and it is the only row that is not somebody
else's figure** (#31). Badged `synthesized` alone, carrying the formula and the sentence saying what
it is not, dated by the census it is a function of and never by the day the arithmetic ran, and
stamped with a build date of its own beside the other five artifacts. It appears a second time
**among the discrepancies**, which is where it belongs even though it is not two sources
disagreeing: the failure it invites is a reader taking it for a published statistic, and a panel
that listed it once as a source and left that alone would be using the audit surface to make the
data look tidier than it is.

Nothing on it answers to the selection — the sources, the vintages and the build dates are the
same under every basis and every proposal — so it is rendered once, at load. The words are decided
in `src/lib/about.ts`, under test; `src/panel.ts` composes none, exactly as with the card.
