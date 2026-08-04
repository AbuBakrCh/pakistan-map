# Map furniture — the unit key, the fill key, the method note, the division toggle, the page regions

The things drawn around the map rather than on it. `src/CLAUDE.md` carries what each
one is and the rules it follows; this file carries why each was decided that way.

---

**The map keys its own units, top left of the frame.** Under a variant the paper carries a small
box: the unit **count** — the first thing anybody asks of a proposal, *how many provinces would
there be* — and the **proposed** units named, each beside a swatch of the ground the map is painting
underneath it. It arrives and leaves with the outlines exactly as the card does (#19): the current
map proposes nothing, so at the baseline the box is emptied and the stylesheet's `:empty` rule takes
it off the paper altogether.

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
are already looking.

**It names the proposal, and it counts what it names.** It listed every unit once, for the reason
the card lists them all — a variant is a complete partition, and a key naming only what is new
leaves a reader unable to say what the rest of the country has become. What was wrong with that was
not the principle but where it put the answer: the unchanged units are exactly the ones a reader can
already name off the map in front of them, and printing them cost D1's key thirty-five rows and put
most of them out of sight. So the rows are the ones the reader could not have supplied, and the
heading counts those rows and no others — `1 proposed unit`, `32 proposed units` — since a key of
one row headed by l1's eight leads with a number none of its own rows accounts for. The word
*proposed* is in the heading rather than left to the accent, so the count is never taken for the
whole partition. That figure is the card's and the scorecard's, printed in full on both, along with
the units the variant leaves alone and each one's population.

**Where a variant redraws inside the provinces that already exist, the rows are grouped under
them.** A6 cuts five current units into nineteen and D1 cuts four into thirty-two; nineteen names in
a column is a list, and the same nineteen under *Punjab*, *Sindh*, *Khyber Pakhtunkhwa*,
*Balochistan* and *Islamabad Capital Territory* is the proposal's own structure. It is the structure
the reader is looking at, too: every one of those outer edges is still drawn on the map, in the
boundary stratum's own weight, because the variant did not touch it. Without the headings the reader
has to do that grouping off the map to answer the question the proposal is actually making — *what
would this province become*.

**It is asked of the variant, never of the basis.** "The Administrative and Development bases do not
cross provincial boundaries" is a fact about A6's and D1's district lists rather than a property of
the bases they are filed under, so the key derives it from the districts, district by district, and a
variant added tomorrow that crossed an edge would have to break that check first. Four variants
answer no today — **L3**, the one transcribed proposal whose province crosses an existing provincial
boundary, and L7, H1 and H2 — and their keys are the flat list they always were. It is **all or
nothing**: a partition half of whose units respect the provinces is a partition that does not, and
grouping the obedient half would report a provincial structure the other half contradicts.

Three things about how it is drawn. The province is named **as the census names it**, which is the
only place this app has a district's province from — so the heading is `Islamabad Capital Territory`
in full and the word *province* appears nowhere in it, because nothing calls Islamabad a province. A
unit reaching ground the census publishes no province for — AJK or Gilgit-Baltistan (D25) — is not
grouped and **takes the whole key flat with it**, since a heading this app had to guess is exactly
the unsourced surface the working agreement forbids. And grouping is the one thing on this box
allowed to move a row: it moves them **as little as it can**, keeping the card's order inside each
province and taking the provinces in the order their first unit comes in, so the key and the card
still meet the units in the same order within any ground they share.

**Nothing is below a fold, and this is the decision the shape of the box is built around.** The key
does not scroll. It used to: it was capped at 60% of the frame with a standing scrollbar, on the
argument that a bar which fades asks a reader to discover by accident that the key continues. But a
standing bar only advertises the problem — a key a reader has to scroll is one they take for the
whole proposal until they happen to scroll it, and a key that misreports the partition is the one
thing this box exists to prevent. So the rows run **down before across**: eighteen to a column and
never more than two columns (`unitRoster.columns`, arithmetic rather than a media query, and under
test), which holds the longest key this build has — D1's thirty-two proposed units under their four
provinces, thirty-six lines exactly, since **a province heading takes a line of a column as a unit
does** — whole. Where the two collide the **grouping** is what gives way and never the fold: the
headings are an improvement to a key that already worked, and a row out of sight is the partition
misreported, which is what this box exists to prevent. Down
before across, because the corner the box stands in is the sea and the ground west of Balochistan:
deep and narrow. Three columns of twelve fit the same rows and reached across the country itself. The count is set
inline by the renderer because the box is shrink-to-fit: a multi-column box with no column count
is one column wide however many columns it draws, and the rows would fall outside their own
background and outside the rectangle the label layout keeps names off.

Two things it does not do, and one it no longer has to. **No populations and no printed district
counts** — those are the scorecard's (#20), printed in full where a reader compares two proposals
straight down a column, and a second set of figures on the paper is a second place for them to be
wrong. **It does not answer to compare**, on the same grounds as the legend and the card: the reader
is holding a key down over the map, the proposal is still selected, and rewriting the paper's own
furniture underneath them would be the page changing rather than the map. And it now takes **no
pointer events at all**: it took the wheel only because it scrolled, so the cost that came with
that — the map could not be panned or zoomed through this corner while a key was drawn — is paid
back by the same change that put the rows in columns.

**The order is the card's, and it is one order rather than two that agree today.** Both read
`unitsProposedFirst`, so the key is the card's own opening rows name for name; inside a kind the
partition's own order stands, since nothing in the bundle ranks Sindh against Balochistan. The two
lists are read one after the other, and a unit third on the paper and seventh in the card reads as
two different units. The grouping above is the **one** thing allowed to depart from it, and it
departs by the least it can: the same rows, every one of them once, in the card's order inside each
province and with the provinces in the order their first unit comes in — so nothing here ranks Sindh
against Balochistan either.

**It takes part in the label layout, unlike the division toggle beside it.** That chip is small and
translucent in a corner the names rarely reach; this is a solid box of up to eighteen lines and up
to two columns of them — **measured** rather than assumed, so a key that grew a column takes the
ground it actually covers — and a name left underneath it is a name a reader cannot read — so it is seeded into the same `occupied`
set the docked tooltip is (#33), and the four-step yielding order ends in *no name at all* rather
than in a name behind a box (D12). The cost is stated rather than hidden: under a variant the
north-west corner is spent, and a name that would have sat there gives way for as long as the
proposal is on screen. It comes back on zoom, and the box names the same units the name would have.

**It is not drawn at 390px, and that is a decision rather than a fallback** (#33's bar). The top of
the frame is the docked tooltip's and the bottom left is the division toggle's and the two actions';
what is left is 369px of country, which is the one thing the hard bar is about, and a box of eighteen
names — two columns of them under a rule-drawn variant — would cover more of Pakistan than it
explained. Nothing is lost that a reader cannot reach: the card is the sheet already in their hand and lists every unit with its own population, and
a tap on any district names its unit in the tooltip's third line.

**And it is `aria-hidden`.** The map already names every region in words for a screen reader (#35,
`lib/regions.ts`), with each unit's constitutional standing beside it; this is the same list with
less in it, and reading it out again would give a reader the units twice and the standing once.

**And the map keys its own colours, top right, under the division toggle.** Stratum 1 is the half of
the map a reader checks most often and the half the paper explains least: an outline is named where
it is drawn, and a fill is named 500px below the country in the legend under the frame. So the same
rows are repeated on the paper — every colour the map has actually painted, beside the answer it
stands for: nine mother tongues under the language basis, four bands of the composite under
Development, four bands of district population under Administrative, and in every case the absences
(#17), because a stipple and a hatch a reader cannot key are two greys they will read as one.

**Repeated is the operative word.** The entries are `motherTongueLegend`'s, `populationLegend`'s and
`developmentLegend`'s — the same three functions the legend under the frame is built from, and the
same three the export band derives its key from (#32) — so the three surfaces cannot key one fill
three ways. Nothing here composes a label, and the heading is the basis's own `name` off the artifact.

**It keys the ground the map painted, and only that.** The language basis's six categories that are
named by the census and dominant in no district stay below the frame, where they are grouped and
explained: six swatches on the paper for six colours no district carries would be the on-paper key
explaining a picture that is not there — the same rule the `Division` swatch follows when the tier is
off, and the same one the export band's key follows when it refuses a basis it has no fill for. Under
a basis that shades nothing, and at the baseline, the box is emptied and `:empty` takes it off the
paper, exactly as the unit key is emptied when nothing is proposed.

The rest it inherits from the unit key opposite it, because it is the same kind of object and any
difference would be arbitrary: it **does not answer to compare**, it **takes the wheel** and scrolls
when a basis has more categories than the frame is tall, it is **seeded into the label layout**, and
it is **`aria-hidden`** because the legend below carries these rows in these words already. It is
**not drawn at 390px** for the reason the unit key is not — the top of the frame is the docked
tooltip's, and eleven rows over 369px of country would cover more of Pakistan than they explained,
while the legend under the frame is unchanged on a phone and carries every row in full.

The cost is the mirror image of the unit key's and is worth stating on its own, because this corner
is not the other one: the frame's top right is the Kashmir salient, so under a shaded basis this is
where the four-step yielding order is most likely to end in *no name at all*. It ends there rather
than under a box (D12), and the ceasefire line's own name concedes length before it concedes
existence — which is the order it already follows.

**And the map says how it was built — a few sentences under the unit key** (#52). Three surfaces already
say what is on screen: the card says what a variant *claims* and who claims it, the legend says what
a colour means, the scorecard says what the partition comes to. None of the three answers the
question a reader asks first of a boundary they can see was not transcribed — *how did you get this
line?* That answer existed, in `docs/derived-variants.md`, on no surface a reader of the map ever
reaches. So it is on the paper, in prose, beside the key that names the units the rule produced.

**It is basis-first and variant-second, and the order is the argument.** The shared paragraphs are
the basis's — the ground every one of its boundaries is argued on — and a variant may add **one**
paragraph saying what this particular map does with that ground: L1 follows the South Punjab
Secretariat's existing boundary, L2 adds Mianwali and Bhakkar to it, L3 crosses a provincial edge to
reach Dera Ismail Khan. A variant's line **adds and never replaces**, because a variant free to
overwrite the shared rule is free to describe a method the map beside it was not drawn by, and the
box would then be the one surface on this page arguing with the card next to it. Where a basis
carries one variant — A6, D1 — the basis's rule *is* that map's, and nothing is added.

**Three of the four bases have one, and Historical's absence is a decision that is asserted.** A
basis with nothing written draws no box at all rather than a heading over a placeholder, on the unit
key's own `:empty` rule: an invented summary would be this app's editorial voice on the one surface
whose every other sentence is sourced. Historical is the basis still short of a fill (`src/CLAUDE.md`)
and it is now the basis short of a summary too, and the suite names it — the four variants are on the
map and none of them yet says how it was arrived at.

**Nothing here composes a sentence.** The words are `src/lib/method.ts`'s, written and reviewed in
that file exactly as the card's are written in `lib/card.ts`, and `main.ts` sets them with
`textContent` and adds nothing. Every basis key and every variant key is held against the committed
bundle by the suite, so a summary cannot describe a map nobody can select — and a **retired** id is
refused by name, since a rule attached to a withdrawn proposal is worse than a missing one.

**It sits under the unit key, and where it goes when it will not fit is measured rather than
predicted.** The left rail is the preferred position because the two boxes are one thought — that box
names the units, this says by what rule they were drawn — and reading order gives it for free. What
the rail cannot do is bound itself: the unit key does not scroll, on purpose, so a rule-drawn variant
sets two columns of eighteen rows and there is no room left on that edge for a paragraph. A note that
stayed would run out through the bottom of the frame, and a summary cut off mid-sentence is worse
than a summary in the other corner. So `placeMethodNote` measures the rail against the frame and
moves the box to the **bottom right** only when it does not fit — a unit count or a breakpoint
guessing at the height would be wrong about the reader's font size, and the fallback costs nothing on
the variants that never reach it. It is re-asked on `resize`, since fitting is a question about the
frame's height.

The fallback corner is the fill key's edge, and the cost is stated rather than hidden: under a shaded
basis with many categories the two could meet, which is exactly what drove the box off that corner in
the first place — the language basis's fifteen mother tongues reach 60% of the frame. It happens to
be bounded, because the bases fall the right way round: the basis with the long fill key (Language)
has the variants that propose few enough units to leave rail space, and the bases whose variants fill
the rail (Administrative, Development) key four bands and no more. Nothing enforces that, and if a
basis ever has both, the note is what gives way.

The rest it inherits from the two keys, because it is the same kind of object: it is **seeded into
the label layout**, measured rather than assumed, so no place name is left under it; it takes **no
pointer events**, refused on the rail as a whole so the empty ground between the boxes cannot catch a
drag either; it **does not answer to compare**; and it is **not drawn at 390px**. That last one is a
real loss rather than a repetition, and it is the one place this box differs from the keys: their rows
are carried in full by the legend under the frame, and this prose is on no other surface, so a phone
is short of it until the summary has a home in the column below the map.

**It is the one box on the paper that is not `aria-hidden`**, for the same reason: the keys repeat
rows a screen reader already has from the legend and from `lib/regions.ts`, and this is prose that
appears nowhere else on the page.

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
