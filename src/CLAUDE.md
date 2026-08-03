<!-- Moved verbatim out of the root CLAUDE.md (see its pointer) so it loads only when
     working under this directory. -->

## Interaction

**Default:** current provinces and territories, named, with the seven first-level seats and the
ceasefire line. Nothing else.

**The map keys its own units, top left of the frame.** Under a variant the paper carries a small
box: the unit **count** — the first thing anybody asks of a proposal, *how many provinces would
there be* — and every unit named, each beside a swatch of the ground the map is painting underneath
it. It arrives and leaves with the outlines exactly as the card does (#19): the current map proposes
nothing, so at the baseline the box is emptied and the stylesheet's `:empty` rule takes it off the
paper altogether.

**A unit's swatch is not a unit colour, because there is no such thing** (D14). A unit is never
filled — what is under it is stratum 1, which is the basis's data and belongs to no unit — and
Punjab covers four mother tongues. So each row carries the unit's **own districts in the fills the
map actually paints them**, widest first: South Punjab reads as 8 Saraiki districts and 3 Punjabi
ones, and the Punjab it leaves behind as 23 Punjabi and 2 Saraiki. A single colour per unit would
report the Seraiki claim as coextensive with the Seraiki language, which is exactly the disagreement
between an outline and the shading beneath it that this map exists to show — and naming one of
Punjab's four would be a dominant mother tongue for a province, which the census publishes for no
province. The two absences stay apart in the swatch as they do everywhere else (#17): the twenty
AJK and GB districts hatch, Chitral stipples.

**The proportion is of districts**, which is the atom every unit is composed of (D23) and the one
quantity here that needs no source, being a count of what is drawn. Not of people and not of ground:
either would be a published figure implied by a 20px picture, and PBS publishes neither cut this
way. The colours themselves are keyed by the legend under the frame, which names every one of
them — identity is never colour alone.

**Which leaves the kind to the name**, set in the unit's own outline colour exactly as the map sets
it: the accent means *a proposed province* and nothing else, and it says so in the one place a
reader is already reading the names. Where a basis shades nothing — the Administrative and
Historical bases draw boundaries over an unshaded country — there is no ground to key, and the row
falls back to the outline's own stroke, which is why the stroke is carried on every entry and not
only where the fills are missing.

It is a different question from the legend under the frame, which is why both exist. That one says
what a *stroke means* — proposed, unchanged, territory — and a reader matching a colour to a shape
has to look away from the map to do it; this says *whose boundary that is*, on the paper, where they
are already looking. It names **every** unit and not only the proposed ones, for the reason the card
lists them all: a variant is a complete partition, and a key naming only what is new leaves a reader
unable to say what the rest of the country has become.

Three things it does not do. **No populations and no printed district counts** — those are the scorecard's
(#20), printed in full where a reader compares two proposals straight down a column, and a second
set of figures on the paper is a second place for them to be wrong. **It does not answer to
compare**, on the same grounds as the legend and the card: the reader is holding a key down over the
map, the proposal is still selected, and rewriting the paper's own furniture underneath them would
be the page changing rather than the map. And it takes **no pointer events**, because a reader
panning through that corner is reading the map and not the key.

**The order is the card's, and it is one order rather than two that agree today.** Both read
`unitsProposedFirst` — proposed units first, and inside a kind the partition's own order, since
nothing in the bundle ranks Sindh against Balochistan. The two lists are read one after the other,
and a unit third on the paper and seventh in the card reads as two different units.

**It takes part in the label layout, unlike the division toggle beside it.** That chip is small and
translucent in a corner the names rarely reach; this is a solid box of up to fifteen lines, and a
name left underneath it is a name a reader cannot read — so it is seeded into the same `occupied`
set the docked tooltip is (#33), and the four-step yielding order ends in *no name at all* rather
than in a name behind a box (D12). The cost is stated rather than hidden: under a variant the
north-west corner is spent, and a name that would have sat there gives way for as long as the
proposal is on screen. It comes back on zoom, and the box names the same units the name would have.

**It is not drawn at 390px, and that is a decision rather than a fallback** (#33's bar). The top of
the frame is the docked tooltip's and the bottom left is the division toggle's and the two actions';
what is left is 369px of country, which is the one thing the hard bar is about, and a box of fifteen
names over it would cover more of Pakistan than it explained. Nothing is lost that a reader cannot
reach: the card is the sheet already in their hand and lists every unit with its own population, and
a tap on any district names its unit in the tooltip's third line.

**And it is `aria-hidden`.** The map already names every region in words for a screen reader (#35,
`lib/regions.ts`), with each unit's constitutional standing beside it; this is the same list with
less in it, and reading it out again would give a reader the units twice and the standing once.

**The division tier is offered, not assumed — one toggle, top right of the map frame.** *Show all
divisions* draws the ~39 divisions and their 37 names; off, which is how the page opens, the map is
the first-level units, the seven dots and the dashed line. Three things about it are decisions
rather than defaults.

It goes **whole or not at all**: the boundaries are withheld by the stylesheet and the names by
`lib/labels.ts`, and a division name floating over ground with no division boundary under it names
a shape the map is no longer drawing. The **legend follows it** — the `Division` swatch is keyed
only while the tier is drawn, on the same rule the export band's key already follows when it
refuses to key a basis it has no fill for: a swatch for a line the map is not drawing explains a
picture that does not exist. And it is **not in the URL and not in the browser's history**, exactly
as the sheet's detent is not (#33): how much administrative detail a reader has switched on is a
property of the device in their hand, and a shared link argues about a proposal rather than about
the sender's detail setting.

What it does **not** buy is asserted beside what it does, because the obvious reading is wrong. It
rescues **not one** of the seven unit names this build cannot set at 390px: the unit tier's floor
outranks every division outright (`UNIT_FLOOR`), so a division has never been able to evict a unit
and removing it frees nothing. Those units are crowded out by *each other* (#28), which is open
item 5's problem and not this control's.

It sits on the map rather than in the controls well because it changes the paper rather than the
argument — the same reason Compare and the export sit apart from the two radio groups. A
pressed-state `<button>` and not a checkbox, since every control on this page is a button and that
is what `holdsCompare` relies on when it refuses `Space` to a focused control (#22). On a phone it
moves to the bottom left, on its own line above Compare and the export: the docked tooltip is a
full-width opaque bar squared off against the top of the frame (#33) and would paint over it while
still letting a tap through, which is an invisible live button — worse than a moved one.

**Two regions on a wide screen, and a block underneath.** Above 1000px the page is not one column:
the **controls** run down the left, the **map takes everything else**, and the card's three blocks
sit under it — the **argument** at a prose measure, the **units and the scorecard** beside it, and
the **footnotes and sources** to their right. Below 1000px the page is the single column it always
was, and below `--sheet` it is the bottom sheet (#33).

**The units and the scorecard were a rail beside the map, and are not any more.** The case for the
rail was that a unit's population is read against the ground it covers; the case against it is that
it cost the map a fifth of the page at every width, on a page whose whole subject is a boundary.
The country is nearly square and the figures are a list — a list reads perfectly well below the
map, and a map does not read perfectly well in four-fifths of a column. So the frame takes the
rail's column outright, which it already did at the baseline, and the bottom block gains the third
column the rail gave up. At 1600px that is 1244px of map where it was 908.

Two consequences rather than decisions. **Nothing scrolls inside the page any more**: the rail
needed a `max-height` because eighteen units is longer than Pakistan is tall and a list sized to its
own content would have taken the map row down with it — below the map there is no row to protect, so
the list is simply as long as it is. And **the prose measure moved from the box to the lines**:
capping the argument *column* at 68ch left it short of its own grid area, which read as a panel that
had failed to load next to the units beside it, so the box keeps the area and the paragraphs keep the
measure. Under 1360px three boxes across is one too many — the argument would set at 340px — so
there the small print keeps its column and the argument and the units take the rest of the page one
above the other.

It is **placement and nothing else**. `panel.ts` still renders one card into one mount and knows
nothing about where the page puts the pieces: the card is three columns in one DOM order — the
argument, then the units and the scorecard, then what qualifies them, which is the card's own order
read top to bottom (#19) — and the stylesheet moves them with `display: contents` and named grid
areas. So the sheet still holds the card **whole**, which is the rule that section states: a card
that hid its opposition line on a phone would read as an endorsement on a phone. A prose field
added to the card later lands in the bottom block by construction, because that is where the column
it is appended to is put.

One thing follows from the geometry rather than being decided again: the variant group and Compare
are collapsed *away* at the baseline rather than left as reserved space, because the reason they
were reserved — not moving the map under the pointer — is a fact about controls sitting *above* the
map, and here they sit beside it.

**Selecting a basis:** current boundaries fade back, districts shade by that basis's data,
the active variant's unit outlines draw prominently on top.

**The selectors (#18).** Two radio groups, never dropdowns: a basis and a variant are each
one-of-N and the alternatives *are* the product. The baseline sits first among the bases, because
returning to the real map is the same kind of act as choosing one. **A basis is never active on
its own** — selecting one selects its first variant (D13), so there is no state that means
"shaded, with nothing proposed over it". All four bases are always offered, **two of them are live**
— Language and, since #31, Development — and the two that cannot yet be drawn are **refused out
loud**: the control says whether the variants are missing, the shading is missing, or both;
Administrative and Historical have their variants written and want only a fill, and no basis is now
short of both. Said on being pressed and not only on hover, since `disabled`
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

**Under the Development basis it carries two, and the missing third is a difference rather than an
omission** (#31). A district falls in one of four **bands** of the composite, or it is left at the
unshaded baseline because PBS published none of the three rates for it — the same twenty. There is
no stipple, because a mean of three published rates always has a value where a dominant mother
tongue is an answer the census can fail to name; the vocabulary is shared (`lib/fill.ts`) so that
the two bases cannot draw the same absence two ways.

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

**Under the Development basis the tooltip carries the shading's own evidence too, and it must**
(#31). Every other fill on this map is a figure PBS published and the tooltip already prints it; the
development fill is a **composite this project defines**, and a number of ours on screen with
nothing but a colour to explain it is the one shape of unsourced surface the working agreement
forbids. So the box carries the composite with its formula and its `synthesized` badge, and then all
three components — each with the PBS table it came from and **its own denominator**, since the three
do not share one — so a reader who disagrees with weighting them equally can see all three and say
so. The third is *Households with a flush toilet* and says why it is not called improved sanitation.

Two costs, stated. This is the **longest tooltip in the app**, six figures deep. And the
mother-tongue line stays rather than being swapped out: it is the census's answer for the district
and not a claim about the shading, it has been on every tooltip since #13, and a district whose
tooltip means different things under different bases is a district a reader cannot compare with
itself. The development figures are dropped whole where a variant withholds modern ones (H2), for
the reason that rule exists — they are a mean of 2023 rates, and three of them beside a boundary of
1947 would be the same claim the withholding refuses.

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

**Download PNG (#32)** — the export button, beside Compare. Present at the baseline as well as
under a proposal, unlike Compare: the current map is exactly as likely to be screenshotted as a
proposed one, and the sanctioned copy is the one carrying its own sources. One format and one
resolution, no menu — the whole argument for the feature is that it must be less effort than the
screenshot key. Disabled for the duration of the encode rather than debounced, since on a phone a
second press lands before the first PNG is done and two files is a confusing answer to one press;
a failure is spoken rather than swallowed, because a button that silently does nothing reads as a
broken page.

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

**A unit's name is fitted to the ground it names, and where it will not fit it is taken outside it
on a leader** (#50). Until this pass a unit name was measured against the shape's **bounding box**,
which on a crescent, a coastal strip or one of #28's rule-drawn slivers is mostly somebody else's
ground: `SOUTH PUNJAB` was set 124px wide over 73px of room, and half of it lay in the Punjab the
proposal is carved out of. On a map whose whole subject is which district belongs to whom, a name
crowding or crossing a boundary is a claim nobody wrote — and it is the one claim a footnote cannot
take back, because the reader has already read it off the picture.

So the name is now fitted in four steps, in order, and the first of them is the one that was already
here. The unit's **own attested abbreviation** is tried first and **nothing is ever invented**. The
name is then **broken on its bracket** — L7's regions are `Balochi (Kech)` and `Pushto (Keamari)`,
and set on two lines a box is as wide as its wider line rather than as wide as the sum; broken there
and nowhere else, since hyphenating would coin a spelling no source uses and wrapping on measurement
would break the same name in different places at different zooms, so a reader zooming in would watch
a proposal's name reflow. It is then **set down a short ladder** until it clears the room, bounded at
both ends: never larger than the province size, because a unit is told apart from a province by
colour and not by scale, and never below **7.5px**, which is the smallest type this map will set.
And where even the floor will not fit, the name goes **outside the shape on a leader**.

**The floor was the district tier's 8.5px until #51 and is not any more**, because that bound was
defending a collision that cannot happen: district names are not laid out at all below
`DISTRICT_LABEL_ZOOM`, and at 6× a unit has room to spare and is nowhere near the floor, so the two
tiers never co-occur at a size where a reader could compare them. What is left is the absolute
legibility floor, which is the half of the rule that was ever load-bearing. It buys ~12% of width
and is honestly a **trim rather than a rescue** — the names badly over their ground are over by
multiples, and those still go out on a leader.

**The room is measured, not assumed.** `interiorRoom` casts a ray each way along both axes from the
anchor and keeps the nearest crossing, so a hole, a neighbour's bite out of a crescent and the outer
edge all stop it alike; the usable box is twice the shorter reach on each axis, less a few px of
clearance, so a name never touches its own boundary either. That is the fast question and not the
exact one — a diagonal boundary can leave both rays clear and still take a *corner* of the name, as
Sindh's, A1's Hyderabad's and D1's Quetta's did — so the box's whole perimeter is then checked
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
wherever `geoContains` said it was inside, and D1's Khuzdar and A4's Killa Abdullah have centroids a
*tenth of a pixel* from their own boundary — a hairline of polygon left by the dissolve, technically
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

**Nearest first, and bounded.** Candidates are ranked by the length of the leader they need, so a
name sits as close to its ground as the paper allows, and any leader longer than **0.6 of the
frame's shorter side** is refused and the name dropped. Against the shorter side because that is the
axis with the least paper on it — the projection fits the country to the tighter of the two — so a
cap measured on the roomy axis would be no cap at all on a phone; at the 390px bar it is ~202px.

**0.6 is measured rather than argued**, and it was 0.4 on argument alone for one round. 0.4 silently
drops H3's *Northern Areas* — which is Gilgit-Baltistan under the name that variant gives it, so a
number picked for tidiness was leaving a territory drawn and **anonymous**, the one thing the
politically sensitive rendering section exists to prevent. That name is anchored 298px into a 369px
frame and is 113px wide, so it has to travel left across the country: 202px of leader where 0.4
allowed 134. 0.55 is where it returns, 0.6 also recovers L6's *Southern Pakhtunkhwa* and one of
A3's, and 0.7 buys nothing further. Uncapped, A1 to A3 — which strand four to six rule-drawn units in central Punjab —
would fan five or six leaders the width of the country into one margin, and the map's subject would
be overdrawn by its own furniture. A cap on the *number* of callouts was the alternative and was
refused: it silences units by quota, and a reader cannot tell why this one and not that one.

**A name on paper is set one step down from a name on its ground** (#51) — one fixed 0.78, the same
for every callout. It used to be set at full size, on the reasoning that outside the shape there is
no ground constraining the type and a name shrunk to fit a room it is no longer in pays twice. That
was sound while the floor was 8.6px and callouts were rare, and it is not sound now: an in-ground
name may be set at 7.5px, so a full-size callout made the **loudest type on the map** belong to the
units that fit worst, at nearly twice the size of a name sitting honestly on its own ground. One
size rather than a ladder, because out on the margin there is no ground to explain why one callout
is smaller than the next. It bends "told apart by colour, not by scale" (D14), which is a rule about
a unit against a province — and every callout is already marked as the exception by the line
attached to it.

Four things the leader will not do. It takes the unit's **own outline colour**, so the accent still
means *a proposed province* and nothing else (D14). It is **furniture and stays in screen px** at
every zoom, like the type it carries and like the city dots. It may **never cross another label or
another leader**, nor anything already standing on the paper, nor the name it is carrying — a leader
that crosses points at a word rather than at a piece of ground, and two that cross swap the units
they name, which is the one mistake a callout could make that is worse than no callout. It **may**
cross other units' land, and has to: that is the only way to reach the margin, and a line over
ground is not a name over ground. And where no candidate is clear the name is **dropped**, exactly
as an unplaceable name is dropped today; the layout is recomputed on every zoom, and the room is
what brings it back.

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
A3's *Rahim Yar Khan*, which used to be named and now wants paper its neighbours reach first. The
currency is still the currency, and it is stated rather than netted off.

One territory is left. H2's **Gilgit Agency and Baltistan** — the same ground under the name it
carried in 1947, and at 279px the longest unit name in the app (#30) — has no attested initialism,
so 279px of type plus its dot and its clearance does not fit either side of an anchor that far east
in a 369px frame. Stated in the suite by assertion rather than in prose, and shown to return at
desktop size, because a coinage would be a name for Pakistani-administered ground that no source
uses. What otherwise gives way is
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
to evict each other, and #28's rule-drawn partitions are the first that are: at 390px A2 and A3
dropped **Azad Jammu & Kashmir**, whose own `AJK` is 31px of type over 29px of ground, to make room
for *Rawalpindi*, which is 103px of type over 42px. A territory drawn and anonymous is a claim about
Pakistan-administered ground that nobody here decided to make; a proposed unit that gives way is a
legibility cost that returns on zoom. So the tier has two floors. It is keyed on **the kind the
bundle records and never on the name** — H3 calls Gilgit-Baltistan the *Northern Areas* and H2 calls
it the *Gilgit Agency and Baltistan*, and a rule
reading names would stop protecting a territory the moment a variant renamed one, which is the
failure #34's own review found in the criterion it was asserting. Two things it does not buy, both
stated because both are real: it cannot rescue a name that has nowhere to go, which since #50 is a
*third* failure again and is told apart from the other two by assertion — H2's *Gilgit Agency and
Baltistan* does not fit its own ground, so it is marked for a callout, and there is then no paper
either side of it wide enough to take one. A name **outranked** is what #28 fixed; a name **spilled
over its ground** is what #50 fixed; this is neither. H3's *Northern Areas* was in this paragraph
until #50 and is not any more: a callout does not have to be over the ground it names, which is what
a ranking could never buy. And it is not free — A1 had been
naming AJK by nudging it clear, and giving it the corner outright is part of why *Rawalpindi* and
its neighbours are the last names on that variant's map to find room. A5 is the deliberate exception,
its AJK and GB being *promotions*, recorded as `proposed`, argued as provinces and ranked as the
proposals they are.

**The bar is not met by A1, A2 and A3, and this says so rather than leaving it to the table.** Those
three are not transcribed proposals whose author chose the names — they are what the rule engine
draws (#27), and a rule stated as "no province above 25 million" produces fourteen to sixteen units,
most of them packed into Punjab and upper Sindh and each named after its capital district. At the
bar the country is 369px across and central Punjab about 120px of it, while *Bahawalnagar* alone is
124px of type. There is no packing of six such names into that ground, no attested abbreviation for
any of them, and inventing one is the thing the short-form table exists to refuse. Since #50 most of
those units are out on **leaders** into the paper beside the country, and what is left over is what
the paper could not take: since #51 **six units across the three go unnamed at 390px** — A1's *Rahim
Yar Khan* and *Bahawalnagar*, A2's *Lahore* and *Faisalabad*, A3's *Rahim Yar Khan* and
*Bahawalnagar* — listed one by one in the suite, since a floor that said "most of them" would let the
next variant quietly lose another. It was thirteen across the three before #51, and five more
outside them; the only unit still unnamed outside A1 to A3 is H2's *Gilgit Agency and Baltistan*,
which is the territory case below rather than this one.

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
asserted, for every one of them, at desktop size. Four want a wider desktop than the rest and are
named with the width each wants rather than allowed to raise the frame for everybody: A3's
*Gujranwala* returns at 1440px, and A1's, A2's and A3's *Lahore* at 1920px. That it is *Lahore* in
three of the four is the engine's doing rather than a coincidence — the ceiling and the count rules
each seat a capital there, and the unit around it is small because the population is not.

**D1 adds none to that list, and the reason is the shape of the map rather than luck** (#31). It is
also rule-drawn and its units are also named for a district, but it draws **eleven** where A1 draws
eighteen, and each of the eight is half a province rather than one of six units packed into central
Punjab — so its *Rahim Yar Khan* and *Karachi East* have room where A1's unit of the same name does
not. Every one of its units is named at the bar, which the suite asserts along with every other
variant's rather than by name, because the general check is what would catch an eighth.

**District names are the one tier with a zoom threshold** (#34). 156 names over a 369px frame is a
word search rather than a map, and the district is the building block every proposal is stated in
(D23) rather than a tier the base map draws — so below **6×** they are not laid out at all, and a
reader gets a district by **tapping** it, which is #33's gesture and answers with the name, the
division, the province, the population, the dominant mother tongue and the unit rather than with a
name alone. Above it they come in ranked under every other tier, so a district name can never take
the frame from the province it sits in. The threshold is past the 4× the district *lines* appear at,
because a line only has to be seen and a name has to be read.

**Stratum 3's line work is thinned at the bar**, and only its absolute weights are. The strokes are
`non-scaling-stroke`, so they are the same screen px on a 369px-wide country as on a 1200px one —
three times heavier relative to the ground they describe. The *ratios* are kept, casing to line and
proposed to unchanged, because those are what say which line is a proposal and which is the country.

**On a phone (#33)** — the card is a **bottom sheet**, hover is a **tap**, and Compare moves to the
corner a thumb reaches — as one row with the PNG export (#32), because the two are the same kind of
control and #32 says so itself: neither chooses what the map shows, and both act on whatever is
already on it. None of the three is a second version of the app: the sheet holds the same
card, whole, because a card that hid its opposition line on a phone would read as an endorsement on
a phone; and the Compare button is the gesture it already was (#22), holding the comparison until it
is pressed again, moved rather than redefined.

The sheet **takes up no room at all when there is no card**: `panel.ts` hides the container at the
baseline, and a reserved height left standing behind it strands the compare and export buttons a
third of the way up a map with no sheet under them. The sheet rests at **three detents** — `peek`, the ticket's ~40% `half`, and `full`, which stops
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

**The tooltip docks rather than follows**, and for two reasons that are not cosmetic. The pointer is
a finger and it is standing on the district the box is about, so a box beside the pointer is a box
over the answer. And the sheet *overlays* the map rather than shortening it, so a box clamped
honestly inside the map's own frame can still come out underneath the card, clipped at whichever
line the sheet happens to reach. Docked to the top of the frame it is the one place the sheet cannot
reach. Nothing is dropped and nothing is abbreviated to make it fit — every figure keeps its label,
its value, its note and the release it came from, because a tooltip that shed its sources on a phone
would shed them for most of this app's readers; what changes is only that a label sits beside its
value instead of above it.

**The docked box takes part in the label layout**, and it has to, because it is an opaque bar across
northern Pakistan — over Gilgit-Baltistan, Azad Kashmir and the ceasefire line's own name. `layoutLabels`
cannot see a `<div>`, so it is seeded into the same `taken` set the names contend over, and put to the
line's name as well as to the tier names — a separate placement path, and leaving it out was worse
than doing nothing: the tier names yielded, which freed the north, and the line's name then walked
into exactly that space and set itself at full length underneath the box. So the four-step order
means what it says here too, ending in **no name at all** rather than in a name a reader cannot see
(D12). The names come back the moment the box is dismissed; the pass is labels only, with no
re-projection, which is what makes it cheap enough to run on a tap.

**The sheet overlays the map; it never resizes it.** The room the page keeps for it is the room it
takes when it is *down* (`--sheet-peek`), never its current height. `map.ts` redraws on a
`ResizeObserver`, and a redraw refits the projection and relays out every label — so a frame tied to
the live height would re-project the country on every frame of the drag, and the map would zoom and
shift under the very finger opening the card. The country does not move under a gesture, which is
the rule compare is already held to. The accepted cost, stated rather than hidden: at `half` the
sheet covers the lower part of the map **and the legend**, and both come back the moment the card
comes down.

**Without a mouse (#35).** The two selectors have declared `role="radiogroup"` since #18, and that
is a promise about the **arrow keys** as much as about the accessible name — one that the markup
made and the behaviour did not keep until now. Each group is **one stop on the tab ring**, on
whatever is currently checked (tabbing through five bases and then eight variants to reach the map
is a journey nobody finishes), and the arrows move within it and select as they go, which is the
radio pattern rather than a shortcut: focus and selection travel together, and there is no state
here in which a basis is focused but not chosen (D13). They **wrap**, because a group that stops
dead leaves a reader pressing a live key that does nothing; and they **step over the three bases
that cannot be selected**, since `disabled` refuses focus and landing on one makes the key look
broken. Where a key lands is `lib/radio-group.ts`'s, under test.

Only the keys the group claims have their default suppressed. `Tab` still leaves, `Enter` still
activates, and **`Space` is never touched** — it is the compare gesture (#22), and taking it here
would undo the care `holdsCompare` already takes to leave it to the focused control. All three
readings were checked in a browser: `Space` on the Compare button toggles the hold once and does not
double-fire, `Space` held on the focused map holds the comparison and releases it, and `Space` on a
focused variant chip switches variants and does *not* compare.

**Focus is visible on every control**, at two pixels of the map's own ink — the chips, both action
buttons, the sheet's grip, the audit panel's summary and the map itself. Stated once, because a ring
that exists on some controls and not others is worse than none: it teaches a reader to trust it and
then loses them. **Not the accent**, which means *a proposed province* and nothing else (D14);
spending it here would put the loudest colour on the page under a cursor rather than on the one
thing that does not exist yet. `:focus-visible`, so a pointer user who clicks a chip is not given a
ring they did not ask for.

**The map's regions are named in words** (#35). `role="img"` means assistive technology reaches no
path inside the SVG — which is right, since 156 unlabelled shapes announced one at a time is noise
and not a map — but it leaves the graphic with a single accessible name for a whole country. So the
regions are named in a list beside it, available to a screen reader and never painted: an
*equivalent* rather than a pantomime of one, and a better answer than making 156 paths focusable,
which would hand a keyboard reader 156 stops and no way past them. Units replace provinces there
exactly as they do on the map, or a reader is given "Sindh" twice and left to work out whether that
is one place or two. The standing words are **the tooltip's own and are not written in the roster at all** — a current
unit's comes from `describeKind` and a proposed one's from `UNIT_STANDING`, both exported from
beside the tooltip, so a reader who hovers a district and then reads the list is never given two
different words for one constitutional fact. The test compares against those exports rather than
against a copy of the strings: pinned to a literal it would pass green with two vocabularies live,
which is the failure it exists to prevent. Not a live region: it describes what is on screen, and announcing
eight units on every variant change would talk over the readout that is actually answering them.

**The map is walkable with the keyboard** (#35), and this is the part of the ticket that matters
most. The readout is the only per-district surface a screen reader has, and everything that wrote to
it was a pointer — `pointermove` on a desktop, a tap on a phone — so a reader with no pointer could
focus the map and never make it say a word. Arrow keys now walk the districts from the focused map,
`Home` and `End` reach the ends, and `Escape` puts the readout away. Each stop goes through the same
`showDistrict` the pointer uses, so the wash, the tooltip and the spoken sentence cannot drift apart
— and the box is drawn as well as spoken, because a reader using a magnifier has a keyboard and eyes
both.

**The walk is a reading order, not a compass**, and is not pretended to be one. A spatial walk over
156 irregular polygons has no honest answer for "which district is left of Gwadar" at a coastline,
and a reader who cannot see the map cannot check the answer it invented. What they can rely on is an
order that is stable, complete and the same every time: province, then division, then district —
the administrative hierarchy the map is built on (D23), and the order the tooltip reads a district's
own address in. Bundle order would have been arc order, which puts a reader in Sindh, then Punjab,
then Sindh again. `Space` is refused by the walk as it is everywhere, so a reader can walk the
districts and still hold the country up against the proposal.

**An arrow key inside a group replaces its history entry rather than pushing one** (#23, #35). The
rule is the one `go` already followed — a hash the reader *chose* is history, a hash they merely
passed through is not — and an arrow key auto-repeats, so a reader scanning eight variants with a
held key would have to press Back eight times to leave a group they never meant to enter. A click is
still an entry, and so is the variant they stop on, because stopping is the choosing.

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

---

