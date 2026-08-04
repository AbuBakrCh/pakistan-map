/**
 * The categorical palette — stratum 1's only colours, and nothing else's.
 *
 * ## Where these hexes came from
 *
 * Not picked. Searched, against the `dataviz` skill's own gates and its own colour-difference
 * method (Machado–Oliveira–Fernandes 2009 at severity 1.0, ΔE as Euclidean distance in OKLab
 * ×100), over an OKLCH grid held inside this project's visual direction. Every claim below is
 * re-derived from these hexes on every test run by `palette.test.ts` — none of it is a note
 * about how the palette was authored, it is a property the suite enforces.
 *
 * ## Fifteen categories cannot all be told apart, and this palette does not pretend otherwise
 *
 * The `dataviz` skill's own reference palette caps a choropleth at **three** slots under its
 * all-pairs rule; PBS names fifteen mother tongues. There is no ordering, no re-stepping and no
 * amount of care that makes fifteen fills pairwise-distinguishable. `UNSEPARATED_PAIRS` below
 * lists, by name, every pair that falls short of the gates — 62 of the 105 — and the test asserts
 * that list is exactly right, so it cannot rot into a comforting fiction.
 *
 * What makes the palette usable anyway is that a **map is not a scatter plot**. Two fills are
 * only ever seen touching if the districts wearing them share a border, and Pakistan's language
 * geography fixes which pairs those are: Balochi meets Brahvi everywhere, Punjabi never meets
 * Sindhi. So the gates are held on the 17 category pairs that actually share a border on the
 * committed bundle — and every one of them clears the skill's target for protanopia and
 * deuteranopia, its floor for tritanopia, and its hard normal-vision floor. Not one pair in
 * `UNSEPARATED_PAIRS` shares a border; the test asserts that too, and it is the assertion that
 * would fail first if the census or the boundaries moved under us.
 *
 * The remaining relief is the one the skill asks for: identity is never colour alone. Every
 * category is named in the legend beside its swatch, and the six that are dominant nowhere are
 * grouped there so the nine a reader has to match are nine, not fifteen.
 *
 * ## The weakest pair, stated rather than hidden
 *
 * **Punjabi and Balochi are the two largest fills on the map and both are blue** — normal-vision
 * ΔE 7.9, half the floor. They do not share a border anywhere (Saraiki and the Sulaiman range
 * are between them), so no reader ever has to resolve a boundary between them, but they are the
 * pair most likely to be mistaken for each other at a glance and in the legend.
 *
 * It is not an oversight, and re-picking either does not fix it. Balochi has to separate from
 * five bordering categories at once — Brahvi, Pushto, Saraiki, Sindhi and Urdu — and of the
 * whole searched space of muted fills, only four colours clear all five gates; every one of them
 * is a blue within ΔE 9 of Punjabi. Four of the nine dominant categories are warm, which leaves
 * five sharing the cool half of the wheel, and at fifteen categories there is no more room in it.
 *
 * ## Why the fills sit outside the skill's lightness band and chroma floor
 *
 * Both of those checks are calibrated for thin marks on a white chart surface, where a pale,
 * low-chroma stroke vanishes. These are large area fills on warm paper with a heavy accent
 * outline drawn over the top of them, and CLAUDE.md's visual direction is binding: muted,
 * desaturated, one accent held in reserve for stratum 3. So chroma is **capped** at 0.115 rather
 * than floored at 0.10, and lightness runs high — every fill clears 3:1 against the unit accent
 * `#9c3b2b`, which is what lets a unit outline read as an outline rather than as more shading.
 * Each is also held away from the unshaded land tone, so a shaded district never reads as one
 * the basis did not reach.
 */

/** PBS Census-2023 Table 11's own categories, in its own order and its own spelling. */
export const MOTHER_TONGUE_CATEGORIES = [
  'Urdu',
  'Punjabi',
  'Sindhi',
  'Pushto',
  'Balochi',
  'Kashmiri',
  'Saraiki',
  'Hindko',
  'Brahvi',
  'Shina',
  'Balti',
  'Mewati',
  'Kalasha',
  'Kohiostani',
  'Others',
] as const;

export type MotherTongue = (typeof MOTHER_TONGUE_CATEGORIES)[number];

/**
 * The tone a district keeps when the basis does not reach it. Mirrors `--land` in `styles.css`;
 * named here so the palette test can prove no fill is mistakable for an unshaded district.
 */
export const LAND = '#ece4d5';

/**
 * Reserved for unit outlines (stratum 3) and spent on nothing else. Mirrors `--accent`. Named
 * here so the palette test can prove no fill comes near it.
 */
export const ACCENT = '#9c3b2b';

/**
 * Colour follows the category, never its rank or its size. Pushto covers 39 districts and Balti
 * none; both keep their hex whatever the map shows, so a reader who learns a colour once keeps it.
 *
 * The nine that are dominant in at least one district were searched first and together, against
 * the 17 pairs that share a border. The six that are dominant nowhere were placed afterwards
 * into what separation was left — they still have to sit beside the others in the legend, but
 * they never have to be matched against a shape on the map.
 */
