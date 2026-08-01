/**
 * The variants themselves — the product.
 *
 * This module is the source of truth for scenario content. `SCENARIOS-DRAFT.md` is the review
 * copy and is deleted once every variant has been migrated here (#36, CLAUDE.md open item 4);
 * keeping both would be two sources that drift within a week. Everything in a variant is
 * rendered card content, not documentation: rationale, status, advocacy, opposition, footnotes
 * and per-unit district lists all appear on screen.
 *
 * One variant is expressed so far. The remaining sixteen arrive under #24–#31, each as a diff
 * against this file that the partition validator has to accept before it can be committed.
 *
 * The shape of a unit's district list is worth reading once: a unit claims districts **as its
 * advocates state them**, and `scenarios.ts` resolves that onto the 2023 set the map draws. Where
 * a claim names a district created after the census the fold table carries it to its parent, so
 * the artifact records the claim, the drawing, and the difference between them.
 */

import { intactProvince, type Unit, type Variant } from './scenarios.ts';

/**
 * South Punjab as its advocates state it: three whole divisions, thirteen districts.
 *
 * Taunsa and Kot Addu were carved out of Dera Ghazi Khan and Muzaffargarh in 2022, after the
 * census date, so this map draws them inside their parents (ADR-0001) and the unit renders as
 * eleven districts of exactly the same ground. Both counts are on the card, because either alone
 * looks like a miscount.
 */
const SOUTH_PUNJAB: Unit = {
  id: 'south-punjab',
  name: 'South Punjab',
  // Shown on the card, never adjudicated: the app reports what people call things. The Seraiki
  // names belong to a claim about language that L1 does not itself make — L1 is an
  // administrative boundary that happens to cover much the same ground.
  alsoKnownAs: ['Saraikistan', 'Saraiki Wasaib'],
  kind: 'proposed',
  claims: [
    // Multan Division
    'Multan',
    'Lodhran',
    'Khanewal',
    'Vehari',
    // Bahawalpur Division
    'Bahawalpur',
    'Bahawalnagar',
    'Rahim Yar Khan',
    // Dera Ghazi Khan Division
    'Dera Ghazi Khan',
    'Layyah',
    'Muzaffargarh',
    'Rajanpur',
    'Taunsa',
    'Kot Addu',
  ],
};

/** L1 — South Punjab Secretariat, the version that partly exists. */
const L1: Variant = {
  id: 'l1',
  basis: 'language',
  name: 'South Punjab Secretariat',
  tagline: 'the version that partly exists',
  rationale:
    'Punjab’s three southernmost divisions — Multan, Bahawalpur and Dera Ghazi Khan — leave the ' +
    'province as one unit. It is the closest any proposal in this app comes to already being ' +
    'true: a separate civil secretariat covering exactly these three divisions has been ' +
    'operational since 2020, without the constitutional amendment an actual province would ' +
    'require. The boundary here is transcribed from that secretariat’s remit, not derived from ' +
    'the census.',
  status:
    'Partly implemented. The South Punjab Secretariat has been operational since 15 October ' +
    '2020, covering exactly these three divisions, and has been kept running under successive ' +
    'governments. Creating a province from it needs a constitutional amendment, which has never ' +
    'passed.',
  advocacy: {
    kind: 'advocated',
    by: [
      'Pakistan Tehreek-e-Insaf (PTI), whose position it is',
      'successive Punjab governments, which have kept the secretariat operational',
    ],
  },
  opposedBy: [
    'Central Punjab political interests',
    'Opponents of dividing Punjab at all, for whom the province’s size is its weight',
  ],
  universe: 'drawn',
  // Not the language basis's `census · proxy`, which is right for the shading and wrong for this
  // boundary. These three divisions come from a secretariat's documented remit, not from census
  // analysis, and the variant's own rationale says so — a transcribed boundary wearing a `census`
  // badge is the precise confusion the vocabulary exists to prevent. `documented`, not `official`:
  // the secretariat is real, but the province is a proposal, and `official` would read as
  // government recognition of the province rather than of the administrative unit.
  badges: ['documented'],
  composition: {
    kind: 'transcribed',
    from: 'the secretariat’s own remit — the Multan, Bahawalpur and Dera Ghazi Khan divisions',
  },
  units: [
    SOUTH_PUNJAB,
    intactProvince('Punjab', SOUTH_PUNJAB.claims),
    intactProvince('Khyber Pakhtunkhwa'),
    intactProvince('Sindh'),
    intactProvince('Balochistan'),
    intactProvince('Islamabad Capital Territory'),
    intactProvince('Azad Jammu & Kashmir'),
    intactProvince('Gilgit-Baltistan'),
  ],
  footnotes: [
    {
      kind: 'district-count',
      text:
        'Sources state this claim as 11 districts. That was the count before 2022, when Taunsa ' +
        'was carved out of Dera Ghazi Khan and Kot Addu out of Muzaffargarh: the same territory ' +
        'is 13 districts today. This map is pinned to the 2023 census, in which neither new ' +
        'district has a population row, so both are drawn inside their parents and the unit ' +
        'reads as 11. Three counts of one piece of ground — 11 then, 13 now, 11 drawn.',
    },
    {
      kind: 'note',
      text:
        'A secretariat is not a province. It devolves administration for these divisions; ' +
        'legislature, governor and provincial share of revenue all still sit in Lahore.',
    },
  ],
  notes: [
    {
      label: 'Collision with the Bahawalpur restoration',
      text:
        'Bahawalpur’s restoration movement rejects being folded into a single southern province ' +
        'at all, and PML-N’s stated position is two provinces rather than one. Those are ' +
        'separate variants on separate bases, and the app never draws two at once.',
    },
  ],
  sources: [
    {
      label:
        'Government of the Punjab — South Punjab Secretariat, established 15 October 2020, ' +
        'covering the Multan, Bahawalpur and Dera Ghazi Khan divisions',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
        'district set this partition is expressed in',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
    {
      label:
        'data/reference/post-census-district-folds.json — Taunsa and Kot Addu, created 2022 and ' +
        'folded into Dera Ghazi Khan and Muzaffargarh under ADR-0001',
    },
  ],
};

export const VARIANTS: readonly Variant[] = [L1];
