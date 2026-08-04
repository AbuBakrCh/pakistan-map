# Label layout

Every rule about where a name goes on this map: how a unit's name is fitted to its ground,
what happens when it will not fit, how a leader is routed and ranked, which tiers yield to
which, and the per-variant record of what is nameable at the 390px bar. `src/CLAUDE.md` carries
the summary and points here. `src/lib/labels.ts` is the code; `labels.test.ts` holds the lists.

---

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
provinces and divisions are drawn and named together wherever the division tier is drawn at all.
So both are set and the division says which
it is: **Lahore Division** beside **Lahore**. That is the unit's own full official style rather
than a coinage of ours, so it needs no source it does not have, and it is applied **only** to the
six that actually collide — suffixing all 37 would shout a distinction that matters six times.

Crowding is left to the layout rather than given a rule of its own: the dot already outranks the
division, `layoutLabels` drops what will not fit, and it is recomputed on every zoom, so the city
wins the tight frame and the qualified name returns with the room. The cost is paid at default
zoom by **Mardan**, which now gives way to `Peshawar Division` in the most crowded corner of KP —
named in the suite, not absorbed into a count, and back on the first zoom step.

**A unit's name is fitted to the ground it names, and where it will not fit it is taken outside it
on a leader** (#50). Until this pass a unit name was measured against the shape's **bounding box**,
which on a crescent, a coastal strip or one of #28's rule-drawn slivers is mostly somebody else's
ground: `SOUTH PUNJAB` was set 124px wide over 73px of room, and half of it lay in the Punjab the
proposal is carved out of. On a map whose whole subject is which district belongs to whom, a name
crowding or crossing a boundary is a claim nobody wrote — and it is the one claim a footnote cannot
take back, because the reader has already read it off the picture.

So the name is fitted in steps, in a stated order of concession. It is **broken on its bracket** —
L7's regions are `Balochi (Kech)` and `Pushto (Keamari)`, and set on two lines a box is as wide as
its wider line rather than as wide as the sum. It is then **wrapped between its words** where it has
more than one: `RAHIM YAR KHAN` set on one line is as wide as the sum of three words and on two is
as wide as its wider half, which is routinely the difference between a name on its own ground and a
name out on a line pointing at it. Whole and wrapped are offered **together at each size**, because
a wrapped name set large is more legible than the same name squeezed onto one line at the floor and
both say exactly what the unit is called. The pair is then **set down a short ladder** until it
clears the room, bounded at both ends: never larger than the province size, because a unit is told
apart from a province by colour and not by scale, and never below **6.5px**, which is the smallest
type this map will set. Only where none of that fits on this ground at any size, in any shape, is
the unit's **own attested abbreviation** offered — a different word, and conceded last for that
reason — and **nothing is ever invented**. And where even that will not fit, the name goes
**outside the shape on a leader**.

**Where the wrap breaks is decided by the text and never by the measurement**, which is the
objection the bracket rule records and it is a real one: a name broken wherever the type ran out
breaks somewhere different at every zoom, and a reader watching a proposal's name reflow as they
lean in is reading the layout rather than the map. The split is the one leaving the two halves
closest in length, ties to the earlier space — a property of the string, identical at every size and
on every frame. Two lines and never three: three lines of 6.5px type stacked inside a district is a
paragraph, and ground that could hold it can hold two lines of something larger. Hyphenation is
still refused, since it would coin a spelling no source uses.

**The floor was the district tier's 8.5px until #51, then 7.5px, and is 6.5px now.** The first
bound was defending a collision that cannot happen: district names are not laid out at all below
`DISTRICT_LABEL_ZOOM`, and at 6× a unit has room to spare and is nowhere near the floor, so the two
tiers never co-occur at a size where a reader could compare them. What is left is the absolute
legibility floor, and each step down buys about a tenth of the width. It is a **trim rather than a
rescue** either way — the names badly over their ground are over by multiples, and the wrap and the
leader are what answer those — but it is the trim that puts `LAYYAH` inside Layyah, which is a
single district and one word and has nothing else to give. 5.5px was tried and taken back out: at
that size the name stops being read and becomes a mark.

**The room is measured, not assumed.** `interiorRoom` casts a ray each way along both axes from the
anchor and keeps the nearest crossing, so a hole, a neighbour's bite out of a crescent and the outer
edge all stop it alike; the usable box is twice the shorter reach on each axis, less a few px of
clearance, so a name never touches its own boundary either. That is the fast question and not the
exact one — a diagonal boundary can leave both rays clear and still take a *corner* of the name, as
Sindh's and D1's Quetta's did, and a retired rule-drawn *Hyderabad* did before them — so the box's
whole perimeter is then checked
against the same rings. The name is also **centred in the room rather than on the anchor** where the
two differ, which is the one displacement `layoutLabels` allows: the midpoint of the interior span is
inside the same unit the anchor is, so the name cannot walk onto a neighbour however far it slides.

**And where neither will take it, the name goes to the roomiest part of the unit's own ground**
(#51). The anchor answers *where does this name honestly belong* — a centroid, or a pole of
inaccessibility where the centroid lands on a neighbour — and the midpoint widens that by the span
of one interior ray. Neither asks the question a long, thin or lopsided unit actually poses, which is
*where on this ground is there room to write*: a crescent, a coastal strip and one of #28's
rule-drawn slivers can each have a cramped anchor and a broad lobe elsewhere, and until now the name
paid for the anchor's room and went out on a leader with the lobe unused. `widestInterior` samples a
coarse grid and ranks by the **area of the box that would actually fit** — not by distance from the
boundary, which is the anchor's own objective and a different question, since a name is wide and
short and the point with the most room in every direction is very often not the point that best
carries one.

**The lobes are offered at every rung, before the type is set down, and that ordering is the
decision.** A name set at full size in the roomiest part of its own ground is a better answer than
the same name set two rungs down on its anchor: both are inside the unit, both name it correctly,
and only one of them is legible. Offering the anchor the whole ladder first — which is what the fit
did when this landed — means a name like `Saraiki` shrinks in a narrow neck while a broad lobe of
the same unit stands empty, and the roomiest-point search is consulted only for names already on
their way to a callout, which is to say only where nobody can see it. The ladder is now the **last**
thing spent rather than the first. Within one rung the order is anchor, then interior midpoint, then
lobes by room, so the honest place is preferred wherever it will take the name at the size under
test and the name moves only as far as that size requires.

Three things keep it honest. The displacement is bounded by the same thing that bounds the
midpoint's — every candidate is **inside the same unit**, so however far the name slides it cannot
walk onto a neighbour or name ground it does not describe. The grid of ray casts is computed
**lazily and at most once per name**, on the first rung the anchor cannot take, so a unit whose name
fits at full size where it belongs never runs the search at all. And the leader, where one is still
needed, still starts at the **anchor** rather than at the roomiest point: a callout's whole job is to
say which ground the name belongs to, and it should point at the place that honestly answers that.
What it costs is that a name may sit well off its unit's visual centre — which is the atlas answer
to a lopsided shape, and in every case better than the alternatives it replaces: the name shrunk
into a neck, or outside the unit altogether on a line.

Finding this out cost the **anchor** a correction of its own. `labelAnchor` took the centroid
wherever `geoContains` said it was inside, and D1's Khuzdar has a centroid a *tenth of a pixel*
from its own boundary — as did a retired rule-drawn *Killa Abdullah* — a hairline of polygon left by the dissolve, technically
interior and no use to anybody. Invisible while a name was measured against a box, and fatal once it
has to fit the room. The centroid now has to be **comfortable** as well as inside, and where it is
not the pole of inaccessibility answers instead, which is the case that search already existed for.

**The leader is a single orthogonal elbow ending in a dot immediately before the first character.**
It runs from the anchor along the anchor's own line to the dot's column, then up or down into the
dot; the name is set horizontally and always runs rightwards from its dot, whichever side of the
unit the callout is taken to. That routing is a decision and not a drawing convenience: a diagonal
to an elbow beside the dot draws beautifully to the right and **cannot be drawn to the left at
all**, because a leader approaching a dot on the left of a name it started to the right of has to
travel the width of the name and converges on the dot's own line as it does — it crosses its own
words at every offset short of about twenty times the type size. Orthogonally, one line of clearance
is enough and both sides work, which is what keeps a unit in the eastern half of a phone frame from
being unnameable for a reason that is really about the shape of a polyline.

**The name is taken clear of the country, not merely clear of its own unit** (#51). Until then the
leader stopped a few px past the unit's own reach at the anchor, which on any unit with a neighbour —
which is most of them — set the name squarely on **somebody else's ground**. That is the same claim
the interior fit exists to prevent, made a second way and made worse: the reader has a *line* saying
the name belongs to something, and the ground under it says which. So the dot's column is found from
`landSpanAt` — the extreme crossings of the drawn land on that row, both ends taken whole, so a name
is not stopped at the first inlet of the coast — and the paper the name lands on is paper. Asked of
the box's top, middle and bottom rather than of its centre line, because a name is a box and a
coastline is diagonal.

The four **neighbour silhouettes count as clear**, deliberately. The failure being closed is a name
reading as though it labels a different **unit**, which is a claim about Pakistani ground; India and
Afghanistan are drawn unlabelled and name nothing, so nothing there can be misread as named. It is
the narrower rule than the ceasefire line's name follows — that one asks about the silhouettes too,
because it is a claim about a *border* — and the two are kept apart on purpose rather than by
oversight.

**A callout reserves its clear paper rather than looking for it** (#51), and which way round that
goes is the whole of the fix. `HINDKO` came out wedged between Azad Kashmir, Muzaffarabad, the
ceasefire line's name and `KOHIOSTANI` — overlapping none of them, legal by every check, and
unreadable, because a name on a line is read by *following the line into it* and there was nothing
around it to arrive at. The obvious reading is that the callout chose a crowded spot, and it is
wrong: the layout is greedy by priority and the units outrank everything, so a unit's callout is
placed while the paper around it is still **empty**. Asking it to prefer a quiet spot achieves
nothing, because at that moment every spot is quiet. The thicket is built afterwards out of the
names ranked below it — the dot 9px away, `Mardan` 10px, `Malakand` 3px at the phone bar, each of
them legal since 3px is the layout's own floor, and the four together unreadable.

So the rect a callout contributes to the layout's `taken` list is **larger than the rect it draws**:
one line of its own type on every side. It is the one kind of name that earns this, because every
other label sits on the ground it names and is read straight off it. The reserve travels into
`map.ts`'s own `taken` as well, since the ceasefire line's name is placed on a separate path and
compared with *no* clearance at all — it was one of the four words in the pile.

**The reserve is a preference and never a wall.** Reserves are kept in a list of their own, and
every placement is made twice: once respecting them, and then — only where that found nowhere at
all — ignoring them and asking the original question, which is whether the name collides with
anything real. So a reserve moves names that have somewhere else to go and drops none that does
not. Merging the two lists is what this did when it first landed, and it cost `Hindko` its own name
outright at the 390px bar, which is a far worse trade than the clutter it bought off.

The cost is real and is the point: a division or a city name that would have fitted beside a callout
is now dropped or nudged instead. A base-map caption that gives way comes back on the first zoom
step; an unreadable proposal name does not.

**Nearest first, straightest next, and toward its own province.** Candidates are ranked by a **cost**
rather than by a raw length, and the three terms it adds are the three things that make a margin
legible. The **run out** is charged directly, so a name sits as close to its ground as the paper
allows. The **bend** is charged at four times its length, because ranked on raw length a leader that
drops two rungs to save three pixels of run beats the plain horizontal one, and a column of names
each bent a different amount is what a reader gets; rung zero has no elbow to follow at all and is
what an uncontested name reaches for. And the **wrong margin** is charged about a third of a frame,
so a Khyber Pakhtunkhwa unit's name goes out into the north-west and a Sindh unit's into the south,
and a reader looking at a province finds that province's names beside it.

**The side is asked of the unit and never of the country's middle**, which is the correction that
made it right. The middle answers well for a unit out at an edge and arbitrarily for one near the
centre: Tank is a Khyber Pakhtunkhwa unit a few pixels east of the country's midline, and being
pushed "outward" sent its name across into Punjab's margin — further from its own ground, and past
the Afghan frontier a short run to its west. Which margin is *nearer to its own anchor* is the
question, measured once at its own row so the ladder does not wander from rung to rung. The
country's middle is still good for the vertical sense, where a unit in the north wants its name
above rather than below.

Two things it will not do, and one it now will. There is **no cap on how much ground a leader may
cross**: it was tried at 26px and then at 80px, and a finite allowance is a quota deciding which
units get named — it silenced Layyah, Tank, Mastung and Kambar Shahdadkot, each on the map, in the
key and in the card, and nameless on the one surface a reader is actually looking at. A cap on the
*number* of callouts was the other alternative and is refused for the same reason. What remains is
the **reach**: a leader longer than 0.95 of the frame's shorter side is refused, which is a bound on
the frame rather than a ration.

**A name on paper is set one step down from a name on its ground** (#51) — one fixed 0.78, the same
for every callout. It used to be set at full size, on the reasoning that outside the shape there is
no ground constraining the type and a name shrunk to fit a room it is no longer in pays twice. That
was sound while the floor was 8.6px and callouts were rare, and it is not sound now: an in-ground
name may be set at 6.5px, so a full-size callout made the **loudest type on the map** belong to the
units that fit worst, at nearly twice the size of a name sitting honestly on its own ground. One
size rather than a ladder, because out on the margin there is no ground to explain why one callout
is smaller than the next. It bends "told apart by colour, not by scale" (D14), which is a rule about
a unit against a province — and every callout is already marked as the exception by the line
attached to it.

The leader takes the unit's **own outline colour**, so the accent still means *a proposed province*
and nothing else (D14), and it is **furniture and stays in screen px** at every zoom, like the type
it carries and like the city dots. It is **drawn as furniture too**: a hairline under the unit
outline's own weight and a little short of full strength, its corner **turned** rather than squared,
since a right angle in a 0.8px line reads as the corner of a box and a turned one reads as a line
going somewhere; and **cased in paper**, so that where two leaders cross the later leaves a clean
break in the earlier and the pair reads as one line hopping over another rather than as a bundle of
wires. In a corner where eight units share a margin that is the difference between a set of
annotations and a tangle, and it costs a second stroke.

 It **may** cross other units' land, and has to: that is the only
way to reach the margin, and a line over ground is not a name over ground.

**What it may do to another name and to another line is a ladder of five passes, and the last of
them is what makes "every unit is named" a property rather than an aspiration.** In order: a whole
line of type of clear space with no leader within that of another; the layout's own gap; a hairline;
the same hairline with **the lines let cross**; and finally a leader allowed to **pass beneath a
name it does not belong to**. The concession is always to the *lines* and never to the names — two
labels are not allowed to overlap at any pass — because a crossed or underlined leader is a poor
annotation and a recoverable one, where a unit drawn on the map and named nowhere on it is a shape
the reader cannot ask about at all. The last two rungs are reached only in D1's northern cluster,
where eight units the size of a district compete for the same few rows of margin.

Two things are refused at **every** pass. A leader may not run under an **opaque box** — the unit
key, a docked tooltip, the sheet — because a leader under a name is still followable and a leader
under a panel is gone. And **two leaders must stay a clearance apart rather than merely not cross**:
crossing was the whole test and it was the wrong one, since two lines laid a few px apart down the
same margin never cross and are read as a bracket, which is how `MASTUNG` came to drop its elbow
past `QUETTA`'s own dot and run its arm underneath it. Where the frame itself cannot hold the name —
a name wider than the paper, which no clearance concession reaches — it is **dropped**; the layout is
recomputed on every zoom, and the room is what brings it back.

Two consequences elsewhere, both stated because both were wrong first. The **crop** the PNG export
takes is the union of the drawn land and every name, dot **and leader** over it — a callout is
outside the land by construction, so a crop to the coastline would slice off the name and leave the
line pointing at nothing. And the export's caps-baking wrote `textContent` onto each `<text>`, which
**deletes the tspans a two-line name is set as**: the picture came out with `BALOCHI(KECH)` run
together on one line, with no space. Caps are baked on a leaf now, where the words actually are.

**The 390px bar (#34)** is met by the tiers already ranked to meet it, plus one addition. Every
province and both territories are named, **Gilgit-Baltistan included** — it was being dropped, and
the cause was that it had no abbreviation to fall back on where AJK, ICT and KP did: fifteen
characters at province size is far wider than the ground it names on a phone. So `GB` joins the
short forms, fired **only** where the full name will not fit its ground and expanded in the colophon
like the others. It is the **weakest-sourced entry in that table and is flagged as such** (open item
5): the others each name a publishing agency, and "GB" is in general use by the territory's own
government without this project having yet checked it against a published document the way AJK's
district names were checked. It is there rather than absent because the alternative — leaving the
territory unnamed — breaks a harder rule. H3's `NWFP` and `FATA` were added with it, and are the
forms those units were administered under.

**What #50 changed here is worth reading as a swap rather than as an improvement in the count.**
H3's **Northern Areas** and L7's *Pushto (Keamari)* and *Kohiostani* used to be unnameable at the
bar and are now named, all three on leaders — the first of those is the one this section cared about
most, since it is Gilgit-Baltistan under the name that variant gives it and a territory drawn but
anonymous is the failure the politically sensitive rendering section exists to prevent. What joined
the list in their place are units whose names used to be **set across their neighbours' ground** and
which now want a callout in a part of the frame where there is none to be had. Twenty-one names
across nine variants where it was twenty across six: the currency changed, because every name still
drawn is now honestly inside the unit it names or attached to it by a line.

**#51 then cut that to seven names across four variants**, by four levers rather than one — the
7.5px floor, the roomiest-lobe search, a callout set at `CALLOUT_SCALE` and so a fifth narrower, and
a leader long enough to reach the margin from the middle of the country. Fourteen units left the
list, H3's and L4's *Islamabad Capital Territory*, L6's *Southern Pakhtunkhwa*, A4's *Killa
Abdullah*, H2's *Las Bela* and *Nagar* and all three of L7's among them; two joined it, A1's and
A3's *Rahim Yar Khan*, which used to be named and now wants paper its neighbours reach first.

**And the pass after it took the list to six names on one variant, which is where it stands.** Four
levers again, and each a different one: the **word wrap**, so a three-word name is as wide as its
wider half; the **6.5px floor**; the **removal of the cap** on ground a leader may cross, which had
been a quota on which units got named; and the **five-pass ladder** ending in one that lets leaders
cross rather than lose a name. Sixteen of the seventeen variants named every unit at the bar after
that pass — A1 to A3 among them, and H2, both of which had been this section's standing examples.

**Twelve of the fourteen do now**, and the count changed because the content did rather than because
the layout did: A1 to A4 are retired, and the Administrative rule that replaced them draws inside
the existing provinces (see `docs/derived-variants.md`). What is left is **D1 and A6**. D1 is the
hard case — 35 units, eleven of them a single district, on a 369px-wide country, with *South
Waziristan*, *Torghar*, *Lower Chitral*, *Upper Chitral*, *Hyderabad* and *Karachi* unnamed,
four in the northern cluster and two around the delta. **A6 loses exactly one**, and it is
*Islamabad*: a unit of a single district, because the capital territory is a province of a single
district in the census and a rule that partitions inside the provinces has nothing there to divide.
It is the smallest ground any unit in that variant stands on, wedged between Rawalpindi's unit and
Punjab's northern edge. Each is listed in the suite and shown to return at desktop size.

**H2's *Gilgit Agency and Baltistan* left that list**, and it is the one departure worth reading on
its own, because it was the last **territory** on it. The same ground under the name it carried in
1947, at 279px the longest unit name in the app (#30) and anchored in eastern Baltistan because
Hunza and Nagar are drawn out of its western end: the arithmetic that excused it — every row of the
frame either too narrow for the name or too far from it to reach — was honest and stopped being true
when the transit cap went and `mustName` was added, which says out loud that a territory's name may
not be dropped for want of clear paper. There is now **no size or selection at which a territory is
drawn anonymous**, and the suite asserts that as an emptiness rather than as a shrinking list. What
otherwise gives way is
the division tier and two of the seven seats, which is the ranking working as written — and the
price is stated rather than counted: **Peshawar** loses its division name *and* its seat name, so
at 390px the word is nowhere on the map and only the dot marks the place. It returns on the first
zoom step.

**A territory ranks first inside the unit tier, and the reason is the one #34 was raised over**
(#28). Ranking within a tier is by ground covered, which is right for the divisions and backwards
for exactly the two units it can least afford to be backwards for: after ICT, Azad Jammu & Kashmir
and Gilgit-Baltistan are the smallest first-level ground on the map, so ranking on area puts the
two names this app is least free to drop at the bottom of a tier of sixteen. At the baseline the
tiers already handled it — a territory is a province-tier name and the provinces outrank the cities
and divisions outright — so the failure could only appear under a variant crowded enough for units
to evict each other, and #28's rule-drawn partitions were the first that were: at 390px A2 and A3
dropped **Azad Jammu & Kashmir**, whose own `AJK` is 31px of type over 29px of ground, to make room
for *Rawalpindi*, which is 103px of type over 42px. Those variants are retired and the rule that
replaced them is not that crowded, so the case no longer arises on any shipped map — which is
exactly why the floor is asserted as an **emptiness** rather than as a list of the variants that
once needed it. A territory drawn and anonymous is a claim about
Pakistan-administered ground that nobody here decided to make; a proposed unit that gives way is a
legibility cost that returns on zoom. So the tier has two floors. It is keyed on **the kind the
bundle records and never on the name** — H3 calls Gilgit-Baltistan the *Northern Areas* and H2 calls
it the *Gilgit Agency and Baltistan*, and a rule
reading names would stop protecting a territory the moment a variant renamed one, which is the
failure #34's own review found in the criterion it was asserting. Two things it does not buy, both
stated because both are real: it cannot rescue a name that has nowhere to go, which is a *third*
failure told apart from the other two by assertion. A name **outranked** is what #28 fixed; a name
**spilled over its ground** is what #50 fixed; a name with no paper to be called out onto is
neither, and both territories that stood here — H3's *Northern Areas* and H2's *Gilgit Agency and
Baltistan* — have left the paragraph, the first when a callout stopped having to sit over the ground
it names and the second when the leader stopped being rationed. What answers that third failure is
`mustName` rather than a ranking, since no priority reaches it. And it is not free — A1 had been
naming AJK by nudging it clear, and giving it the corner outright was part of why *Rawalpindi* and
its neighbours were the last names on that variant's map to find room. A5 was the deliberate
exception — its AJK and GB were *promotions*, recorded as `proposed`, argued as provinces and ranked
as the proposals they were — and it has been retired. The rule is keyed on the kind the bundle
records and not on the name, so it needs no change to be ready for the next variant that promotes
one: the suite asserts the exception list is empty rather than asserting a shrinking list of names.

**The rule-drawn Administrative maps were this section's standing example, and the shape of the
problem changed with them.** A1 to A3 were not transcribed proposals whose author chose the names —
they were what the rule engine drew (#27), and a rule stated as "no province above 25 million"
across the whole country produced fourteen to sixteen units, most of them packed into Punjab and
upper Sindh and each named after its capital district. At the bar the country is 369px across and
central Punjab about 120px of it, while *Bahawalnagar* alone is 124px of type; there was no packing
of six such names into that ground, no attested abbreviation for any of them, and inventing one is
the thing the short-form table exists to refuse. It went from thirteen names across the three to
six to none, and what closed the last six was the leader being allowed to travel and the ladder
being allowed to let two lines cross rather than lose a name.

**A6 inherits none of that**, because it does not put fourteen units in Punjab: the province is the
frame, and Punjab comes to seven units rather than to most of the map's. Its one unset name is
*Islamabad* — a single district with Rawalpindi's much larger unit wrapped around its north and
west, so there is neither ground inside it for the name nor an uncontested direction to take a
leader in. It is not the crowded-Punjab problem in a new place; it is the smallest unit on the map
being the smallest unit on the map.

**D1 is where it is least met**, and it is a different problem rather than the same one moved. A6
loses one name to a one-district unit; D1 draws **35 units**, eleven of them a single district, and
eight of those are packed into northern Khyber Pakhtunkhwa where the country is at its narrowest. Six go unnamed at 390px — *South Waziristan*, *Torghar*, *Lower Chitral*, *Upper
Chitral*, *Hyderabad* and *Karachi* — listed one by one in the suite, since a floor that said
"most of them" would let the next variant quietly lose another, and each shown to return at desktop
size.

The property the lists exist to protect is stronger than it was: a unit name on this map is inside
its own ground, or on paper attached to its ground by a line, or absent — there is no fourth case,
and in particular there is no name sitting inside a unit it does not name. **The nudges are held to
that rule too since #51**, which they were not before: `measureLabel` fitted a box to the unit's own
rings and `layoutLabels` then displaced it by up to two label heights to dodge a collision, so the
second step could undo the first — L7's *Punjabi* was fitted honestly and then nudged 32px, which
put both its right corners in the province next door. Latent rather than new, and it only began to
bite once names started sitting tight inside a lobe instead of loose near a centroid.

What a reader gets instead is stated rather than assumed, and it is why this is a legibility cost
and not the bottom sheet's `peek` problem. The unit is **outlined and in the accent** wherever it is
proposed; the **card lists every unit** by name with its own population, and on a phone that card is
the sheet the reader is already holding; and a **tap on any district names its unit** in the
tooltip's third line (#33), so no ground on the map is more than one press from the name of the
proposal covering it. What is lost is the name set *on* the ground, and it comes back on zoom —
asserted, for every one of them, at an ordinary 1200px desktop. **None now wants a wider frame
than that**, which is a finding rather than a default: four did until A1 to A4 were retired — A3's
*Gujranwala* at 1440px and A1's, A2's and A3's *Lahore* at 1920px, all of them rule-drawn units of
two or three districts in central Punjab with rule-drawn units on every side competing for the same
paper. The mechanism is kept even though the table is empty, because a name that wants a wider
desktop must be named with the width it wants rather than allowed to raise the frame for everybody.

**D1 was the variant that added none to that list, and it is now the longer of the two entries on
it** (#31). It cut each province in two and drew eleven units, each half a province, so its *Rahim
Yar Khan* and *Karachi* had room where the rule-drawn units of the same names did not. Under
the band rule it draws **35**, and the arithmetic reverses with it: the same paper, three times the
names, eleven of them a district wide. That the list is two variants long rather than nine is a
consequence of the labelling work; which variants are on it is a consequence of content changes.
The two are worth keeping apart, since neither caused the other.

**District names are the one tier with a zoom threshold** (#34). 156 names over a 369px frame is a
word search rather than a map, and the district is the building block every proposal is stated in
(D23) rather than a tier the base map draws — so below **6×** they are not laid out at all, and a
reader gets a district by **tapping** it, which is #33's gesture and answers with the name, the
division, the province, the population, the dominant mother tongue and the unit rather than with a
name alone. Above it they come in ranked under every other tier, so a district name can never take
the frame from the province it sits in. The threshold is past the 4× the district *lines* appear at,
because a line only has to be seen and a name has to be read.
