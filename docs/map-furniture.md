# Map furniture — the unit key, the division toggle, the page regions

The three things drawn around the map rather than on it. `src/CLAUDE.md` carries what each
one is and the rules it follows; this file carries why each was decided that way.

---

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
