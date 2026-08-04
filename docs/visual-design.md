# Visual direction — the detail

Root `CLAUDE.md` carries the direction in a paragraph and the rules that follow from it.
This file carries the ones that needed more than a line: the boundary hierarchy, the palette
gates, the two sequential ramps, and the phone bar. How the map, card, selectors, labels and tooltip
*behave* is `src/CLAUDE.md`'s.

## Editorial atlas, light

Warm off-white canvas, muted desaturated categorical fills, hairline strokes, serif headings,
one accent reserved for unit outlines.

**The one bold line is the current provincial boundary**, and it is bold in the map's own
neutral grey (`--rule-boundary`) rather than in the interface's warm hairline: every unit outline
in stratum 3 is drawn *inside* it, and on an unchanged province the two are the same geometry
drawn twice, so a reader who cannot tell them apart is reading one map where there are two. The
proposal is the thinner line and the different colour — the accent, which means *a proposed
province* and nothing else. Weight says *this is the standing boundary*; hue says *and it is not
part of the proposal drawn over it*. The ceasefire line is kept a step above the boundary
whatever the boundary weighs, since a caveat set fainter than the thing it qualifies is a caveat
nobody reads.

No dark mode in v1 — categorical palettes are harder to keep distinguishable on dark, and
the editorial register signals *reference* rather than *toy* on a politically live subject.

## The palette gate

Palette validated via the `dataviz` skill for colourblind safety — and the validation lives in
the suite (`src/lib/colour-vision.ts` + `palette.test.ts`), re-derived from the hexes on every
run, because a palette checked once at authoring time and never again is a palette nobody can
change safely. **Fifteen categories is past what any categorical palette separates pairwise**,
so the gate is held on the pairs that actually share a border on the map — geography, not a
scatter plot, decides which two fills a reader ever sees touching — and the pairs that fail
when any two swatches sit side by side are named in `palette.ts` rather than left to be found.

## The Development ramp

**The Development ramp was the first of the app's two sequential scales, and it is held to a
sequential scale's criteria** (#31). Lightness falls and chroma rises monotonically from the lowest band to the
highest along a green-to-blue path — the order *is* the encoding, and a reader reads it against
the legend in order rather than by recalling an absolute hue. It has about **0.14 of OKLab
lightness to spend**, bounded below by the rule that a fill must clear 3:1 against the unit accent
and above by the rule that it must not be mistakable for an unshaded district, and four steps
inside that window are 0.042 apart. So **no two adjacent bands reach the ΔE the categorical
palette is held to**, which is stated in `palette.ts` and asserted in the suite rather than
smoothed over: the weakest step is named, the ends of the ramp clear every gate including for
dichromats, and the relief is that every band is labelled with its own numbers in the legend and
the tooltip prints the district's composite *and* its three components. It is also why there are
four bands and not five.

## The population ramp, and why it is not the Development ramp reused

The Administrative basis shades districts by their **2023 census population**, banded — an ordered
quantity, so an ordered scale, so a **second** sequential ramp. The line that used to stand here
said there was exactly one, and it was doing real work: a second ramp is a second thing a reader
has to learn, so the first question asked was whether the Development ramp's four hexes could
simply be reused under a different heading.

**They cannot, and the reason is the legend rather than the map.** One basis is drawn at a time
(D9), so a development band and a population band are never on one map — but they are on one
*page*, a click apart, with the key redrawing beneath them. A reader who learns *blue means well
served* under one basis and meets that same blue meaning *thirteen million people* under the next
has been taught a colour that means two things, and the PNG export would key both with the same
swatches under different headings. So the population ramp is **its own path on the wheel** —
violet → pink → rose → coral, hue 320° through 35°, where Development runs 165° to 255° — and the
suite holds **every band of one past the ΔE 15 categorical floor from every band of the other**,
which is a stronger separation than either ramp achieves internally. That is the right way round:
the two scales are further from each other than their own steps are, because confusing two *scales*
is the worse error.

**Both ends of it sit at their gate rather than inside it**, and that is the finding rather than a
compromise. This path runs through the warm half of the wheel, which is where the paper is: `LAND`
is a warm off-white, and the search returns *nothing* paler than the first band that still steps
cleanly to the second — so the lightest band sits **ΔE 10.0 from the land tone, which is the floor
itself**, and the darkest clears the unit accent by **3.04:1** against a floor of 3. There is no
slack left in the window, which is the same arithmetic that gives the other ramp four bands and not
five, arriving from the other side.

Adjacent steps run ΔE 6.0–6.9 for unimpaired vision and so do not clear the categorical bar, exactly
as the Development ramp's do not; the weakest step is named in `palette.ts` and asserted. The relief
is the same too, and here it costs nothing: every band is labelled with its own figures in the
legend, and **the tooltip already printed the district's population** — this is the one basis whose
shading needed no new tooltip line to be checkable, because the figure was on it before the basis
could be drawn.

## The phone is not the degraded case

**Responsive** (#33). Hard bar: **map legible and variant switching functional at 390px.**
Pakistan's internet is overwhelmingly mobile-first, so this is where most of the audience meets
the app. Panel becomes a bottom sheet; hover becomes tap; `Space` becomes a button. **Sixteen of
the seventeen variants now meet it outright**, A1 to A3 among them — the rule-drawn partitions
that were the standing example of the bar going unmet — and so does H2, whose *Gilgit Agency and
Baltistan* is the longest unit name in the app. It was twenty-one names across nine variants
before #51 and seven across four after it. What is left is **D1 and only D1**, whose thirty-five
units include eleven of a single district: six names go unset at this size, listed one by one in
the suite with what a reader gets instead — see the labelling section of `src/CLAUDE.md`.

The breakpoint is stated **once, in the stylesheet** (`--sheet`) and read from there by
`sheet.ts`, the same arrangement `--switch` already has and for the same reason: a JS copy of
`560px` eventually disagrees with the CSS one, and a sheet whose script thinks it is a sheet
while its CSS thinks it is a column sets a height on a box that is not positioned to have one.
