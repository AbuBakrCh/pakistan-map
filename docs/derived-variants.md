# The seven derived variants

Ten of the seventeen variants are literals transcribed from a document; seven are functions of
the census, drawn by a rule this build states. This file is the record of each rule, what it
draws, and every cost stated on the card rather than smoothed away — plus H2, which is a literal
but carries the app's only withholding and the second of open item 2b's two narrowings.
`scripts/CLAUDE.md` carries the rules the build enforces and points here.

---

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

**D1 is the variant that composite draws** (#31) — the districts the census serves alike, grouped
where they touch, and the last of the seventeen. `scripts/lib/development-partition.ts` computes it
from three conditions and nothing else: a unit is the **largest group of districts that share a
development band, share a province, and reach each other across shared district borders**. Each of
the three does work. The **bands** are the shading's own four at their fixed cuts — under 50%, 50 to
65%, 65 to 80%, 80% and above — applied through the same `bandOf` that wrote
`development-index.json`, so a unit is exactly a run of one colour and the line drawn over a
district is the line between two fills a reader can already see. The **province** is a boundary the
rule does not cross, deliberately: Punjab's best-served districts and Khyber Pakhtunkhwa's are the
same colour and are not the same place, and joining them would draw a province out of two provinces'
halves — a redraw of the federation rather than of a province. **Adjacency** is the method rather
than a filter, as it is in the two engines next door: a unit is a connected component of #16's
graph, so it cannot come out in two pieces and there is nothing for a contiguity flag to say.

**Nothing in it is optimised, and the unit count is a finding rather than a setting.** There is no
statistic being maximised and no number to tune. The rule replaced one that cut each province in two
at the one-dimensional natural break — Fisher's and Jenks's criterion — and the change is a change
of question rather than of tuning: that rule asked *where does this province divide most sharply*
and this one asks *which districts does the census serve alike*. The card says so in as many words,
because "steepest", "best" and "most even" are all things a reader would otherwise assume a
development map had found.

**What it draws is 35 units, and two of its costs are stated on the card rather than smoothed
away.** Thirty-two groups out of the four provinces — 13 in Khyber Pakhtunkhwa, 8 in Balochistan, 7
in Sindh and 4 in Punjab — each named for its most populous district, plus Islamabad Capital
Territory, which the caller keeps out of the scope so that it is drawn as the capital territory it
is rather than renamed after its one district, plus the two territories, which have no index at all
because PBS published none of the three rates for their twenty districts (D25). The first cost is
that **fragments are units**: eleven of the thirty-two are a single district whose neighbours are
all served differently, Gwadar and Hyderabad and Layyah among them, and absorbing them would take a
second rule with nothing published behind it and a threshold nobody sourced. The second is the
**spread**, at 456.4 : 1 — one 80%-and-above group runs from Attock to Vehari and holds 89 million
people where Upper Chitral holds 195,528 — because the rule is stated in service access and says
nothing whatever about population. 135 of 156 districts move, every census district but Islamabad's,
for the reason A1 to A4 already give: not one of the thirty-two carries the name of the province it
came out of. **Nought non-contiguous units**, by construction.

**Punjab is the case the ticket was right about, and the card reports the rest as it ran.** The
ground outside Punjab's best-served group contains **8 of South Punjab's 11 drawn districts** — all
but Multan, Khanewal and Vehari — and adds five more across the Thal and the centre. That
convergence is computed from L1's own district list in the same run rather than asserted, because it
is the sentence on that card most able to become false without anybody noticing. Where the agreement
stops is now a different shape of statement from the old rule's, and the card says that too: this
rule does not divide a province in two, so Sindh and Balochistan come out in several pieces each and
Khyber Pakhtunkhwa in more than either — its valleys, its settled plain and its western districts
are served too differently for one line to be the story. A rule adjusted to agree with the claims it
is meant to be independent of has nothing left to say about them.
