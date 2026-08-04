# Politically sensitive rendering — the reasoning

The **rules** live in root `CLAUDE.md` and are loaded whatever is being edited, deliberately.
This file is the reasoning behind them: why each was decided that way, and — where it applies —
what was got wrong first. Read it before changing any of those rules. Changing one of them
without reading the paragraph that argued it is the failure mode this file exists to prevent.

---

## AJK and Gilgit-Baltistan — territories, not provinces

Constitutionally they are not provinces. The distinction is carried by **texture, not by
weight**: a hatched ground at a pitch counter-scaled against the zoom, and the *same* rule at
the *same* weight as a province. A fainter or thinner outline is legible and says the wrong
thing — provisional, or not quite ours — about ground Pakistan administers. **Not fully
interactive:** PBS's 2023 results cover 136 districts — the four provinces and ICT only — so
no AJK or GB district has a mother tongue, literacy, water or sanitation figure — and so none has
a development composite either (#31), since a mean of three absent rates is not a low score but no
score. They cannot be shaded under any basis, and carry no hover statistics beyond a name.
Hovering names them and says *the census does not cover them*, so the absence reads as coverage
and not as a zero or a failed load. AJK population exists only relayed via AJK BoS, never direct
from PBS.

## The Line of Control's name, and what it may be set over

The name is set along whichever part of the line is on screen, on the side with no drawn land,
and it **yields to** the tier names rather than displacing them — the territories are drawn
*and named*. Yielding is absolute and ordered, and the order now concedes **length and nothing
else**: the full name on clear paper, then **`LoC`** on clear paper, then no name at all.
Over-land placement used to be the second and fourth steps, on the reasoning that a name over land
still reads. It does read; what it reads as is the problem — set across Gilgit-Baltistan's hatch,
the name of a *line* becomes the name of the *ground*, on the one stretch of this map where what a
name is attached to is the whole question, and it crossed the boundary rule and Gilgit's own name
besides. The cost is that at some zooms the line goes unnamed, and that is affordable only because
the dash is keyed in the legend under **every** basis — an unexplained dash would not be an
acceptable trade and this change would not have been available.

**"Clear paper" means paper, and had to be taught the difference once #8 landed**: until the
neighbour silhouettes were drawn, the far side of the line was blank, so *outside Pakistan* and
*on nothing* were the same question and asking only about the provinces answered it. India is
drawn there now, and the top-ranked placement would have been the one over a silhouette while the
code still scored it as empty. Both sides are asked, so the order means what it says.

## The Durand Line — a normal boundary with a footnote

Nothing in the renderer knows the Pakistan–Afghanistan stretch from any other part of the
outline: same solid rule, same province weight, no dash. That is the decision and not an
omission. **The dash means *ceasefire line*** and there is exactly one of those on this map;
spending it a second time on a disputed *international* boundary would tell a reader the two
are the same kind of line, and cost the dash the meaning D12 exists to give it. So the dispute
is carried in words — the 1893 agreement, the Loya Jirga of 1949 declaring it void, and that no
Afghan administration since has accepted it as an international border. The note ships **with
Afghanistan's silhouette**, exactly as the ceasefire line's note ships with its geometry, so it
cannot be lost while the line is still on screen. Pakistan administers up to it and it bounds
every figure in this app; what is disputed is its standing, not where it runs.

## Neighbour silhouettes — fill and nothing else

No stroke of any kind: each silhouette ends where the country begins, so a rule around India would
double a line already drawn and spill half its width outside as a halo, and it would compete at
province weight for something this map is not about. They are held subordinate **structurally**
and not only by styling — a separate bundle sharing no arc with the country's, drawn beneath the
land, and never asked a question, since hover is put to the district polygons in lon/lat
(`hit-test.ts`) rather than to the DOM. Consequences accepted out loud: the four are told apart
only in the artifact and the colophon, which is what *unlabelled* costs; and only the four
Pakistan borders are drawn, so the far corner of a very wide frame shows paper where Tajikistan,
Turkmenistan, Uzbekistan and Oman are — the silhouettes exist for the boundary, not for the
corner of the frame.

## The PNG export band

A 2× raster of the current view with a footer band under it, produced **entirely on the
machine** — the SVG is serialised into a `data:` URL, decoded by an `<img>` and read back off a
canvas, so no server ever sees a reader's composition of a politically live picture (D19).

Five things the band settles that a source list would not. **The standing line is not
conditional prose**: every band carries one, and it says which of the two maps this is — a
proposal says *Proposed — not official*, and the baseline says it is the official geography,
because an export of the real provinces stamped "not official" would be this app disclaiming the
government's own map. It is set in the accent **only when something is proposed**, since the
accent means exactly that everywhere else. **An inherited vintage says whose it is, and a basis
with no date to lend says that instead** — the Historical basis's declared vintage is not a date
but the rule for finding one ("stated per variant, not shared"), so H1, H3 and H4 print *the date
of this proposal's own source* and point at the Source line, where 1947, 1955 and 1970 actually
are; quoting the deferral after "Vintage:" would put a sentence on the image saying the date is
stated per variant, on a variant that states none. **The key is derived, never transcribed**,
from the same `unitLegend`, `motherTongueLegend`, `populationLegend` and — since #31 —
`developmentLegend` the on-screen legend is built from, less the six categories dominant in no
district, which on a band would push the nine that matter onto a line of their own. It still
**refuses by name** a basis it has no fill for: three of the four have one now and Historical does
not, and a band that answered every shadeable basis with the mother-tongue key would print the
wrong legend under the right badge. The two ramps are each four bands and one absence, in the order
the scale is read, and each must reach for **its own** legend — they are the same shape, so a band
that took the wrong one would look right and print the wrong figures under it. Neither lead sentence
is a key entry: whose figure it is, and that no published source states the composite, are the
badges' gloss and the band already prints that under Provenance. And **the badges are
glossed in the image**, because a PNG has no hover and a provenance word a reader cannot check is
a claim. And **the small print names no figure source the variant does not use** (#49): the licence
line credited every picture's figures to the 2023 census and stamped it *pinned to* that vintage,
H2's included — a provenance claim on the one variant whose whole argument is that 2023 numbers do
not describe 1947 boundaries, printed where nothing beside the image can correct it. It is not a
figure leaking, which is why #30's checks did not catch it. So the line has two forms and only one
half of it is conditional: **every** band credits the boundaries to OpenStreetMap under ODbL and
the **district set** to PBS's 2023 census — both true of every picture here, since the 156 drawn
districts *are* the census's set under ADR-0001, which is why even H4 dates itself by the district
set — and a variant that withholds says it carries no census figures instead of crediting figures
it does not print. Dropping the line was not an option: the boundaries come under a licence that
requires it. Which form a band takes is asked of **`figuresWithheld`** (#48), not of the field, so
the image, the card and the tooltip cannot answer the withholding question three ways.

**The band describes the picture, never the selection**, which is the one place this could have
gone badly wrong. While compare is held the map has been given the baseline whole (#22), so a band
built from the selection would caption the real provinces with a proposal's name, badge it and
stamp it *Proposed — not official* — the single most damaging image this app could emit, and
exactly the thing the ticket exists to prevent. So the export asks what the *map* is showing and
gets the baseline's own band while the comparison is held; `shadedBy` is the renderer's answer for
the same reason, since three of the four bases can be selected and shade nothing, and the band
**refuses by name** to key a basis it has no fill for rather than printing one basis's colours
under another's title.

Two things had to be got right about the picture rather than the words, and both are stated
because both were wrong first. The crop is the union of the drawn land **and every name and dot
over it**, clipped to the frame — the ceasefire line's name is deliberately placed on clear paper
beside the line, and a crop taken to the coastline slices it off the one copy that travels with
nothing to explain the dash. And the export **photographs a settled map, never a cross-fade**:
the strata fade in CSS and the outlines in the renderer, so both are stilled for the length of one
read — otherwise pressing Download within `--switch` of a variant change bakes one proposal half
dissolved into another, with nothing in the picture to say so. Stilling is `map.photograph`'s, a
callback rather than a getter, because stilling the map and reading it have to be one operation
and the knowledge of what animates belongs in the file that animates it. The band also defines its
**own** hatch and stipple: the map's are counter-scaled by 1/k so their texture survives a 24×
zoom, which is right inside the zoomed group and wrong in a legend, where it would collapse the
pitch to a fraction of a pixel and leave a swatch keying nothing.

The words and the arithmetic are decided in `src/lib/export-band.ts`, under test; the crop is
`map.image()`'s; `src/export-image.ts` rasterises and composes no sentence of its own, exactly as
`panel.ts` composes none of the card's.
