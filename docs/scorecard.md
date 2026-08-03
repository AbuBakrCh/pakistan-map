# The scorecard (#20)

Unit count, population spread, largest:smallest ratio, districts moved, non-contiguous units —
and area where the population lines are gone. All of it baked in `scripts/lib/scorecard.ts`,
none of it computed on the page. `scripts/CLAUDE.md` carries the rules; this file carries the
arithmetic and the absences it has to keep apart.

---

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