export const motherTongueFill: Readonly<Record<MotherTongue, string>> = {
  Urdu: '#9ce5f7', // pale cyan
  Punjabi: '#98c9fc', // sky
  Sindhi: '#dac280', // sand
  Pushto: '#afb156', // olive
  Balochi: '#9cabfa', // periwinkle
  Kashmiri: '#c0e699', // pale green
  Saraiki: '#ed91ae', // rose
  Hindko: '#f8b9ad', // apricot
  Brahvi: '#51d5ce', // teal
  Shina: '#e4bcdf', // mauve
  Balti: '#e7a77c', // terracotta
  Mewati: '#81efd3', // pale jade
  Kalasha: '#d7a0e3', // orchid
  Kohiostani: '#74b5cf', // steel blue
  // The residual, and greyed because of it: `Others` is not a language, and the pipeline excludes
  // it from dominance, so it can never fill a district. It has a colour so that all fifteen
  // categories are covered and a breakdown can draw it — not so that the map can.
  Others: '#bdb3a4',
};

/**
 * The Development basis's ramp (#31) — the first of the app's two **sequential** scales, and a
 * different kind of palette from everything above. The second is `POPULATION_BAND_FILL` below,
 * which is a separate path on the wheel and argues there for why it is not these four hexes reused.
 *
 * The composite it keys is ordered, so the encoding is the order: lightness falls and chroma rises
 * monotonically from the lowest band to the highest, along the green-to-blue path a reader will
 * recognise from any sequential map (ColorBrewer's GnBu has this shape). Held inside this
 * project's own visual direction, which is what makes it four steps rather than five or seven.
 *
 * ## The window is 0.14 of lightness wide, and that is the whole design constraint
 *
 * Two rules bound it from both ends and neither is negotiable. A fill must sit clear of `LAND`, or
 * a shaded district reads as one the basis did not reach — twenty of them genuinely are (D25). And
 * a fill must clear 3:1 against `ACCENT`, or a unit outline over it stops reading as an outline.
 * Between those, on this warm paper, there is about 0.14 of OKLab lightness. Four steps inside it
 * are 0.042 apart, which is the honest ceiling on how far apart two adjacent bands can be.
 *
 * ## So adjacent bands do not clear the categorical gates, and that is stated rather than hidden
 *
 * `motherTongueFill` is held to ΔE 15 for unimpaired vision and ΔE 8 for dichromats on every pair
 * that shares a border. **This ramp reaches neither on any adjacent step, and cannot**: adjacent
 * bands run about ΔE 7 for unimpaired vision and ΔE 5–7 for a dichromat, and the weakest step of
 * all is `WEAKEST_BAND_STEP` at ΔE 3.9 — named here because a palette that quietly fails is worse
 * than one that says where. The **ends** of the ramp, which is what a reader is actually comparing
 * when they ask whether one part of the country is better served than another, are ΔE 20 apart and
 * clear every gate, dichromats included.
 *
 * What carries the rest is not colour. The scale is *ordered*, and a reader reads it against the
 * legend in order rather than by recalling an absolute hue; every band is labelled with its own
 * numbers there; and the tooltip prints the district's composite **and all three components**, so
 * the band is never the only thing on screen saying what the district scored. `palette.test.ts`
 * re-derives every claim in this note from the hexes, including the weak pair.
 */
export const DEVELOPMENT_BAND_FILL: Readonly<Record<string, string>> = {
  'under-50': '#9be8c6', // pale green
  '50-65': '#6cdcdb', // teal
  '65-80': '#5bc8f0', // sky
  '80-plus': '#77aff6', // blue
};

/**
 * The weakest pair of neighbours on the ramp — the smallest ΔE between two adjacent bands under
 * any of the four views (unimpaired, protan, deutan, tritan), named as `UNSEPARATED_PAIRS` names
 * its own. Asserted exactly by `palette.test.ts`, so it is derived from the hexes rather than
 * believed about them.
 *
 * **No adjacent step clears the categorical targets**, and that is the arithmetic above rather than
 * a lapse. This is the worst of them, at ΔE 3.9.
 */
export const WEAKEST_BAND_STEP = '50-65↔65-80 under tritanopia';

