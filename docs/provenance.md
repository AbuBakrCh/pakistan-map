# Badges and vintages

Every fill, number and boundary carries a **badge** saying what kind of claim it is and a
**vintage** saying which census it is read at. Root `CLAUDE.md` carries the rule; this file
carries why each part of it is shaped the way it is.

## The Development basis carries two badges for one fill

The Development basis is the only one carrying **two badges for one fill**, and the pair is the
point: the three rates are PBS's to the household, and the mean of them is **this project's own
figure, which nobody publishes**. `census` alone would pass our arithmetic off as the census's;
`synthesized` alone would disown figures PBS counted one household at a time. It is also the only
basis whose shading is not somebody else's number, which is why the composite states its formula on
the card, in the legend, in the colophon, on the export band and on every tooltip that prints it.

## A vintage is checked, not assumed

A basis carries a **vintage** as well as a badge and a source (#21), and the field is checked
rather than assumed: a badge says which *kind* of claim a shading is and the vintage says which
census, and either alone is half a provenance. Three of the four declare exactly the project's one
vintage (D24, ADR-0001) and a `census` badge at any other date fails the build naming the basis;
Historical is the exception the rule allows for, since its demarcations are dated one by one, so it
declares that and each variant carries its own document's date. A variant may carry a `vintage` of
its own for the same reason — H2 draws 1947 — and where it does not, it is read at its basis's and
the resolution says so, so that no surface prints the census's year against a boundary the census
had nothing to do with.

## Every Historical variant must date itself

**Every Historical variant must date itself, and the build now says so.** Its basis declares a rule
for finding a date rather than a date, so a Historical variant that states none resolves to a
sentence where a date should be — *"stated per variant, not shared"*, printed against a variant that
states nothing. H1 is dated **14 October 1955 to 30 June 1970**, the fifteen years One Unit was in
force, and H3 **1 July 1970**, the four provinces as restored when it was dissolved. H4 is dated
differently on purpose: it is the one Historical variant whose *boundary* is not historical, since
what is drawn is Bahawalpur Division as PBS publishes it **today** — so its vintage is the district
set's, and the 1947–1955 province is the claim's history rather than its geometry. Dating it 1947
would say the app had drawn the 1947 state, which it has not.

## The field has to survive the bake

The field also has to **survive the bake**, which it did not until #32 went looking for one. The
schema has carried an optional `vintage` since it was written and the validator has always checked
it, so the module was right and every content review passed; `build-scenarios.ts` simply never
emitted it, so every variant reached the runtime dated at its basis and nothing went red — because
until the PNG band, no surface printed a variant's date. It is written **only where the variant
states one**, since an absent field is the signal to read the basis's, and the suite compares the
two sides of the bake rather than asking the artifact whether it agrees with itself.
