<!-- Moved verbatim out of the root CLAUDE.md (see its pointer) so it loads only when
     working under this directory. Five blocks have since moved on into `docs/` — each is
     pointed at from the section that used to hold it, and the rules stayed here. -->

## Interaction

**Default:** current provinces and territories, named, with the seven first-level seats and the
ceasefire line. Nothing else.

### The furniture around the map

Reasoning in **`docs/map-furniture.md`**. The rules:

- **The map keys its own units, top left of the frame** — the unit **count**, then every unit
  named beside a swatch of the ground the map paints underneath it. It arrives and leaves with
  the outlines exactly as the card does (#19), so at the baseline the box is empty and `:empty`
  takes it off the paper.
- **A unit's swatch is not a unit colour, because there is no such thing** (D14). Each row carries
  the unit's **own districts in the fills the map actually paints them**, widest first, and **the
  proportion is of districts** — the atom every unit is composed of (D23) and the one quantity
  here needing no source. The two absences stay apart as everywhere else (#17): AJK and GB hatch,
  Chitral stipples. Identity is never colour alone; the legend under the frame names every fill.
- The unit **name** is set in its own outline colour, which is how the key says *whose boundary
  that is* where the legend says only what a stroke means. It names **the proposed units** — the
  ones a reader cannot name off the map they already know — and **counts what it names**, in the
  word *proposed*, so the figure is never taken for the partition's. The whole partition, with each
  unit's population, is the card's and the scorecard's.
- **Where a variant redraws inside the provinces that already exist, the rows are grouped under
  them** — A6's nineteen under five, D1's thirty-two under four. Asked of the **variant's district
  lists** and never of its basis, so a variant that crossed an edge would fail the check rather than
  inherit a heading; **all or nothing**, since grouping the obedient half of a partition reports a
  provincial structure the other half contradicts. Four variants answer no — **L3**, L7, H1, H2 —
  and their keys are flat. The province is named **as the census names it** (`Islamabad Capital
  Territory`, and the word *province* nowhere in the heading), and a unit reaching ground the census
  publishes no province for takes the whole key flat with it rather than being given a guessed one.
- **Nothing is below a fold.** The key does **not scroll**: the rows run into a second column
  (`unitRoster.columns`, eighteen rows to a column and two columns at most — **down before
  across**, since the corner it stands in is a deep, narrow strip of sea and of the ground west of
  Balochistan), because a key a reader has to discover the rest of is one they take for the whole
  proposal until they do. **A province heading is a line of the column as a unit is** — D1 is
  thirty-six lines, exactly what two columns hold — and where the two collide the **grouping** gives
  way, never the fold.
- Three things it does not do: **no populations and no printed district counts** (the scorecard's,
  #20), **it does not answer to compare**, and it takes **no pointer events at all** — there is
  nothing to click, drag or scroll, so the map pans and zooms straight through that corner.
- **The order is the card's** — one `unitsProposedFirst`, not two orders that agree today. The
  grouping is the one departure and is the least one: the card's order inside each province, and the
  provinces in the order their first unit comes in.
- **It takes part in the label layout**, seeded into the same `occupied` set as the docked
  tooltip. **It is not drawn at 390px**, a decision rather than a fallback. **And it is
  `aria-hidden`**, because `lib/regions.ts` already names every region in words (#35).
- **The map keys its own colours too, top right, under the division toggle** — stratum 1's key, on
  the paper: every fill the map has actually painted beside the answer it stands for, and both
  absences with it (#17). The rows are `motherTongueLegend`'s, `populationLegend`'s and
  `developmentLegend`'s, the same three
  the legend under the frame and the export band are built from, so no fill is keyed two ways; the
  heading is the basis's own name. It keys **only the ground the map painted** — the six categories
  dominant in no district stay below the frame — and is emptied, and taken off the paper by `:empty`,
  under a basis that shades nothing and at the baseline. Everything else is the unit key's: it does
  not answer to compare, it takes the wheel, it is seeded into the same `occupied` set, it is
  `aria-hidden`, and it is not drawn at 390px.
- **The map says how it was built, in prose, under the unit key** (#52) — a few sentences naming the rule
  the boundary on screen came from, which the card, the legend and the scorecard all leave unsaid.
  **Basis-first, variant-second:** the shared paragraphs are the basis's and a variant may add **one**
  of its own, which **adds and never replaces** — a variant free to overwrite the rule is free to
  describe a method its own map was not drawn by. Words in `src/lib/method.ts`, under test; `main.ts`
  sets them with `textContent` and composes nothing, and every basis and variant key is held against
  the committed bundle, **retired ids refused by name**.
- **Three of the four bases have one and Historical does not** — the same basis still short of a
  fill. A basis with nothing written draws **no box**, on the keys' own `:empty` rule, because an
  invented summary would be this app's editorial voice on a sourced surface; the absence is asserted
  rather than left to be noticed.
- **Its position is measured, not predicted.** The left rail (`.map-left-rail`) holds the unit key and
  the note in one column, so the note sits under the key at whatever height the key came to. The key
  does not scroll, so a rule-drawn variant fills that edge — `placeMethodNote` measures the rail
  against the frame and moves the box to the **bottom right** only where it will not fit, and re-asks
  on `resize`. That corner is the fill key's edge, and the collision is bounded by which bases have
  long keys rather than by a rule.
- **Everything else is the two keys': measured into the same `occupied` set, no pointer events, no
  answer to compare, not drawn at 390px.** The last is a **loss** here and not a repetition — the
  keys' rows are repeated by the legend under the frame and this prose is on no other surface. It is
  also the one box on the paper that is **not `aria-hidden`**, for that same reason.
- **The division tier is offered, not assumed** — one toggle, top right. It goes **whole or not at
  all**, the **legend follows it**, and it is **not in the URL and not in history** (as the
  sheet's detent is not). It rescues **not one** of the unit names this build cannot set at
  390px: `UNIT_FLOOR` outranks every division outright. A pressed-state `<button>`, not a
  checkbox, since that is what `holdsCompare` relies on (#22); bottom left on a phone.
- **Two regions on a wide screen, and a block underneath.** Above 1000px: controls left, map takes
  everything else, the card's three blocks under it — argument at a prose measure, units and
  scorecard beside it, footnotes and sources right. Below 1000px one column; below `--sheet` the
  bottom sheet. The rail beside the map is gone; the frame takes its column. It is **placement and
  nothing else** — `panel.ts` renders one card into one mount and the stylesheet moves the pieces
  with `display: contents`, so the sheet still holds the card **whole**.

### Selectors, switching, deep links

**Selecting a basis:** current boundaries fade back, districts shade by that basis's data,
the active variant's unit outlines draw prominently on top.

**The selectors (#18).** Two radio groups, never dropdowns: a basis and a variant are each
one-of-N and the alternatives *are* the product. The baseline sits first among the bases, because
returning to the real map is the same kind of act as choosing one. **A basis is never active on
its own** — selecting one selects its first variant (D13), so there is no state that means
"shaded, with nothing proposed over it". **Three bases are offered and all three are live** —
Language, Development (#31) and Administrative — so the basis strip currently carries no dimmed
chip at all.

**Historical is withheld, and withholding is not the same act as refusing.** A basis short of its
variants or its shading is still offered and **refused out loud**: the control says whether the
variants are missing, the shading is missing, or both, said on being pressed and not only on hover,
since `disabled` takes no tap and the hard bar is a 390px phone. That machinery stays and is still
held over a stub, because it is what a basis arriving half-built gets. Historical instead comes off
the strip entirely — `HIDDEN_BASES` in `lib/selection.ts`, one named set — so it takes no chip, no
tab stop, no arrow key and **no refusal line**, a line whose whole job is explaining a chip a reader
can see. What is withheld is the *menu entry* and nothing else: H1 to H4 stay in the bundle and
under their basis in `basisChoices`, the suite still holds them, `about.ts` still sources the basis
on the audit panel, and the id stays a basis this app has heard of — which is what keeps
`#/historical/l1` a link that corrects itself to L1 rather than a malformed one. A hidden basis is
**unavailable**, so a control or a URL that still asks for it is refused **by name** exactly as an
unshaded one is, never answered with a silent baseline. Which bases can be shaded is a property of
the renderer, not of the bundle, and is stated once in `main.ts` so the menu and the map cannot
disagree.

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
never heard of — or a basis it cannot put on screen, which is Historical, withheld — resolves to the
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

### The strata

**Three visual strata** — over a ground of context that is not one of them. The neighbour
silhouettes and the city dots (#8) are furniture: they never change with a basis or a variant,
they carry no data, and they sit outside the numbering because a stratum is something a selection
switches. The silhouettes go beneath the land; the dots and their names go above everything, in
screen space, because a circle has no `vector-effect` for its radius and a dot inside the zoomed
group becomes a blot at 24×.

1. **Fill = data** (dominant mother tongue, development band…) — *never* unit membership
2. **Current boundaries** — the **bold** line, and held near full strength under a variant rather
   than faded back to half. It is the heaviest rule on the map and drawn in a neutral cool grey
   (`--rule-boundary`), which is the only unsaturated tone in a warm palette and is not the
   interface's own hairline: every unit outline in stratum 3 sits *inside* it, and on an unchanged
   province the two are the same geometry drawn twice
3. **Unit outlines** — **thin**, labelled, on top, and in a different colour from the boundary
   beneath them: the accent where a unit is proposed, the map's ink where it is carried through.
   Weight says which map a line belongs to and hue says which claim. **Drawn by arc, never by
   shape**: Azad Jammu & Kashmir is a unit in every variant and the Line of Control is part of its
   outline, so a solid stroke over the dash would fill its gaps in and leave a border (D12). The
   ceasefire line's arcs are held out of every unit, exactly as the province stratum already holds
   them out. Each outline is **cased** in the paper's own colour so it survives a busy fill beneath
   it — and the casing is now **narrower than the boundary underneath**, which is load-bearing
   rather than cosmetic: at 4.4px it laid enough paper along a shared border to paint the province
   out and leave the two maps looking like one line. A unit's name is set at the province size and
   coloured to match its own outline — the accent belongs to `proposed` units and to nothing else,
   and a unit is **never filled**, because fill is data

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
the bases cannot draw the same absence two ways.

**Under the Administrative basis it carries the same two, over the plainest figure of the three.** A
district falls in one of four **fixed bands of its 2023 census population** — under 500,000;
500,000–1,500,000; 1,500,000–3,000,000; 3,000,000 and above — or it is left at the unshaded
baseline, the same twenty. Four things about it, each argued in `lib/administrative.ts`:

- **Population and not density**, because population is what the basis is argued from: A6's ceiling
  is stated in exactly this figure, so that boundary is drawn over one of the two quantities it was
  cut at — the other being a distance, which a choropleth cannot show. Density would be the tidier choropleth and the evidence for nothing on top of it. The cost —
  a count on a choropleth over-reads big empty districts — is answered by the legend's figures and
  by the tooltip, not hidden.
- **Fixed cuts, never quantiles**, on the composite's reasoning: a quantile band makes a district's
  colour a function of every *other* district's population, so a district could change colour at the
  next census without one person moving into it.
- **Banded at runtime rather than baked**, which is where it differs from the composite. The figure
  is PBS's own and already in `statistics.json`; only the banding is this module's, and **no boundary
  anywhere in the app is drawn from these four cuts** — the two reasons #31 bakes its own.
- **The lowest band is not where an absence goes.** The lowest band is *under 500,000*, and twenty
  districts with no census row painted into it would read as the emptiest ground in Pakistan on the
  strength of a question PBS never asked there (D25).

It is also the one shaded basis needing **no `DistrictShading` of its own**: that machinery exists
because the development composite is a figure nobody published and a colour is the only thing
explaining it, and here the population was already on the tooltip with its source.

**Stratum 3's line work is thinned at the bar**, and only its absolute weights are. The strokes are
`non-scaling-stroke`, so they are the same screen px on a 369px-wide country as on a 1200px one —
three times heavier relative to the ground they describe. The *ratios* are kept, casing to line and
proposed to unchanged, because those are what say which line is a proposal and which is the country.

### Hover and the tooltip

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

**A box too tall for the frame scrolls; it is never truncated and never abbreviated.** Capped to
the well less `placeTooltip`'s own two margins on a desktop and to **half** the frame on a phone,
where it is a docked bar growing down over the country the figures are about. Nothing is dropped
to make it fit, for the reason the phone bar already gives — a tooltip that shed its sources would
shed them for most of this app's readers — and the part below the fold is the composite's three
components, which are exactly what a reader checks the shading against.

Three consequences, and each is a cost paid on purpose. **The scrollbar stands rather than fading
in**, in the two keys' own idiom and for their reason: an overlay bar asks a reader to discover by
accident that the figures continue. **A scrolling box takes the pointer** — the one exception to
*never a hit target* — so over that rectangle the map cannot be hovered, panned or zoomed, and on a
phone a tap there no longer reaches the district beneath; it is given only while there is something
below the fold, so a box that fits is the box it has always been. And **a scrolling box stops
following the pointer**, put down once beside its district: a box the height of the frame is placed
14px from the cursor and slides with it, so a scrollbar that followed could never be caught. The
SVG and the box agree about the boundary between them (`movedInto`), so reaching into the tooltip
is not read as leaving the map.

### Labels

The whole doctrine — how a unit's name is fitted to its ground, what it concedes and in what
order, when it goes out on a leader and how that leader is routed and ranked, which tiers yield
to which, and the per-variant record of what is nameable at 390px — is in
**`docs/label-layout.md`**. Read it before touching `lib/labels.ts`. The properties it protects:

- **A unit's name is inside its own ground, or on paper attached to that ground by a line, or
  absent.** There is no fourth case, and in particular **no name sits inside a unit it does not
  name** — which is a claim nobody wrote and the one claim a footnote cannot take back.
- **Nothing is ever invented.** An attested abbreviation is conceded last of the in-ground steps;
  a coinage is refused, and a name with nowhere to go is dropped rather than shortened by us.
- **Unit names replace province names rather than joining them**, and a division named after its
  own seat is **qualified, not surrendered** (*Lahore Division* beside *Lahore*) — the unit's own
  official style, applied only to the six that actually collide.
- **A territory ranks first inside the unit tier** (#28), keyed on the kind the bundle records and
  **never on the name**, since H3 and H2 both rename Gilgit-Baltistan. **`mustName` goes further:
  there is no size or selection at which a territory is drawn anonymous**, asserted as an
  emptiness rather than as a shrinking list.
- **District names are the one tier with a zoom threshold** — not laid out at all below **6×**
  (#34); a reader gets a district by tapping it.
- **The 390px bar** is met by eleven of the thirteen variants. **D1 and A6** fall short — six of
  D1's thirty-five unit names go unset and one of A6's (*Islamabad*, a unit of a single district),
  each listed by name in the suite and each shown to return at desktop size.

### Compare and export

**Download PNG (#32)** — the export button, beside Compare. Present at the baseline as well as
under a proposal, unlike Compare: the current map is exactly as likely to be screenshotted as a
proposed one, and the sanctioned copy is the one carrying its own sources. One format and one
resolution, no menu — the whole argument for the feature is that it must be less effort than the
screenshot key. Disabled for the duration of the encode rather than debounced, since on a phone a
second press lands before the first PNG is done and two files is a confusing answer to one press;
a failure is spoken rather than swallowed, because a button that silently does nothing reads as a
broken page. What the band says is the root spec's, and `docs/political-rendering.md`'s.

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

### On a phone (#33)

Reasoning in **`docs/phone-and-touch.md`**. The rules:

- The card is a **bottom sheet**, hover is a **tap**, and Compare moves to the corner a thumb
  reaches, as one row with the PNG export. **None of the three is a second version of the app**:
  the sheet holds the same card **whole**, because a card that hid its opposition line on a phone
  would read as an endorsement on a phone.
- The sheet **takes up no room at all when there is no card**, and rests at **three detents** —
  `peek`, `half`, `full`, the last stopping short of the top so a strip of map stays visible.
  **`peek` is the floor**: the card arrives and leaves with the outlines (#19), so there is no
  state in which a proposal is drawn and nothing says whose boundaries those are.
- Where a drag settles is `lib/sheet.ts`'s, under test: **velocity is asked before distance**, and
  **one detent per drag, never two**. The grip is a **`<button>`** as well as a drag target, so
  the map has no state only a touchscreen can enter.
- **A tap on the district already showing puts the tooltip away**, and so does a tap on the sea; a
  tap on a *different* district moves it in one press. Only a **still, brief, single** finger is a
  tap, and **moves are not answered at all on touch**.
- **The tooltip docks rather than follows** — a finger stands on the ground the box explains, and
  the sheet overlays the map. **Nothing is dropped and nothing is abbreviated to make it fit.**
- **The docked box takes part in the label layout**, seeded into the same `taken` set and put to
  the ceasefire line's name as well as to the tier names, ending in **no name at all** rather than
  a name behind a box (D12).
- **The sheet overlays the map; it never resizes it.** The room the page keeps is the room it
  takes when *down* (`--sheet-peek`), never its current height — a live height would re-project
  the country on every frame of the drag, and the country does not move under a gesture.

### Without a mouse (#35)

Reasoning in **`docs/accessibility.md`**. The rules:

- Each radio group is **one stop on the tab ring**, on whatever is checked; **arrows move within
  it and select as they go** (focus and selection travel together — D13), they **wrap**, and they
  **step over the bases that cannot be selected**. Where a key lands is `lib/radio-group.ts`'s,
  under test.
- Only the keys the group claims have their default suppressed. **`Space` is never touched** — it
  is the compare gesture (#22).
- **Focus is visible on every control**, at two pixels of the map's own ink, stated once. **Not
  the accent**, which means *a proposed province* and nothing else (D14). `:focus-visible`.
- **The map's regions are named in words** beside it (`lib/regions.ts`), never painted — units
  replacing provinces exactly as on the map. The **standing words are the tooltip's own exports**,
  never a copy, and the test compares against those exports rather than against a literal. Not a
  live region.
- **The map is walkable with the keyboard**: arrows walk the districts, `Home`/`End` reach the
  ends, `Escape` puts the readout away, and each stop goes through the same `showDistrict` the
  pointer uses. **The walk is a reading order, not a compass** — province, then division, then
  district — because a spatial walk has no honest answer at a coastline.
- **An arrow key inside a group replaces its history entry rather than pushing one** (#23).

### The card, the scorecard and the About panel

Full text in **`docs/panel-surfaces.md`**. The rules:

- **Variant card (#19)** — name and tagline, the **basis** badge beside the **provenance** badges,
  unit count, rationale, real-world status, boundary provenance, **Advocated by** *and* **Opposed
  by**, the units, the footnotes and the sources. It arrives and leaves with the outlines.
- Four things it refuses to do quietly: **a missing opposition line prints as missing data**, an
  **unadvocated** variant says so in the advocacy's own words, a **badge outside the closed
  vocabulary throws**, and **both district counts are printed wherever a claim and the map
  disagree**. Every badge is glossed *on the card*, never in a `title`, because the bar is a
  390px phone.
- Units listed **proposed first**; alternative names beside the advocates' own name and never
  instead of it; a variant whose provenance disagrees with its basis's says why. **Nothing calls
  Islamabad a province.**
- **Not animated** — prose faded in is prose the reader waits for. Words in `src/lib/card.ts`,
  under test; `src/panel.ts` composes no sentence of its own.
- **The scorecard (#20)** sits between the units and the footnotes, set as a table of figures in a
  fixed order across variants. **Not one of its figures is computed on the page.** Populations
  printed **in full and grouped** — 87,311,346, never "87.3 m". Where population is withheld the
  sentence sits **above** and the lines are gone rather than blank. **Never a zero, never a dash,
  never nothing.** Contiguity is **flagged, never blocked** (D7, #16).
- **About the data (#21)** — the audit surface, a `<details>` closed by default. **Vintages are
  per source, never one string repeated**; **the discrepancies get a section above the small
  print, not a footnote**; and **what it leaves off is on it**. The development composite has a
  row of its own and appears a second time among the discrepancies (#31). Nothing on it answers to
  the selection, so it is rendered once, at load; words in `src/lib/about.ts`, under test.

---

## Where the detail went

| File | Carries |
|---|---|
| `docs/label-layout.md` | The whole labelling doctrine and the per-variant 390px record |
| `docs/map-furniture.md` | Unit key, fill key, method note, division toggle, the page's regions |
| `docs/phone-and-touch.md` | Sheet detents, the tap gesture, the docked tooltip |
| `docs/accessibility.md` | Keyboard, focus, the regions list, the district walk |
| `docs/panel-surfaces.md` | Card, scorecard, About panel — in full |
| `docs/political-rendering.md` | The PNG band's words, and every politically sensitive rule |
| `docs/visual-design.md` | Boundary hierarchy, palette gates, the Development ramp |
