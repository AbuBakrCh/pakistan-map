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