/**
 * The Administrative basis's ramp — district population, and the app's **second** sequential scale.
 *
 * `visual-design.md` said for a long while that there was exactly one, and the sentence was doing
 * real work: a second ramp is a second thing a reader has to learn, and the first question asked of
 * this one was whether it could borrow the Development ramp's four hexes rather than earn its own.
 * It cannot. One basis is drawn at a time (D9), so the two are never on one map — but they are on
 * one *page*, and the legend redraws with the selection, so a reader who learns *blue means well
 * served* under one basis and meets the same blue meaning *thirteen million people* under the next
 * has been taught a colour that means two things. Two scales are the honest cost of a second
 * ordered basis; one set of hexes doing double duty is not a saving, it is a false economy paid by
 * the reader.
 *
 * So this is a separate path on the wheel, searched the same way and against the same gates:
 * **violet → pink → rose → coral**, hue 320° through 35°, where Development runs 165° to 255°. No
 * band of one is within ΔE 17 of any band of the other, which is past the categorical floor —
 * the two ramps are further apart from each other than either is internally separated, which is
 * exactly the right way round.
 *
 * ## The pale end is pinned by the paper and the dark end by the accent
 *
 * The same 0.14 of lightness the Development ramp lives in, and the same two rules closing it —
 * but this path runs through the warm half of the wheel, where the *paper* is, so the first of them
 * binds much harder. `LAND` is a warm off-white at hue 83°, and a pale warm fill beside it reads as
 * a district the basis did not reach — twenty of them genuinely are (D25). **The palest band sits
 * ΔE 10.0 from the land tone, which is the floor itself**: the search returns nothing at all above
 * it that still steps cleanly to the band below. At the other end **the darkest band clears the
 * unit accent by 3.04:1**, against a floor of 3. Both ends are at their gate rather than
 * comfortably inside it, and that is the finding — a ramp on this paper in these hues has no slack
 * left to spend, which is why there are four bands and no fifth here either.
 *
 * ## Adjacent bands do not clear the categorical gates, exactly as the other ramp's do not
 *
 * Steps run ΔE 6.0 to 6.9 for unimpaired vision — above this ramp's own floors, below the ΔE 15 a
 * categorical pair is held to, and no hue rotation inside the window changes that. What carries the
 * reading is what carries it on the other ramp: the scale is *ordered* and read against its legend
 * in order, every band is labelled with its own figures there, and **the tooltip prints the
 * district's population in full** — which this basis gets for free, because the population was
 * already on it. The ends are ΔE 18.8 apart and clear every gate, dichromats included.
 */
export const POPULATION_BAND_FILL: Readonly<Record<string, string>> = {
  'under-500k': '#f5cbff', // pale lilac
  '500k-1.5m': '#fcb5dc', // pink
  '1.5m-3m': '#fda1af', // rose
  '3m-plus': '#f5937a', // coral
};

/**
 * The population ramp's weakest step, named for the reason `WEAKEST_BAND_STEP` is: the two most
 * populous bands, under tritanopia, at ΔE 4.9. Asserted exactly, so it is derived from the hexes.
 */
export const WEAKEST_POPULATION_STEP = '1.5m-3m↔3m-plus under tritanopia';

/**
 * The pairs this palette does not separate — below the ΔE 8 dichromat target, the ΔE 6 tritan
 * floor, or the ΔE 15 normal-vision floor, when the two swatches sit side by side.
 *
 * Here because a palette that quietly fails is worse than one that says where. Every entry is a
 * pair of categories that never share a border, so none of them is ever seen adjacent on the
 * map; they can meet in the legend, which is why each swatch is labelled. Asserted exactly by
 * `palette.test.ts`, so this list is derived from the hexes rather than believed about them.
 */
export const UNSEPARATED_PAIRS: readonly string[] = [
  'Balochi↔Kalasha',
  'Balochi↔Kohiostani',
  'Balochi↔Others',
  'Balochi↔Shina',
  'Balti↔Others',
  'Brahvi↔Kalasha',
  'Brahvi↔Kohiostani',
  'Brahvi↔Mewati',
  'Brahvi↔Others',
  'Brahvi↔Shina',
  'Hindko↔Balti',
  'Hindko↔Brahvi',
  'Hindko↔Kalasha',
  'Hindko↔Mewati',
  'Hindko↔Others',
  'Hindko↔Shina',
  'Kalasha↔Kohiostani',
  'Kalasha↔Others',
  'Kashmiri↔Brahvi',
  'Kashmiri↔Hindko',
  'Kashmiri↔Mewati',
  'Kashmiri↔Others',
  'Kohiostani↔Others',
  'Punjabi↔Balochi',
  'Punjabi↔Brahvi',
  'Punjabi↔Kalasha',
  'Punjabi↔Kohiostani',
  'Punjabi↔Mewati',
  'Punjabi↔Others',
  'Punjabi↔Shina',
  'Pushto↔Balti',
  'Pushto↔Kashmiri',
  'Pushto↔Others',
  'Saraiki↔Balti',
  'Saraiki↔Brahvi',
  'Saraiki↔Hindko',
  'Saraiki↔Kalasha',
  'Saraiki↔Kohiostani',
  'Saraiki↔Others',
  'Saraiki↔Shina',
  'Shina↔Balti',
  'Shina↔Kalasha',
  'Shina↔Kohiostani',
  'Shina↔Mewati',
  'Shina↔Others',
  'Sindhi↔Balti',
  'Sindhi↔Hindko',
  'Sindhi↔Kalasha',
  'Sindhi↔Kashmiri',
  'Sindhi↔Mewati',
  'Sindhi↔Others',
  'Sindhi↔Pushto',
  'Sindhi↔Shina',
  'Urdu↔Brahvi',
  'Urdu↔Kashmiri',
  'Urdu↔Kohiostani',
  'Urdu↔Mewati',
  'Urdu↔Others',
  'Urdu↔Punjabi',
  'Urdu↔Shina',
];
