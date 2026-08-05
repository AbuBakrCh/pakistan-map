# The phone adaptation (#33)

The bottom sheet, the tap gesture and the docked tooltip. `src/CLAUDE.md` carries the rules;
this file carries the reasoning. The 390px bar itself is `docs/label-layout.md`'s.

---

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
page they navigated to.

**A proposal arrives at `peek`, and that is a change from the ticket.** It opened at `half`, and
40% of a viewport is 40% of the map: a reader following a link to a variant, or picking one on a
phone, met the proposal's outlines with the southern third of the country already behind the card,
and had to open the sheet and shut it again before they could see what had been drawn for them. The
first thing a proposal has to say is its own boundary, so the card arrives at the floor — present,
named on its grip, one tap or one drag from the whole of it — over a map with nothing on top of it.
Every detent above it is exactly where it was; what changed is which of them a reader is *given*.

`peek` is the **floor**: the card arrives and leaves with the outlines (#19),
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
comes down. Which is why the card no longer *arrives* there — a cost a reader chooses by dragging is
a different thing from one the page hands them before they have seen the map at all.

**The map's height is arithmetic, not a constant** (`src/phone-frame.ts`). On a wide screen the
frame is a flex item and the browser settles it; on a phone it is sized to its contents, because the
colophon and the audit panel are flex items of the same column and would otherwise squeeze the
country to a thumbnail. So the height had to be stated — and it was stated as `21rem`, which is a
number with no way of knowing whether the country it sized ended above the furniture fixed to the
bottom of the screen or behind it. On the shorter phones it ended behind it, and a reader met a map
with its south under three buttons.

It is now the room actually left: the distance from the top of the frame to the top of that
furniture, less the legend under the map. Every term is measured off the page — the sheet's peek,
the two chip rows, the gaps between them — so nothing here restates a figure the stylesheet already
owns, and the two chip heights are measured and given *back* to it as `--action-h` and `--toggle-h`,
which had been written as the 44px touch-target floor and are not what a chip comes to once its
label has wrapped. The sheet is counted at its peek height and never at `--sheet-h`, for the reason
directly above: a height tied to the live sheet would re-fit on every frame of a drag.

One floor is kept and it is the map's: below ~260px the 390px bar stops being met, so the page gives
up being unscrolled rather than the map — the frame runs past the bottom of the screen and the
reader scrolls a few dozen pixels, which they already do to reach the colophon.

**The strips say how many chips they hold, because scrolling them hides it.** The two radio groups
stop wrapping below the breakpoint and run along one line — wrapped, the bases and the variants cost
330px of an 844px screen at the touch-target height, which is the map's own height spent on a menu.
What that buys in room it takes back in information: a variant chip carries a name over a tagline
and comes to nearly the width of the screen, so what a reader meets is *one* proposal squared off
against the edge of the page, which reads as the end of the menu rather than as the start of it. The
alternatives **are** the product (#18); a reader who cannot see that there are alternatives has been
shown a different app.

Two things are said and they are deliberately different in kind. The **position** is a fact and is
printed beside the group's own name — `VARIANT 1/7` — because a fade can imply *more* and cannot say
*six more*. The **fade** is an affordance and appears only on a side there is actually something to
scroll towards. Neither is drawn above the breakpoint, where every chip is on the page at once and
both would be furniture.

The count is withheld in the two states where printing it would report something the app has not
got: a group of one option — Administrative, whose single variant a reader is already looking at
whole — and the baseline, which selects no variant at all and would otherwise be given a position of
zero. The fade is a **mask** and not an overlaid gradient: a mask applies to the element's own box
rather than to its scrolled contents, so it stays put while the chips travel under it, and it costs
no hit target — which matters, because it sits over the half of a chip a finger is most likely to
reach for. It answers to the scroll as well as to the resize, since a fade left standing at the end
of a strip is the page claiming chips it does not have, which is the one thing a cue like this must
never do.

**The three chips stack on one edge.** The division toggle sits above Compare and the export rather
than in the opposite corner: two rows anchored to opposite sides read as three buttons scattered
along the bottom of the map, and stacked they read as one column of furniture. The pairing #32
argues for is still said — by which of the two lines a chip is on, which is the distinction that
carries it.
