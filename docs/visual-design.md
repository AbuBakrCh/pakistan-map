# Visual direction — the detail

Root `CLAUDE.md` carries the direction in a paragraph and the rules that follow from it.
This file carries the three that needed more than a line: the boundary hierarchy, the palette
gates, the Development ramp, and the phone bar. How the map, card, selectors, labels and tooltip
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

**The Development ramp is the one sequential scale, and it is held to a sequential scale's
criteria** (#31). Lightness falls and chroma rises monotonically from the lowest band to the
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
