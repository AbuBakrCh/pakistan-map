/**
 * The variants themselves — the product.
 *
 * This module is the **only** source of truth for scenario content. `SCENARIOS-DRAFT.md` was the
 * review copy and is deleted (#36, CLAUDE.md open item 4) now that every variant has been migrated
 * here; keeping both would have been two sources that drift within a week — and the draft had
 * already drifted, describing the third development indicator as "improved sanitation", a column
 * PBS does not publish. The migration is reconciled field by field in
 * `docs/research/scenario-migration.md`, which names every drift and every deliberate omission, and
 * the draft itself is recoverable at `git show 20c2f67:SCENARIOS-DRAFT.md` — so "nothing was lost"
 * is checkable by somebody who was not here rather than asserted. Everything in a variant is
 * rendered card content, not documentation:
 * rationale, status, advocacy, opposition, footnotes and per-unit district lists all appear on
 * screen.
 *
 * Every variant the draft approved that has not been retired is expressed: the whole Language
 * basis (L1 to L7), the Administrative basis's one rule-drawn map (A6, which replaced A1 to A4 and
 * outlived A5), the whole Historical one (H1 to H4) and the Development basis's D1.
 *
 * L1, L2 and L3 are one claim read three ways, and they are written to stay that way: each builds
 * its district list out of the one before it rather than restating it. A reading that differed by
 * a district nobody meant to move would otherwise be a valid partition, and the cards say "plus
 * Mianwali and Bhakkar" and "plus Dera Ismail Khan, Tank and Paharpur" in so many words.
 *
 * The shape of a unit's district list is worth reading once: a unit claims districts **as its
 * advocates state them**, and `scenarios.ts` resolves that onto the 2023 set the map draws. Where
 * a claim names a district created after the census the fold table carries it to its parent, so
 * the artifact records the claim, the drawing, and the difference between them.
 */

import type { AdjacencyGraph } from './adjacency.ts';
import { BAND_RULE, groupByDevelopmentBand } from './development-partition.ts';
import {
  INDEX_BANDS,
  INDEX_FORMULA,
  NOT_A_POVERTY_MEASURE,
  bandOf,
} from './development-index.ts';
import { groupDigits as group } from './digits.ts';
import { partitionByDominantLanguage, soleRegionOf } from './mother-tongue-partition.ts';
import {
  divisionalHeadquarters,
  partitionByRule,
  proposedUnits,
  type Centroid,
  type GeneratedPartition,
  type PartitionRule,
} from './partitioner.ts';
import { CENSUS_DISTRICTS, ROSTER } from './roster.ts';
import { unitNames } from './unit-names.ts';
import {
  intactProvince,
  nonEmpty,
  remainderOf,
  resolveClaimedDistrict,
  slug,
  type Footnote,
  type NonEmpty,
  type Source,
  type Unit,
  type Variant,
} from './scenarios.ts';

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
      // Wired in both directions: H4 carries the reciprocal note. A cross-reference that only one
      // side knows about is a card that reads as neutral from the other, and the validator checks
      // that the id names a variant that exists — so a rename cannot orphan either half.
      relatedVariants: ['h4'],
    },
    {
      label: 'Three readings of one claim',
      text:
        'This is the narrowest of the three southern-province readings in this app, and the only ' +
        'one that follows an administrative boundary rather than a language one. The PPP reading ' +
        'adds Mianwali and Bhakkar; the Saraikistan Qaumi Council’s adds Dera Ismail Khan, Tank ' +
        'and Paharpur on top of those, leaving Punjab altogether. They differ in extent and in ' +
        'what they ' +
        'are arguing from, and each is drawn as its own advocates state it.',
      relatedVariants: ['l2', 'l3'],
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

/**
 * The same claim two districts wider: South Punjab plus Mianwali and Bhakkar.
 *
 * Built from L1's list rather than restated, because the whole content of this variant is *what it
 * adds*. The two additions are in Sargodha Division, not in the three southern ones, so this
 * reading leaves the administrative boundary L1 transcribes and lands on a language one — and the
 * census agrees with it about both districts while their own politics does not.
 */
const SOUTH_PUNJAB_PPP: Unit = {
  id: 'south-punjab',
  name: 'South Punjab',
  alsoKnownAs: ['Saraikistan', 'Saraiki Wasaib'],
  kind: 'proposed',
  claims: [...SOUTH_PUNJAB.claims, 'Mianwali', 'Bhakkar'],
};

/** L2 — the PPP's reading of the southern province. */
const L2: Variant = {
  id: 'l2',
  basis: 'language',
  name: 'South Punjab, the PPP reading',
  tagline: 'the same claim, two districts wider',
  rationale:
    'The Pakistan Peoples Party states the southern province two districts wider than the ' +
    'secretariat does: the three southern divisions together with Mianwali and Bhakkar. Those two ' +
    'sit in Sargodha Division rather than in the south, so this line leaves the administrative ' +
    'boundary the secretariat follows and lands on a language one — the census records Saraiki as ' +
    'the mother tongue of 73.7% of Mianwali and 79.4% of Bhakkar. The evidence is drawn under the ' +
    'outline, and so is the argument it does not settle: both districts have organised against ' +
    'being included.',
  status:
    'A stated party position, unimplemented. The PPP argues for a southern province on this ' +
    'extent, which it states as 13 districts — the eleven the south then had, plus Mianwali and ' +
    'Bhakkar. No province has been created and no constitutional amendment to create one has ' +
    'passed.',
  advocacy: {
    kind: 'advocated',
    by: ['Pakistan Peoples Party (PPP), whose stated extent this is'],
  },
  opposedBy: [
    'Central Punjab political interests',
    'Opponents of dividing Punjab at all, for whom the province’s size is its weight',
    'organised local opposition within Mianwali and Bhakkar themselves, which rejects inclusion ' +
      'in a southern province',
  ],
  universe: 'drawn',
  // The same reasoning as L1's, and for the same reason: the shading under this variant is census
  // mother tongue and the basis badges it, but the *boundary* is a party's stated extent rather
  // than census analysis. `documented`, not `census` — and not `official`, since nothing about
  // this reading has been enacted.
  badges: ['documented'],
  composition: {
    kind: 'transcribed',
    from:
      'the PPP’s stated extent — the Multan, Bahawalpur and Dera Ghazi Khan divisions together ' +
      'with Mianwali and Bhakkar',
  },
  units: [
    SOUTH_PUNJAB_PPP,
    intactProvince('Punjab', SOUTH_PUNJAB_PPP.claims),
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
        'Sources state this claim as 13 districts: the eleven the south had before 2022, plus ' +
        'Mianwali and Bhakkar. Taunsa was carved out of Dera Ghazi Khan and Kot Addu out of ' +
        'Muzaffargarh that year, so the same territory is 15 districts today. This map is pinned ' +
        'to the 2023 census, in which neither new district has a population row, so both are ' +
        'drawn inside their parents and the unit reads as 13. Thirteen then, fifteen now, ' +
        'thirteen drawn — and the first and the last are the same thirteen districts.',
    },
    {
      kind: 'contested-edge',
      text:
        'Mianwali and Bhakkar are inside this line and opinion in both districts has publicly ' +
        'rejected it, on the grounds of a Punjabi rather than a Seraiki identity. The census ' +
        'records Saraiki as the mother tongue of 73.7% of those counted in Mianwali and 79.4% in ' +
        'Bhakkar, so the shading under this part of the unit is the reading’s own evidence. This ' +
        'app reports both and adjudicates neither: a mother tongue is not a vote.',
    },
  ],
  notes: [
    {
      label: 'Three readings of one claim',
      text:
        'This is the middle of the three southern-province readings in this app. The South Punjab ' +
        'Secretariat draws the three southern divisions and stops at the provincial boundary; the ' +
        'Saraikistan Qaumi Council’s reading adds Dera Ismail Khan, Tank and Paharpur on top of ' +
        'these fifteen districts and crosses it. The app draws one at a time and never a ' +
        'compromise ' +
        'between them (D8).',
      relatedVariants: ['l1', 'l3'],
    },
    {
      label: 'Collision with the Bahawalpur restoration',
      text:
        'Bahawalpur Division is the eastern third of this unit, and its restoration movement ' +
        'rejects being folded into a single southern province at all. That is a variant of its ' +
        'own on the Historical basis, and the two claims want the same ground on terms that ' +
        'cannot both hold.',
      relatedVariants: ['h4'],
    },
  ],
  sources: [
    {
      label:
        'Pakistan Peoples Party — stated position on a southern province: the districts of the ' +
        'Multan, Bahawalpur and Dera Ghazi Khan divisions as they then stood, together with ' +
        'Mianwali and Bhakkar',
    },
    {
      label:
        'Contemporary press reporting of public opposition in Mianwali and Bhakkar to inclusion ' +
        'in a southern province, argued there on the grounds of a Punjabi rather than a Seraiki ' +
        'identity — the assertion this card’s contested-edge footnote makes',
    },
    {
      label:
        'PBS 2023 Census Table 11 — mother tongue by district, which is where the Saraiki shares ' +
        'quoted on this card for Mianwali and Bhakkar are read from',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
        'district set this partition is expressed in, and which places Mianwali and Bhakkar in ' +
        'Sargodha Division',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
    {
      label:
        'data/reference/post-census-district-folds.json — Taunsa and Kot Addu, created 2022 and ' +
        'folded into Dera Ghazi Khan and Muzaffargarh under ADR-0001',
    },
  ],
};

/**
 * Saraikistan at its full stated extent — and the one unit in this app that leaves its province.
 *
 * Two things here are the reason the project is built out of districts rather than divisions. The
 * claim reaches into Khyber Pakhtunkhwa for Dera Ismail Khan and Tank, so no division-level
 * partition could express it at all; and it has never included the Waziristans, which sit in the
 * same division as Dera Ismail Khan. At division resolution the map would have shaded South
 * Waziristan Pushto and enclosed it inside a Seraiki province in the same frame — a contradiction
 * on screen, and one that would have put a claim in these advocates' mouths that they do not make.
 * So the exclusion is stated in the data, not left to be inferred from the claim.
 */
const SARAIKISTAN: Unit = {
  id: 'saraikistan',
  name: 'Saraikistan',
  alsoKnownAs: ['Saraiki Wasaib'],
  kind: 'proposed',
  claims: [...SOUTH_PUNJAB_PPP.claims, 'Dera Ismail Khan', 'Tank', 'Paharpur'],
  // Named as the two districts that exist today. Both were carved out of the South Waziristan the
  // census counted, so both fold onto the one district this map draws and excluding the pair is
  // excluding the one — which the footnote says, because "excludes: South Waziristan" beside a
  // claim written in current names would look like half an answer.
  excludes: ['Upper South Waziristan', 'Lower South Waziristan'],
};

/** L3 — the Saraikistan Qaumi Council's maximal reading. */
const L3: Variant = {
  id: 'l3',
  basis: 'language',
  name: 'Saraikistan',
  tagline: 'the only line here that leaves its province',
  rationale:
    'The Saraikistan Qaumi Council states the claim at its full extent: the Seraiki-speaking ' +
    'districts of southern Punjab, together with Dera Ismail Khan and Tank, which are districts ' +
    'of Khyber Pakhtunkhwa. It is the only proposal in this app whose province is carved out of ' +
    'two existing ones — without it the map would imply that a new province can only ever come ' +
    'out of the inside of an old one. It is also the only one that has to say what it leaves ' +
    'behind: the claim has never included the Waziristans, and this map draws that exclusion ' +
    'rather than assuming it.',
  status:
    'A nationalist demand, unimplemented. The Saraikistan Qaumi Council argues for a Seraiki ' +
    'province on this extent. No province has been created and no constitutional amendment to ' +
    'create one has passed. The one southern-province scheme that has been given administrative ' +
    'effect — the South Punjab Secretariat, operational since 2020 — covers three Punjab ' +
    'divisions and does not reach across the provincial boundary at all.',
  advocacy: {
    kind: 'advocated',
    by: [
      'Saraikistan Qaumi Council',
      'Seraiki nationalist opinion, for which this is a language claim rather than an ' +
        'administrative one',
    ],
  },
  opposedBy: [
    'Khyber Pakhtunkhwa parties across the spectrum, for whom the province’s territory is not ' +
      'open to a claim made from Punjab',
    'Pashtun nationalist opinion in Dera Ismail Khan',
    'Central Punjab political interests, and opponents of dividing Punjab at all',
    'Bahawalpur’s restoration movement, which rejects being folded into a single southern ' +
      'province',
  ],
  universe: 'drawn',
  // `documented` on the same reasoning as L1's and L2's: the shading is census mother tongue, the
  // boundary is a movement's stated extent. Nothing here was computed by this build — the
  // exclusion of the Waziristans least of all, which is the movement's own line and not a
  // threshold we applied.
  badges: ['documented'],
  composition: {
    kind: 'transcribed',
    from:
      'the Saraikistan Qaumi Council’s stated extent — southern Punjab with Dera Ismail Khan, ' +
      'Tank and Paharpur, and expressly without the Waziristans',
  },
  units: [
    SARAIKISTAN,
    intactProvince('Punjab', SARAIKISTAN.claims),
    intactProvince('Khyber Pakhtunkhwa', SARAIKISTAN.claims),
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
        'This claim is stated here as 18 districts. Three of them were created after the census — ' +
        'Taunsa out of Dera Ghazi Khan, Kot Addu out of Muzaffargarh and Paharpur out of Dera ' +
        'Ismail Khan — and this map is pinned to the 2023 census, in which none of the three has ' +
        'a population row. All three are drawn inside their parents, so the unit reads as 15 ' +
        'districts of exactly the same ground.',
    },
    {
      kind: 'note',
      text:
        'This is the only proposal in the app whose province crosses an existing provincial ' +
        'boundary. Dera Ismail Khan and Tank are districts of Khyber Pakhtunkhwa and everything ' +
        'else in the unit is Punjab’s, so the outline leaves one province and enters another. The ' +
        'census records Saraiki as the mother tongue of 65.8% of those counted in Dera Ismail ' +
        'Khan, which is the ground the claim is made on.',
    },
    {
      kind: 'note',
      text:
        'The claim has never included the Waziristans, and the map draws it that way. South ' +
        'Waziristan — 888,675 people, of whom the census records 98.0% as speaking Pushto, in the ' +
        'census’s own spelling — stays in Khyber Pakhtunkhwa, and the exclusion is carried in the ' +
        'data rather than left to be read off the outline. It was split after the census into ' +
        'Upper and Lower South Waziristan, so both halves fold into the one district drawn here ' +
        'and excluding the two is excluding the one. This is why the app is built out of ' +
        'districts: Dera Ismail Khan Division contains the Waziristans, so at division resolution ' +
        'the map would have shaded them Pushto and enclosed them inside a Seraiki province in the ' +
        'same frame.',
    },
    {
      kind: 'contested-edge',
      text:
        'Tank is inside the line and shades Pushto: the census records it as the mother tongue of ' +
        '83.3% of those counted there, where Dera Ismail Khan beside it shades Saraiki. The ' +
        'claim includes Tank and this map draws the claim, so the disagreement between the ' +
        'outline and the shading beneath it is left visible rather than footnoted away — it is ' +
        'the most informative thing on this variant, and it is where the opposition named above ' +
        'is argued from.',
    },
  ],
  notes: [
    {
      label: 'Three readings of one claim',
      text:
        'This is the widest of the three southern-province readings in this app, and the only one ' +
        'argued as a language claim first. The South Punjab Secretariat draws the three southern ' +
        'divisions; the PPP’s reading adds Mianwali and Bhakkar; this one adds Dera Ismail Khan, ' +
        'Tank and Paharpur to those and leaves Punjab. The app draws one at a time and never a ' +
        'compromise between them (D8).',
      relatedVariants: ['l1', 'l2'],
    },
    {
      label: 'Collision with the Bahawalpur restoration',
      text:
        'Bahawalpur Division is inside this unit, and its restoration movement rejects being ' +
        'folded into a single Seraiki province — it is named on this card’s opposition line for ' +
        'that reason. That claim is a variant of its own on the Historical basis.',
      relatedVariants: ['h4'],
    },
  ],
  sources: [
    {
      label:
        'Saraikistan Qaumi Council — the maximal stated extent of the Seraiki province claim: ' +
        'southern Punjab together with Dera Ismail Khan, Tank and Paharpur, and without the ' +
        'Waziristans',
    },
    {
      label:
        'PBS 2023 Census Table 11 — mother tongue by district, which is where the Saraiki share ' +
        'of Dera Ismail Khan and the Pushto shares of Tank and South Waziristan quoted on this ' +
        'card are read from',
    },
    {
      label:
        'PBS 2023 Digital Census, district table — South Waziristan’s population of 888,675, the ' +
        'figure quoted for the district this claim excludes',
    },
    {
      label:
        'Government of the Punjab — South Punjab Secretariat, established 15 October 2020, ' +
        'covering the Multan, Bahawalpur and Dera Ghazi Khan divisions: the remit this card cites ' +
        'as the scheme that stops at the provincial boundary',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
        'district set this partition is expressed in, and which places Dera Ismail Khan, Tank and ' +
        'South Waziristan in one division',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
    {
      label:
        'data/reference/post-census-district-folds.json — Taunsa, Kot Addu and Paharpur, created ' +
        'after the census and folded into their parents under ADR-0001, and Upper and Lower South ' +
        'Waziristan, which fold into the South Waziristan this claim excludes',
    },
  ],
};

/**
 * Hazara as the division it already is: nine districts today, six when the movement named them.
 *
 * The claim has never moved — it is Hazara Division, whole — but the ground under it has been
 * subdivided twice since 1987. Kohistan became three districts (Upper Kohistan, Lower Kohistan and
 * Kolai Pallas Kohistan) before the census counted anybody, so all three are drawn; Allai was
 * carved out of Battagram after it, so ADR-0001 puts it back inside Batagram and the unit renders
 * as eight. Three counts of one piece of ground, and the footnote says so, because a card that
 * printed only one of them would read as a miscount of a real movement's demand.
 *
 * Names are PBS's own, from the 2023 roster this partition is expressed in — PBS spells Abbottabad
 * with one T and Battagram with one T as well. The resolver takes either spelling; the roster's is
 * used here so the module and the artifact read the same.
 */
const HAZARA: Unit = {
  id: 'hazara',
  name: 'Hazara',
  kind: 'proposed',
  claims: [
    // The six the movement names, in its own order.
    'Haripur',
    'Abbotabad',
    'Mansehra',
    'Batagram',
    'Torghar',
    // Kohistan, split three ways between 2014 and 2017 — before the census, so all three are
    // districts of the 2023 set and all three are drawn.
    'Upper Kohistan',
    'Lower Kohistan',
    'Kolai Pallas Kohistan',
    // Created out of Battagram after the census date. No population row, so it is not drawn on
    // its own; the fold table carries it back into Batagram and the artifact records that.
    'Allai',
  ],
};

/** L4 — Hazara, the Hindko-speaking division that has asked to be a province since 1987. */
const L4: Variant = {
  id: 'l4',
  basis: 'language',
  name: 'Hazara',
  tagline: 'a division that has asked for forty years',
  rationale:
    'Hazara Division leaves Khyber Pakhtunkhwa as a province of its own. It is the one Language ' +
    'variant whose boundary needs no interpretation at all: the claim is an existing ' +
    'administrative division, entire, and its advocates have never asked for more or less than ' +
    'that. What makes it a language claim is what is inside the line — Hindko is the mother tongue ' +
    'of 56% of the division’s people, and the movement’s case rests on it. It is a majority of the ' +
    'population and not of the map: three of the eight districts drawn here shade Hindko, and five ' +
    'do not.',
  status:
    'Live and unimplemented. The Hazara Qaumi Mahaz was founded in 1987; the demand became mass ' +
    'mobilisation in April 2010, when the 18th Amendment renamed North-West Frontier Province as ' +
    'Khyber Pakhtunkhwa and Hazara read the new name as one it had not been consulted on. On 12 ' +
    'April 2010 police fired on demonstrators in Abbottabad, killing seven. No province has been ' +
    'created, and no constitutional amendment to create one has been tabled since.',
  advocacy: {
    kind: 'advocated',
    by: [
      'Hazara Qaumi Mahaz, founded 1987',
      'broad cross-party support within the division itself',
    ],
  },
  opposedBy: [
    'Pashtun nationalist parties, the Awami National Party foremost, for whom Khyber ' +
      'Pakhtunkhwa’s territorial integrity is bound up with the province’s Pashtun identity',
  ],
  universe: 'drawn',
  // Not the basis's `census · proxy`. The shading under this variant is census mother tongue and
  // is badged that way by the basis; the *boundary* is not census analysis at all — it is Hazara
  // Division as PBS publishes it, claimed by a movement that names its own districts. `documented`
  // says that. `official` would be worse than wrong: the division is official, the province is a
  // proposal, and one badge cannot mean both.
  badges: ['documented'],
  composition: {
    kind: 'transcribed',
    from: 'Hazara Division as PBS publishes it, which is the movement’s own claim entire',
  },
  units: [
    HAZARA,
    intactProvince('Khyber Pakhtunkhwa', HAZARA.claims),
    intactProvince('Punjab'),
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
        'The movement states this claim as six districts — Haripur, Abbottabad, Mansehra, ' +
        'Batagram, Kohistan and Torghar. That was the division’s composition when the demand was ' +
        'framed. Kohistan has since been split three ways, into Upper Kohistan, Lower Kohistan ' +
        'and Kolai Pallas Kohistan, and Allai was carved out of Batagram: the same territory is ' +
        'nine districts today. This map is pinned to the 2023 census, in which Allai has no ' +
        'population row, so it is drawn inside Batagram and the unit reads as eight. Six as ' +
        'claimed, nine today, eight drawn — one division, and not one boundary of it has moved.',
    },
    {
      kind: 'note',
      text:
        'Hindko has a column of its own in census Table 11, so the shading under this variant is ' +
        'the movement’s own evidence rather than a stand-in for it. Where a district of the ' +
        'division shades as something else, that disagreement is on the map and is not footnoted ' +
        'away.',
    },
  ],
  sources: [
    {
      label:
        'Hazara Qaumi Mahaz — the movement’s stated claim: the six districts of Hazara Division ' +
        'as constituted in 1987',
    },
    {
      label:
        'Contemporary press reporting of 12 April 2010, when police fired on a Hazara province ' +
        'demonstration in Abbottabad and seven people were killed, in the days after the 18th ' +
        'Amendment renamed North-West Frontier Province as Khyber Pakhtunkhwa',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), which ' +
        'is where the nine-district composition of Hazara Division is read from',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
    {
      label:
        'data/reference/post-census-district-folds.json — Allai, created after the census date ' +
        'and folded into Batagram under ADR-0001',
    },
  ],
};

/**
 * Karachi Division, which is the part of "urban Sindh" that can be drawn.
 *
 * MQM-P argues for a province of urban Sindh, not for a province of Karachi: the claim reaches
 * into urban Hyderabad, Sukkur and Mirpur Khas as well. No published district list exists for that
 * wider demand, and there is no such thing as half a district on this map — so drawing it would
 * mean choosing which parts of four more districts belong to it, which is the app inventing a
 * boundary and putting a movement's name on it. The expressible core is drawn and the rest is
 * stated in a footnote, which is the same answer H2 gives to Amb and Phulra.
 */
const KARACHI: Unit = {
  id: 'karachi',
  name: 'Karachi',
  kind: 'proposed',
  claims: [
    // Karachi Division, all seven districts. Four of them were renamed in 2013 and OSM still
    // carries the old names; the roster resolves them by relation id rather than by name.
    'Karachi Central',
    'Karachi East',
    'Karachi South',
    'Karachi West',
    'Korangi',
    'Malir',
    'Keamari',
  ],
};

/** L5 — Karachi / urban Sindh, the Urdu-speaking claim. */
const L5: Variant = {
  id: 'l5',
  basis: 'language',
  name: 'Karachi / urban Sindh',
  tagline: 'the claim that is larger than the map can draw',
  rationale:
    'Karachi Division leaves Sindh as a province of its own. It is the only variant in this app ' +
    'whose drawn extent is smaller than the demand behind it: MQM-P frames the claim as urban ' +
    'Sindh — Karachi together with urban Hyderabad, Sukkur and Mirpur Khas — on the basis of ' +
    'mother tongue and of the land exchanged at partition. Its advocates argue the case in revenue ' +
    'as well as in language — that Karachi raises a large share of what Sindh collects while ' +
    'control of the provincial budget sits elsewhere — and that argument is reported here as ' +
    'theirs: this app carries no revenue data and does not adjudicate it.',
  status:
    'A long-standing demand, raised repeatedly by MQM and its successors and as recently as 2026. ' +
    'No province has been created and no constitutional amendment to create one has passed.',
  advocacy: {
    kind: 'advocated',
    by: ['Muttahida Qaumi Movement – Pakistan (MQM-P)', 'historically the Muttahida Qaumi Movement'],
  },
  // Not a list of the usual opponents: this is close to a cross-party consensus in rural Sindh,
  // and a card that named one party would report a national disagreement as a factional one.
  opposedBy: [
    'Pakistan Peoples Party (PPP)',
    'the Grand Democratic Alliance (GDA)',
    'Awami Tehreek',
    'Sindhi nationalist opinion broadly, which rejects any division of Sindh outright',
  ],
  universe: 'drawn',
  // Same reasoning as L4's: the shading is census mother tongue and the basis badges it, but the
  // boundary is Karachi Division as published, claimed by a movement — `documented`, not `census`.
  badges: ['documented'],
  composition: {
    kind: 'transcribed',
    from: 'Karachi Division as PBS publishes it — the part of the urban Sindh claim that has a ' +
      'published district list behind it',
  },
  units: [
    KARACHI,
    intactProvince('Sindh', KARACHI.claims),
    intactProvince('Punjab'),
    intactProvince('Khyber Pakhtunkhwa'),
    intactProvince('Balochistan'),
    intactProvince('Islamabad Capital Territory'),
    intactProvince('Azad Jammu & Kashmir'),
    intactProvince('Gilgit-Baltistan'),
  ],
  footnotes: [
    {
      kind: 'omission',
      text:
        'MQM-P’s framing is urban Sindh, not Karachi: the claim extends to urban Hyderabad, ' +
        'Sukkur and Mirpur Khas. No published district list exists for that wider claim, and this ' +
        'map is built out of whole districts — so drawing it would mean deciding for ourselves ' +
        'which parts of Hyderabad, Sukkur and Mirpur Khas are urban enough to belong to it. What ' +
        'is drawn here is the expressible core, Karachi Division, and the remainder is said ' +
        'rather than invented.',
    },
    {
      kind: 'note',
      text:
        'Urdu is a census category of its own in Table 11, so the shading under this variant is ' +
        'the claim’s own evidence. The three districts named above are shaded like any other and ' +
        'are not inside the unit, which is the disagreement between the claim and the drawing ' +
        'made visible rather than described.',
    },
  ],
  sources: [
    {
      label:
        'MQM-P — the urban Sindh province demand, stated on the basis of mother tongue and of ' +
        'land exchanged at partition, and raised again in 2026',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), which ' +
        'is where the seven-district composition of Karachi Division is read from',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
  ],
};

/**
 * West Pakistan — every province and princely state west of India, consolidated into one.
 *
 * Three things this unit is *not*, each of which would have been the easy mistake. It is not the
 * whole map: Azad Jammu & Kashmir was never part of it, and the Northern Areas were administered
 * federally rather than as part of the province, so both are drawn as themselves. It is not a
 * proposal — nobody advocates restoring One Unit, and the variant says so where its advocacy line
 * would otherwise be. And Islamabad is inside it, which is the one judgement here worth reading
 * the footnote for.
 */
const WEST_PAKISTAN: Unit = {
  id: 'west-pakistan',
  name: 'West Pakistan',
  kind: 'proposed',
  claims: [
    // The four provinces and the capital, entire — which is exactly the 136 districts PBS
    // published 2023 results for. Written as remainders rather than typed out, because a
    // hand-listed 136 is 136 chances to mistype one and the remainder is checked like any claim.
    ...remainderOf('Punjab'),
    ...remainderOf('Sindh'),
    ...remainderOf('Khyber Pakhtunkhwa'),
    ...remainderOf('Balochistan'),
    ...remainderOf('Islamabad Capital Territory'),
  ],
};

/** H1 — One Unit, 1955–1970. */
const H1: Variant = {
  id: 'h1',
  basis: 'historical',
  name: 'One Unit',
  tagline: '1955–1970, and the whole west in one colour',
  rationale:
    'Every province and princely state west of India was merged into a single province of West ' +
    'Pakistan on 14 October 1955, to stand as one half of a two-province federation against East ' +
    'Bengal. It lasted fifteen years and was dissolved on 1 July 1970. It is the most dramatic map ' +
    'in this app, and one of the few here that were once the law rather than a proposal — the ' +
    'nearest of the others being the 1970 restoration that undid it.',
  status:
    'Historical, and reversed. West Pakistan was constituted by the Establishment of West ' +
    'Pakistan Act, 1955, with effect from 14 October 1955, and dissolved with effect from 1 July ' +
    '1970, which restored the four provinces that had been merged into it. No party advocates ' +
    'its restoration.',
  // Nobody proposes this. That is a fact about the variant and it is said in the advocacy's own
  // words rather than shown as an empty list — the same shape L7 and D1 use for a rule nobody
  // argues the output of, and for the same reason: an empty list reads as an oversight.
  advocacy: {
    kind: 'unadvocated',
    note:
      'Nobody advocates One Unit. It is drawn here as a demarcation that existed, not as a ' +
      'proposal — the app carries it because every other map in this file is argued against a ' +
      'past that includes it, and because it was actually in force, which is true of few of the ' +
      'arrangements on this list.',
  },
  // Written as what stood against the scheme while it ran, not as who caused its end. One Unit
  // was dissolved by Yahya Khan's 1970 Order, and a card that handed that outcome to the movements
  // opposing it would be this app settling a question of cause that its sources do not settle.
  opposedBy: [
    'Sindhi, Baloch and Pashtun nationalist opinion, which opposed the merger throughout its ' +
      'fifteen years and campaigned for the restoration of the provinces it had absorbed',
    'Bengali opinion in the eastern wing, for whom parity between two provinces meant a majority ' +
      'population held to half the seats',
  ],
  universe: 'drawn',
  // The demarcation's own dates, which is what the Historical basis defers to a variant for: its
  // declared vintage is the rule for finding a date ("stated per variant, not shared"), so a
  // variant here that states none leaves every surface with a deferral where a date should be.
  // These are the fifteen years the map drawn here was the law — not the vintage of the district
  // set it is expressed in, which is 2023's under ADR-0001 and is a fact about how it is drawn
  // rather than about when it was in force.
  vintage:
    '14 October 1955 to 30 June 1970 — the fifteen years the One Unit demarcation was in force',
  composition: {
    kind: 'transcribed',
    from:
      'the Establishment of West Pakistan Act, 1955 — every province and princely state west of ' +
      'India, less the territories never inside it',
  },
  units: [
    WEST_PAKISTAN,
    // Kept as themselves because that is what they were. Neither was part of the province of West
    // Pakistan: AJK has been separately administered since 1947, and the Gilgit Agency and
    // Baltistan were administered directly by the federal government throughout.
    intactProvince('Azad Jammu & Kashmir'),
    intactProvince('Gilgit-Baltistan'),
  ],
  footnotes: [
    {
      kind: 'note',
      text:
        'The map draws three shapes and One Unit is one of them. Azad Jammu & Kashmir was never ' +
        'part of the province of West Pakistan, and the Gilgit Agency and Baltistan — the ' +
        'Northern Areas — were administered directly by the federal government rather than ' +
        'through it. Drawing either inside West Pakistan would be a constitutional claim the ' +
        'scheme itself did not make.',
    },
    {
      kind: 'note',
      text:
        'Islamabad is drawn inside West Pakistan, which is true of the ground and not of the ' +
        'whole period. When One Unit was formed the capital was Karachi, itself federal territory ' +
        'until 1961, and the ground Islamabad Capital Territory now covers was part of Rawalpindi ' +
        'district inside West Pakistan. This map is built out of the 2023 district set, which has ' +
        'one Islamabad and no 1955 Karachi federal area, so the capital’s own changing standing ' +
        'over the fifteen years is stated here rather than drawn.',
    },
    {
      kind: 'note',
      text:
        'Every one of the 136 districts the census covers changes hands in this variant, because ' +
        'not one of them stays inside a unit named after the province it is in today. That is the ' +
        'scheme working as it was designed to, not an artefact of how the figure is counted.',
    },
  ],
  notes: [
    {
      label: 'What it absorbed, and what came back',
      text:
        'The map One Unit replaced is H2: four provinces and eleven acceding princely states, ' +
        'every one of which this scheme merged into a single province. The map that replaced One ' +
        'Unit is H3, which restored the four provinces and not one of the states. Read in order ' +
        'the three are how Pakistan’s first-level geography got from many units to four.',
      relatedVariants: ['h2', 'h3'],
    },
  ],
  sources: [
    {
      label:
        'Establishment of West Pakistan Act, 1955 — the four provinces, the princely states and ' +
        'the tribal areas of the western wing merged into one province with effect from 14 ' +
        'October 1955',
    },
    {
      label:
        'The Province of West Pakistan (Dissolution) Order, 1970 — West Pakistan dissolved and ' +
        'the four provinces restored with effect from 1 July 1970',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
        'district set this partition is expressed in',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// H2 — the provinces and the princely states, 1947 to 1955 (#30).
//
// The one variant in this app that draws a map older than the units it is drawn out of, and the
// only one that publishes no population figure at all. Both facts follow from the same thing: what
// is drawn is the arrangement that stood between accession and One Unit, and PBS counted people in
// 2023, inside districts that did not exist then, in states that had been abolished for sixty-eight
// years. Attaching those figures here would describe a Pakistan nobody has ever counted, so the
// variant withholds them in its own words and the scorecard prints the reason where the population
// lines would be.
//
// It is also the variant that asked CLAUDE.md open item 2b and got the second of its two
// narrowings. Hunza and Nagar were princely states in their own right and are Gilgit-Baltistan
// districts today; neither is a whole territory under its own name, so `promotedTerritoryOf`'s
// carve-out does not reach them and should not. What admits them is `withoutModernFigures`:
// a variant with no population figures has no unit whose population can be short, which is the only
// reason `forbid` was ever answered. `TERRITORY_CLAIM_POLICY` is untouched.
// ---------------------------------------------------------------------------------------------

/**
 * The eleven acceding states this map can draw, each as the 2023 districts covering its territory.
 *
 * The claims are stated in the districts that cover the ground **today**, post-census ones
 * included, and the validator folds them onto the 2023 set (ADR-0001) — so Kalat is stated as four
 * districts and drawn as three, and the card prints both with the fold named. That is the same
 * treatment South Punjab's 13-for-11 gets, and it is the honest one here for the same reason: Wadh
 * and Tump are real ground that a reader can find on a current map and cannot find on this one.
 *
 * Two of the eleven are approximations and are footnoted as such rather than presented as exact.
 * The princely states' boundaries were not district boundaries, and this map has no others to draw
 * with — so where a state's territory and a modern district disagree, the district wins and the
 * card says where.
 */
const PRINCELY_STATES: NonEmpty<Unit> = [
  {
    id: 'bahawalpur-state',
    name: 'Bahawalpur',
    kind: 'proposed',
    claims: ['Bahawalpur', 'Bahawalnagar', 'Rahim Yar Khan'],
    note:
      'Acceded October 1947, retaining internal self-government. The one state on this map whose ' +
      'restoration is still argued for — H4 draws that claim on today’s boundaries.',
  },
  {
    id: 'khairpur-state',
    name: 'Khairpur',
    kind: 'proposed',
    claims: ['Khairpur'],
    note: 'Acceded October 1947. Its territory is one district of Sindh today, unchanged since.',
  },
  {
    id: 'kalat-state',
    name: 'Kalat',
    kind: 'proposed',
    claims: ['Kalat', 'Khuzdar', 'Wadh', 'Surab'],
    note:
      'Acceded 27 March 1948, the last and the most disputed of the accessions on this map. Drawn ' +
      'approximately — see the footnote.',
  },
  {
    id: 'las-bela-state',
    name: 'Las Bela',
    kind: 'proposed',
    claims: ['Lasbela', 'Hub'],
    note: 'Acceded March 1948. Hub was carved out of Lasbela in 2022 and folds back into it here.',
  },
  {
    id: 'kharan-state',
    name: 'Kharan',
    kind: 'proposed',
    claims: ['Kharan', 'Washuk'],
    note: 'Acceded March 1948.',
  },
  {
    id: 'makran-state',
    name: 'Makran',
    kind: 'proposed',
    claims: ['Kech', 'Gwadar', 'Panjgur', 'Tump'],
    note:
      'Acceded March 1948. Gwadar town and its coastal strip were not part of it — see the ' +
      'footnote on Oman.',
  },
  {
    id: 'swat-state',
    name: 'Swat',
    kind: 'proposed',
    claims: ['Swat', 'Upper Swat', 'Shangla', 'Buner'],
    note: 'Acceded November 1947. Drawn approximately — see the footnote.',
  },
  {
    id: 'dir-state',
    name: 'Dir',
    kind: 'proposed',
    claims: ['Lower Dir', 'Upper Dir', 'Central Dir'],
    note: 'Acceded November 1947.',
  },
  {
    id: 'chitral-state',
    name: 'Chitral',
    kind: 'proposed',
    claims: ['Upper Chitral', 'Lower Chitral'],
    note: 'Acceded 1947. Its territory is the two Chitral districts today, unchanged since.',
  },
  {
    id: 'hunza-state',
    name: 'Hunza',
    kind: 'proposed',
    claims: ['Hunza'],
    note:
      'Acceded November 1947, after the Gilgit Agency passed to Pakistan. A district of ' +
      'Gilgit-Baltistan today, which is why this variant needed open item 2b narrowing.',
  },
  {
    id: 'nagar-state',
    name: 'Nagar',
    kind: 'proposed',
    claims: ['Nagar'],
    note: 'Acceded November 1947, alongside Hunza across the river from it.',
  },
];

/** Every district the eleven states claim, for the remainders the four provinces are written as. */
const PRINCELY_CLAIMS: readonly string[] = PRINCELY_STATES.flatMap((state) => [...state.claims]);

/** H2 — the provinces and the acceding princely states, 1947–1955. */
const H2: Variant = {
  id: 'h2',
  basis: 'historical',
  name: 'Provinces and princely states',
  tagline: '1947–1955, before One Unit absorbed them all',
  rationale:
    'The four provinces as they were at independence, with the princely states that acceded ' +
    'between August 1947 and March 1948 drawn as the self-governing units they then were. It is ' +
    'the oldest map in this app and the only one that predates every proposal in it: eleven of ' +
    'the units here were states with their own rulers, and all of them were gone by 1969. What it ' +
    'shows is that a Pakistan of many small units is not a novel idea being argued for — it is ' +
    'the arrangement the country started with and then dismantled.',
  status:
    'Historical, and abolished in stages rather than at once. The Balochistan States Union — ' +
    'Kalat, Las Bela, Kharan and Makran — was formed in 1952 and merged into West Pakistan by the ' +
    'Establishment of West Pakistan Act, 1955, which absorbed Bahawalpur and Khairpur at the same ' +
    'time. Swat, Dir and Chitral kept their internal self-government longest and were merged into ' +
    'the North-West Frontier Province in 1969. None was restored when West Pakistan was dissolved ' +
    'in 1970, and no state has had its separate status returned since.',
  advocacy: {
    kind: 'unadvocated',
    note:
      'Nobody proposes restoring the princely states. This is drawn as a demarcation that ' +
      'existed, not as a proposal — the app carries it because it is the arrangement every later ' +
      'map in this file departed from, and because one piece of it is still argued for: ' +
      'Bahawalpur’s restoration is a live claim, and H4 draws that claim on its own terms rather ' +
      'than as a fragment of this one.',
  },
  opposedBy: [
    'anyone for whom hereditary states are not a constitutional arrangement to return to — the ' +
      'states were merged into the provinces between 1955 and 1969, and no party proposes ' +
      'restoring the rulers whose self-government is what this map draws',
    'Baloch nationalist opinion, for which the accession of Kalat in March 1948 is itself ' +
      'disputed: drawing the state inside Pakistan states a settlement that opinion does not ' +
      'accept, and the map cannot draw the state without also drawing that',
  ],
  universe: 'drawn',
  // The period the arrangement stood, not a single day: the accessions run from August 1947 to
  // March 1948 and the abolitions from 1955 to 1969, so a date here would be a date for one state
  // rather than for the map. The Historical basis defers to the variant for exactly this reason,
  // and a variant that stated none would print its basis's deferral where a date should be.
  vintage:
    'August 1947 to 14 October 1955 — the provinces and the acceding princely states as they ' +
    'stood before the Establishment of West Pakistan Act absorbed them',
  composition: {
    kind: 'transcribed',
    from:
      'the Instruments of Accession of 1947 and 1948 and the states as they stood until One Unit, ' +
      'expressed in the 2023 districts covering their territory',
  },
  // The hard rule of this variant, and the reason it has one. Stated as card copy because the
  // scorecard prints it where the population lines would otherwise be (#20).
  statistics: {
    modernFigures: false,
    reason:
      'This map is the boundaries of 1947 to 1955. The 2023 census counted people inside ' +
      'districts that did not exist then, in states that had been abolished for sixty-eight ' +
      'years, so its figures describe none of the units drawn here. No population figure is given ' +
      'anywhere on this variant — not for a state, not for a province, and not as a total.',
  },
  units: [
    ...PRINCELY_STATES,
    // Renamed and smaller, exactly as in H3 and for the same reason: a unit called North-West
    // Frontier Province holding 28 of Khyber Pakhtunkhwa's districts is not "unchanged from the
    // current map", which is what an `unchanged` unit says on the card.
    {
      id: 'nwfp',
      name: 'North-West Frontier Province',
      alsoKnownAs: ['NWFP'],
      kind: 'proposed',
      claims: remainderOf('Khyber Pakhtunkhwa', PRINCELY_CLAIMS),
      note:
        'Renamed Khyber Pakhtunkhwa by the 18th Amendment in 2010. Smaller here than today by the ' +
        'three Malakand states, which it absorbed in 1969.',
    },
    /*
     * Punjab is `proposed` and not `unchanged`, and it is the one unit here where the two are a
     * genuine question rather than a formality.
     *
     * `unchanged` says one sentence on the card and in the tooltip — *Unchanged from the current
     * map* — and this Punjab is not. It is short of Bahawalpur, which `unchanged` would forgive:
     * the rule this app states is that the unit called Punjab is Punjab **whatever it has lost**.
     * But it also holds the ground Islamabad Capital Territory now covers, and gaining is not
     * losing. A reader tapping Islamabad under this variant would have been told they were in a
     * Punjab unchanged from today's, when today that ground is not Punjab at all.
     *
     * The geography is right and stays exactly as it is: the capital territory was carved out of
     * Rawalpindi district in 1960 and did not exist in this period, so drawing it as its own unit
     * would put a 1960s federal territory on a 1947 map. H1 made the same call. Only the word was
     * wrong, and it is the same correction NWFP above already carries.
     */
    {
      id: 'punjab',
      name: 'Punjab',
      kind: 'proposed',
      claims: [...remainderOf('Punjab', PRINCELY_CLAIMS), 'Islamabad'],
      note:
        'Smaller than today’s Punjab by Bahawalpur, and larger by the ground Islamabad Capital ' +
        'Territory now covers, which was part of Rawalpindi district inside Punjab throughout this ' +
        'period — so it is not the Punjab of the current map, and is not labelled as though it were.',
    },
    // Sindh and Balochistan *only* lose ground, which is exactly what `unchanged` is written to
    // forgive: the unit carrying the province's name forward, whatever it has lost. Neither gains a
    // district, so neither has Punjab's problem, and calling either `proposed` would report a
    // province that shrank as a proposal nobody made.
    {
      id: 'sindh',
      name: 'Sindh',
      kind: 'unchanged',
      claims: remainderOf('Sindh', PRINCELY_CLAIMS),
      note: 'Smaller than today’s Sindh by Khairpur, and otherwise the same province.',
    },
    {
      id: 'balochistan',
      name: 'Balochistan',
      kind: 'unchanged',
      claims: remainderOf('Balochistan', PRINCELY_CLAIMS),
      note:
        'The Chief Commissioner’s Province — British Balochistan — without the four states beside ' +
        'it, which were separately governed and from 1952 formed the Balochistan States Union. It ' +
        'loses ground to them and gains none, so it is the province carried forward.',
    },
    // The Gilgit Agency, less the two states inside it. `territory` because that is what it was and
    // is: administered federally throughout this period, and not a province then or now.
    {
      id: 'gilgit-agency',
      name: 'Gilgit Agency and Baltistan',
      alsoKnownAs: ['Northern Areas', 'Gilgit-Baltistan'],
      kind: 'territory',
      claims: remainderOf('Gilgit-Baltistan', PRINCELY_CLAIMS),
      note:
        'Administered directly by the federal government throughout, and named the Northern Areas ' +
        'until the Gilgit-Baltistan Order of 2009. Hunza and Nagar are drawn out of it as the ' +
        'states they were.',
    },
    intactProvince('Azad Jammu & Kashmir'),
  ],
  footnotes: [
    // The ticket's own requirement, and the app's standing refusal: what cannot be drawn from a
    // source is named rather than approximated.
    {
      kind: 'omission',
      text:
        'Amb and Phulra are omitted. Both acceded in 1947 and both were smaller than any district ' +
        'this map draws — Amb straddled the Indus around Darband and Phulra was smaller still, and ' +
        'their territory is today inside Mansehra and Haripur. Drawing either would mean inventing ' +
        'a boundary inside a district drawn whole, which is the one thing this app does not do. ' +
        'They are named here instead, and the ground they covered is inside North-West Frontier ' +
        'Province on this map.',
    },
    {
      kind: 'district-count',
      text:
        'Five of the states are stated in more districts than are drawn, because five districts ' +
        'created after the 2023 census fold back into the districts that carry them (ADR-0001): ' +
        'Wadh inside Khuzdar and Tump inside Kech, both notified in 2026; Upper Swat inside Swat; ' +
        'Central Dir inside Lower Dir; and Hub inside Lasbela. Nothing is lost — the same ground ' +
        'is drawn either way — but the counts differ, and both are printed rather than either ' +
        'alone.',
    },
    {
      kind: 'note',
      text:
        'Kalat is drawn approximately, and it is the largest approximation on this map. The state ' +
        'at its greatest extent covered Mastung and Awaran as well, and claimed Las Bela, Kharan ' +
        'and Makran as its vassals — the three acceded to Pakistan separately in March 1948, which ' +
        'Kalat disputed. Drawn here are the four districts of its core territory; Mastung and ' +
        'Awaran are inside Balochistan, and the three other states are drawn as themselves. That ' +
        'is what leaves Balochistan in two pieces on this map: with Kalat, Las Bela, Kharan and ' +
        'Makran drawn around it, Awaran touches no other district of the province it is in. The ' +
        'scorecard reports it rather than the map hiding it, and the stranding is this ' +
        'approximation’s doing rather than the 1947 arrangement’s.',
    },
    {
      kind: 'note',
      text:
        'Swat is drawn approximately. The state’s northern edge ran through what is now Upper ' +
        'Swat and into the Kalam valley, and its eastern boundary with the Kohistan districts was ' +
        'never a district line. What is drawn is Swat, Shangla and Buner, which is the closest the ' +
        '2023 district set comes to it.',
    },
    {
      kind: 'note',
      text:
        'Gwadar is drawn inside Makran, and for part of this period it was not Pakistani at all. ' +
        'Gwadar town and its coastal strip were an exclave of Oman until Pakistan purchased them ' +
        'on 8 September 1958 — after this map ends. The rest of what is now Gwadar district was ' +
        'Makran State’s, and the district cannot be split without inventing the boundary between ' +
        'the two, so the whole of it is drawn here and the exception is stated.',
    },
    {
      kind: 'note',
      text:
        'The tribal agencies are drawn inside North-West Frontier Province, which they were not. ' +
        'Throughout this period they were federally administered and outside the province ' +
        'altogether — the arrangement H3 draws for 1970, where they are a unit of their own. They ' +
        'are not separated here because this map’s subject is the princely states, and drawing a ' +
        'third tier of federally administered ground would put two different arguments on one ' +
        'picture.',
    },
    {
      kind: 'note',
      text:
        'Baltistan is drawn with the Gilgit Agency, which is right for most of this period and not ' +
        'for its start: Baltistan was part of the Ladakh wazarat of Jammu and Kashmir before the ' +
        'fighting of 1948 and was administered with Gilgit afterwards. Hunza and Nagar are drawn ' +
        'out of the Agency as the states they were, each of which kept its ruler and its internal ' +
        'self-government well past the period this map ends in.',
    },
    {
      kind: 'note',
      text:
        'The districts-moved figure reads 59, and it is made of four things rather than one: the ' +
        '22 districts drawn as princely states, the 28 of North-West Frontier Province, which is ' +
        'Khyber Pakhtunkhwa under the name it carried until 2010, the 8 left in the Gilgit Agency ' +
        'once Hunza and Nagar are drawn out of it, and Islamabad. Only the first group is ground ' +
        'held by something other than a province; the rest is this map using the names of 1947, ' +
        'because what carries a first-level unit forward is decided on its name. Azad Jammu & ' +
        'Kashmir keeps its name here and so counts as moving nothing at all.',
    },
  ],
  notes: [
    {
      label: 'Collision with the Bahawalpur restoration and the southern-province claims',
      text:
        'Bahawalpur is drawn here as the state it was until 1955, and H4 draws the same three ' +
        'districts as the province its restoration movement is asking for — the difference being ' +
        'that H4 is a live claim about today and this is a record of what existed. The same three ' +
        'districts are the eastern third of every southern-province reading in the app, whose ' +
        'advocates would fold them into one Seraiki province instead. The app draws one variant at ' +
        'a time and never a compromise between two claims (D8).',
      relatedVariants: ['h4', 'l1', 'l2', 'l3'],
    },
    {
      label: 'What One Unit absorbed, and what 1970 did not restore',
      text:
        'Every unit on this map west of India was merged into the single province of West Pakistan ' +
        'in 1955, which H1 draws. When West Pakistan was dissolved in 1970 the four provinces came ' +
        'back and not one of the states did, which is the map H3 draws. Read in order the three ' +
        'are the whole of how Pakistan’s first-level geography got from many units to four.',
      relatedVariants: ['h1', 'h3'],
    },
  ],
  sources: [
    {
      label:
        'Instruments of Accession of the acceding states, 1947–1948 — Bahawalpur and Khairpur ' +
        '(October 1947), Swat, Dir, Chitral, Hunza and Nagar (November 1947), Las Bela, Kharan and ' +
        'Makran (March 1948) and Kalat (27 March 1948), each retaining internal self-government',
    },
    {
      label:
        'Balochistan States Union, 1952 — Kalat, Las Bela, Kharan and Makran federated into one ' +
        'unit before its merger into West Pakistan',
    },
    {
      label:
        'Establishment of West Pakistan Act, 1955 — the provinces, the states and the tribal areas ' +
        'of the western wing merged into one province with effect from 14 October 1955, which is ' +
        'where this map ends',
    },
    {
      label:
        'Dir, Swat and Chitral (Merger) Regulation, 1969 — the three Malakand states merged into ' +
        'the North-West Frontier Province, the last of the accessions on this map to lose its ' +
        'separate status',
    },
    {
      label:
        'The Province of West Pakistan (Dissolution) Order, 1970 — West Pakistan dissolved and the ' +
        'four provinces restored with effect from 1 July 1970, restoring none of the states',
    },
    {
      label:
        'Gilgit-Baltistan (Empowerment and Self-Governance) Order, 2009 — the Northern Areas, ' +
        'which is what the Gilgit Agency and Baltistan had become, renamed Gilgit-Baltistan',
    },
    {
      label:
        'Constitution (Eighteenth Amendment) Act, 2010 — North-West Frontier Province renamed ' +
        'Khyber Pakhtunkhwa, which is why this map’s name for it differs from today’s',
    },
    {
      label:
        'Gwadar — transferred from Oman to Pakistan on 8 September 1958, after the period this ' +
        'map draws, which is why the footnote states it rather than the boundary showing it',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
        'district set this partition is expressed in',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
    {
      label:
        'data/reference/post-census-district-folds.json — Hub, notified out of Lasbela in 2022, ' +
        'and Wadh and Tump, notified in the Balochistan restructuring of 2026, together with ' +
        'Upper Swat and Central Dir: each created after the census and folded into its 2023 ' +
        'parent under ADR-0001',
    },
  ],
};

/**
 * The Federally Administered Tribal Areas as they stood until 2018 — seven agencies, seven
 * districts today.
 *
 * The six Frontier Regions that were also FATA are not here, and cannot be: each was a strip
 * attached to a settled district, all six were absorbed into their neighbours by the same 2018
 * merger, and none is a district of the 2023 set. Drawing them would mean inventing six boundaries
 * inside districts this map draws whole, which is the omission footnote's job to say instead.
 */
const FATA: Unit = {
  id: 'fata',
  name: 'Federally Administered Tribal Areas',
  alsoKnownAs: ['FATA'],
  kind: 'proposed',
  claims: [
    // The seven agencies, north to south. Each is a district of the 2023 census set, because the
    // 2018 merger converted them into districts of Khyber Pakhtunkhwa before anybody was counted.
    'Bajaur',
    'Mohmand',
    'Khyber',
    'Orakzai',
    'Kurram',
    'North Waziristan',
    'South Waziristan',
  ],
};

/** H3 — the map restored on 1 July 1970, before the FATA merger and before GB was named. */
const H3: Variant = {
  id: 'h3',
  basis: 'historical',
  name: '1970 restoration',
  tagline: 'how much has already changed without a new province',
  rationale:
    'The four provinces as they were restored when One Unit was dissolved on 1 July 1970, with ' +
    'the Federally Administered Tribal Areas and the Northern Areas outside all four. It proposes ' +
    'nothing: every boundary on it was Pakistan’s own within living memory. What it shows is how ' +
    'much of the map has been redrawn already — a whole tier of federally administered territory ' +
    'merged into a province in 2018, and a territory renamed in 2009 — without a single new ' +
    'province having been created.',
  status:
    'Historical, and superseded in two separate steps. The 25th Amendment merged FATA into Khyber ' +
    'Pakhtunkhwa in 2018; the Gilgit-Baltistan (Empowerment and Self-Governance) Order, 2009 gave ' +
    'the Northern Areas the name they carry now. The province of North-West Frontier Province was ' +
    'renamed Khyber Pakhtunkhwa by the 18th Amendment in April 2010.',
  advocacy: {
    kind: 'unadvocated',
    note:
      'Nobody proposes restoring this map. It is drawn as the baseline the current one departed ' +
      'from — the thing every variant in this app is implicitly compared against when someone ' +
      'says that Pakistan’s provinces have not changed since 1970.',
  },
  // Nobody proposes this map, so nobody opposes it as a proposal either. The line is written as
  // what restoring it would undo — which is checkable against the two instruments named in the
  // status — rather than recruiting the parties behind those instruments into an argument they
  // have never been asked to have.
  opposedBy: [
    'the cross-party majority that passed the 25th Amendment in 2018, whose merger of FATA into ' +
      'Khyber Pakhtunkhwa this map would reverse',
    'opinion across parties in Gilgit-Baltistan, for which returning to the name Northern Areas ' +
      'would undo both the 2009 Order and the provisional provincial status announced in 2020',
  ],
  universe: 'drawn',
  // Dated from the Order that restored the four provinces, not from the amendments that later
  // superseded the arrangement: what is drawn is the map as it stood on that day, which is why
  // this variant calls Gilgit-Baltistan the Northern Areas.
  vintage:
    '1 July 1970 — the four provinces as restored when One Unit was dissolved, before the 2009 ' +
    'renaming of the Northern Areas and the 2018 merger of FATA superseded the arrangement',
  composition: {
    kind: 'transcribed',
    from:
      'the Province of West Pakistan (Dissolution) Order, 1970, and the first-level units of ' +
      'Pakistan as they stood from 1 July 1970 until the 2018 FATA merger',
  },
  units: [
    // Renamed, and smaller than Khyber Pakhtunkhwa is today by exactly the seven agencies.
    {
      id: 'nwfp',
      name: 'North-West Frontier Province',
      alsoKnownAs: ['NWFP'],
      kind: 'proposed',
      claims: remainderOf('Khyber Pakhtunkhwa', FATA.claims),
    },
    FATA,
    // The Northern Areas, which is the same ground Gilgit-Baltistan covers and not the same name.
    // `territory` rather than `proposed`, which is what it constitutionally was and is — and what
    // lets it hold those ten districts at all under the current answer to open item 2b.
    {
      id: 'northern-areas',
      name: 'Northern Areas',
      alsoKnownAs: ['Gilgit-Baltistan'],
      kind: 'territory',
      claims: remainderOf('Gilgit-Baltistan'),
    },
    // 1970 Punjab already included Bahawalpur, 1970 Sindh already included Khairpur, and 1970
    // Balochistan is the Quetta and Kalat divisions that were merged to constitute it. All three
    // are today's provinces exactly, so they are carried through rather than restated.
    intactProvince('Punjab'),
    intactProvince('Sindh'),
    intactProvince('Balochistan'),
    intactProvince('Islamabad Capital Territory'),
    intactProvince('Azad Jammu & Kashmir'),
  ],
  footnotes: [
    {
      kind: 'omission',
      text:
        'FATA is drawn as the seven agencies and not as the six Frontier Regions besides them. ' +
        'Each Frontier Region was a strip attached to a settled district — FR Peshawar, FR Kohat, ' +
        'FR Bannu, FR Lakki Marwat, FR Tank and FR Dera Ismail Khan — and the 2018 merger ' +
        'absorbed each into the district it was attached to. None is a district of the 2023 ' +
        'census, so drawing them would mean inventing six boundaries inside districts this map ' +
        'draws whole. They are named here instead.',
    },
    {
      kind: 'note',
      text:
        'The districts-moved figure reads 45, and only seven districts actually change hands. ' +
        'This app decides what carries a first-level unit forward on the unit’s name, so a rename ' +
        'counts as a move: the 28 districts of North-West Frontier Province are Khyber ' +
        'Pakhtunkhwa’s under another name, and the 10 of the Northern Areas are ' +
        'Gilgit-Baltistan’s under another name — 38 districts whose boundaries have not moved at ' +
        'all. The seven that genuinely changed hands are the agencies, which the 25th Amendment ' +
        'moved into Khyber Pakhtunkhwa in 2018. This variant is where that counting rule shows ' +
        'its cost, so the cost is printed beside the figure rather than left to be inferred.',
    },
    {
      kind: 'note',
      text:
        'The Northern Areas and Gilgit-Baltistan are the same ground under two names, so this ' +
        'variant draws the territory exactly where the current map draws it. It is still a ' +
        'territory here and not a province — nothing in this app calls it one, on any variant.',
    },
  ],
  notes: [
    {
      label: 'What was not restored',
      text:
        'The four provinces came back in 1970 and none of the eleven princely states did. H2 draws ' +
        'the map they were part of, and H1 draws the scheme that abolished them — so the ' +
        'difference between this variant and H2 is not the dissolution of One Unit but everything ' +
        'the states lost and never got back.',
      relatedVariants: ['h1', 'h2'],
    },
  ],
  sources: [
    {
      label:
        'The Province of West Pakistan (Dissolution) Order, 1970 — the four provinces restored ' +
        'with effect from 1 July 1970',
    },
    {
      label:
        'Constitution (Twenty-fifth Amendment) Act, 2018 — the Federally Administered Tribal ' +
        'Areas merged into Khyber Pakhtunkhwa, the seven agencies becoming districts and the six ' +
        'Frontier Regions absorbed into adjacent districts',
    },
    {
      label:
        'Gilgit-Baltistan (Empowerment and Self-Governance) Order, 2009 — the Northern Areas ' +
        'renamed Gilgit-Baltistan',
    },
    {
      label:
        'Constitution (Eighteenth Amendment) Act, 2010 — North-West Frontier Province renamed ' +
        'Khyber Pakhtunkhwa',
    },
    // The opposition line says that restoring the name Northern Areas would undo the provisional
    // provincial status "announced in 2020", which is a dated claim and was carried here with
    // nothing in this list reaching the year (#47). The retired A5 stated the sourced form of
    // exactly that fact, and the source is cited here rather than the wording being reinvented.
    {
      label:
        'Announcement of provisional provincial status for Gilgit-Baltistan by Prime Minister ' +
        'Imran Khan, 1 November 2020, and the drafted constitutional amendment prepared for it',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
        'district set this partition is expressed in',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
  ],
};

/**
 * Bahawalpur — the one restoration claim in this app that is a claim to something the claimant
 * actually had.
 *
 * Bahawalpur Division, whole: three districts, unchanged since the census and unchanged since the
 * state was absorbed. It collides with South Punjab (L1) and with the Seraiki claims behind it,
 * and the collision is the point rather than an inconvenience — the two proposals want the same
 * ground on incompatible terms, and D8 is why the app never draws a compromise between them.
 */
const BAHAWALPUR: Unit = {
  id: 'bahawalpur',
  name: 'Bahawalpur',
  kind: 'proposed',
  claims: [
    // Bahawalpur Division, which is the former state's territory.
    'Bahawalpur',
    'Bahawalnagar',
    'Rahim Yar Khan',
  ],
};

/** H4 — Bahawalpur restored. */
const H4: Variant = {
  id: 'h4',
  basis: 'historical',
  name: 'Bahawalpur restored',
  tagline: 'a province asking to be one again',
  rationale:
    'Bahawalpur Division leaves Punjab and becomes a province in its own right again. It is the ' +
    'only claim in this app whose advocates are asking for something they held and lost: ' +
    'Bahawalpur was a province from 1947 until 1955, when One Unit absorbed it, and it was never ' +
    'restored when One Unit was dissolved. The restoration movement dates from 1970 and has been ' +
    'winning seats on it ever since.',
  status:
    'Live and unimplemented. A province in its own right 1947–1955, before absorption into One ' +
    'Unit. The restoration movement dates from 1970: Bahawalpur Muttahida Mahaz won 4 National ' +
    'Assembly and 9 provincial seats on it in the 1970 election, and the restoration has been a ' +
    'fixture of the region’s electoral politics since. PML-N’s stated position is ' +
    'two provinces — Bahawalpur separate, and a South Punjab of Multan and Dera Ghazi Khan.',
  advocacy: {
    kind: 'advocated',
    by: [
      'Bahawalpur Muttahida Mahaz and the wider restoration movement, from 1970',
      'Pakistan Muslim League (N), whose stated position is two southern provinces rather than one',
    ],
  },
  opposedBy: [
    'Seraiki nationalist opinion and the Saraikistan Qaumi Council, for whom Bahawalpur belongs ' +
      'inside one Seraiki province rather than beside it',
    'opponents of dividing Punjab at all, for whom the province’s size is its weight',
  ],
  universe: 'drawn',
  // The one Historical variant whose *boundary* is not historical, and the reason it is dated
  // differently from H1 and H3. Bahawalpur was a province from 1947 to 1955, but what is drawn
  // here is Bahawalpur Division as PBS publishes it today — so the vintage is the district set the
  // line actually comes from. Dating this 1947 would say the app had drawn the 1947 state, which
  // it has not: the princely state is the claim's history, and this is its geometry.
  vintage:
    '2023 census (as on 01-03-2023) — the boundary drawn is Bahawalpur Division as it stands ' +
    'today; the 1947–1955 province is the claim’s history, not its geometry',
  composition: {
    kind: 'transcribed',
    from: 'the former state of Bahawalpur, which is Bahawalpur Division as PBS publishes it today',
  },
  units: [
    BAHAWALPUR,
    intactProvince('Punjab', BAHAWALPUR.claims),
    intactProvince('Sindh'),
    intactProvince('Khyber Pakhtunkhwa'),
    intactProvince('Balochistan'),
    intactProvince('Islamabad Capital Territory'),
    intactProvince('Azad Jammu & Kashmir'),
    intactProvince('Gilgit-Baltistan'),
  ],
  footnotes: [
    {
      kind: 'note',
      text:
        'Bahawalpur Division’s three districts are the former state’s territory, and none of ' +
        'their boundaries has moved since the census, so what is claimed and what is drawn are ' +
        'the same three districts. The state itself extended further into what is now Cholistan ' +
        'desert within Bahawalpur and Rahim Yar Khan; nothing here is smaller or larger than the ' +
        'division.',
    },
  ],
  notes: [
    {
      label: 'Collision with the Seraiki and South Punjab claims',
      text:
        'These three districts are the eastern third of every southern-province reading in this ' +
        'app — the South Punjab Secretariat, the PPP’s wider version of it, and the Saraikistan ' +
        'claim behind both. Bahawalpur’s advocates explicitly reject being folded into a single ' +
        'southern province: the demands want the same ground on terms that cannot both hold, and ' +
        'PML-N’s own position — two provinces rather than one — exists because of it. The app ' +
        'draws one variant at a time and never a compromise between two claims (D8), so the ' +
        'disagreement is stated here rather than averaged on the map.',
      // The other half of the southern readings' notes, wired to all three rather than to
      // whichever was written first: a collision a card knows about in one direction reads as
      // neutral from the other. The validator checks that each id names a variant that exists.
      relatedVariants: ['l1', 'l2', 'l3'],
    },
    {
      label: 'The state this restores',
      text:
        'H2 draws Bahawalpur as the acceding state it was until 1955, alongside the ten other ' +
        'states of that period. This variant is the live claim rather than the record: it argues ' +
        'for the same three districts as a province of Pakistan today, on the strength of what the ' +
        'state was, and it is the only piece of the 1947 map that anybody is still asking for.',
      relatedVariants: ['h2'],
    },
  ],
  sources: [
    {
      label:
        'Instrument of Accession of the State of Bahawalpur, October 1947, under which the state ' +
        'acceded to Pakistan retaining internal self-government',
    },
    {
      label:
        'Establishment of West Pakistan Act, 1955 — Bahawalpur absorbed into the province of West ' +
        'Pakistan with effect from 14 October 1955, and not restored when West Pakistan was ' +
        'dissolved in 1970',
    },
    {
      label:
        'Election Commission of Pakistan — 1970 general election results: Bahawalpur Muttahida ' +
        'Mahaz, 4 National Assembly seats and 9 provincial seats',
    },
    {
      label:
        'Pakistan Muslim League (N) — stated position of two southern provinces: Bahawalpur ' +
        'restored separately, and a South Punjab of the Multan and Dera Ghazi Khan divisions',
    },
    {
      label:
        'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), which ' +
        'is where the three-district composition of Bahawalpur Division is read from',
      url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// The two Language variants nobody published a district list for (#26).
//
// Everything above this line is a literal, because everything above it transcribes a line somebody
// drew. L6 and L7 do not exist as documents: no one publishes a district list for "the
// Pashto-plurality districts of Balochistan", and no one at all proposes assigning every district
// in Pakistan by its plurality mother tongue. So their boundaries are computed at build time by
// `mother-tongue-partition.ts`, from the census this app already ships and the adjacency graph it
// already derives — and the card says on screen that the line was drawn from data rather than
// copied from a proposal, which is what `composition.kind` and the `derived` badge are for.
//
// That is why this module hands back a function rather than a constant. The alternative was to
// bake the derived district lists into a committed reference file and import it here, which would
// have put a second derivation in the repo to keep honest; deriving in the one build that already
// reads the census and the graph leaves exactly one answer to the question.
// ---------------------------------------------------------------------------------------------

/**
 * What a derived variant is drawn from: the census's own dominant tongues, its populations, and
 * the borders #16 cut from the arcs the map is drawn with.
 *
 * `dominant` carries `null` for a district the census counted and named no dominant tongue for,
 * and omits a district the census did not reach at all. The two absences are different and the
 * engine answers them differently (#17).
 */
export interface DerivationContext {
  readonly graph: AdjacencyGraph;
  readonly dominant: ReadonlyMap<string, string | null>;
  readonly populations: ReadonlyMap<string, number>;
  /**
   * District -> the division PBS files it under, which the Administrative rule seats every unit
   * from: a centre is a divisional headquarters, and without the division tier there is nothing to
   * be the headquarters of.
   *
   * The census's own field, read off `statistics.json` rather than re-derived from the roster —
   * the roster carries a province per district and the division alias tables, not a district's
   * division, and a second answer to which division a district is in is a second district set.
   */
  readonly divisions: ReadonlyMap<string, string>;
  /**
   * District centroids from the geometry the map is drawn with, which the Administrative rule's
   * distance limit measures against. Longitude then latitude, as `d3.geoCentroid` returns it.
   *
   * Required rather than optional, though only one variant reads it: an absent centroid map would
   * make the variant undrawable at exactly the moment a caller forgot to supply one, and the
   * failure would arrive as "a variant could not be derived" rather than as a missing argument.
   */
  readonly centroids: ReadonlyMap<string, Centroid>;
  /**
   * District -> its development index, read off `data/bundle/development-index.json`, which D1's
   * rule cuts each province at (#31) and which the Administrative rule gates its centres on.
   *
   * Read from the committed artifact rather than recomputed from the three rates here, for the
   * reason that artifact exists at all: a composite computed twice is two composites, and the one
   * that shades a district would be free to disagree with the one that drew the boundary over it.
   * A district the census does not reach is **absent**, never zero.
   */
  readonly development: ReadonlyMap<string, number>;
}

/**
 * `dominant`, read off a committed `statistics.json`.
 *
 * Shared rather than spelled out at each call site, because the distinction it encodes is the
 * whole of what the engine's first refusal is about and it is one careless `?? 'Others'` away from
 * being lost: a district **absent** from the result is one the census did not reach, and a
 * district **present with `null`** is one it reached and could not name a dominant tongue for. The
 * graph is deliberately *not* built here — the build derives it from the topology it is about to
 * write, and the suite reads the copy that shipped, and those are two different questions.
 */
export function dominantTongues(statistics: {
  readonly districts: Readonly<
    Record<string, { readonly motherTongue?: { readonly dominant?: unknown } }>
  >;
}): ReadonlyMap<string, string | null> {
  return new Map(
    Object.entries(statistics.districts).map(([district, record]) => [
      district,
      typeof record.motherTongue?.dominant === 'string' ? record.motherTongue.dominant : null,
    ]),
  );
}

/**
 * `divisions`, read off the same committed `statistics.json`.
 *
 * A sibling of `dominantTongues` and shared for the same reason: the Administrative rule seats
 * every unit at a divisional headquarters, so the division tier holds up a boundary, and a build
 * that read it one way while the suite read it another would re-derive a different map and pass.
 * A district the census does not file under a division is **absent**, never given an empty string
 * — the engine refuses it by name, and a district quietly filed under `''` would be seated in a
 * pseudo-division shared with every other district the field was missing for.
 */
export function districtDivisions(statistics: {
  readonly districts: Readonly<Record<string, { readonly division?: unknown }>>;
}): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const [district, record] of Object.entries(statistics.districts)) {
    if (typeof record.division === 'string' && record.division !== '') {
      found.set(district, record.division);
    }
  }
  return found;
}

/** Balochistan's 34 census districts, which is the scope L6's rule is applied to. */
const balochistanDistricts = (): readonly string[] => {
  const found = ROSTER.find((province) => province.name === 'Balochistan');
  if (found === undefined) throw new Error('Balochistan is not a province in the roster');
  return found.districts;
};

/**
 * The two districts the census counts and names no dominant mother tongue for.
 *
 * Named here rather than discovered, because L7's card says *Khowar* and *Chitral* in so many
 * words. If the engine ever returned a different set, that copy would be describing a district it
 * no longer means, so the build stops instead — the same signal the fold table gives when upstream
 * moves, rather than a card that quietly starts lying.
 */
const WITHOUT_A_DOMINANT_TONGUE: readonly string[] = ['Lower Chitral', 'Upper Chitral'];

/** L6 — the Pashto-plurality districts of Balochistan, drawn from Table 11 rather than transcribed. */
function pashtunBalochistan(context: DerivationContext): Variant {
  const scope = {
    districts: balochistanDistricts(),
    graph: context.graph,
    dominant: context.dominant,
    populations: context.populations,
  };
  const { partition, problems } = partitionByDominantLanguage(scope);
  if (partition === null) {
    throw new Error(`L6 cannot be drawn from the census:\n  ${problems.join('\n  ')}`);
  }
  // `Pushto` is the census's own spelling of the category, and the category is what the rule sorts
  // by. The card writes Pashto in prose and says which is which.
  const { region, problems: unresolved } = soleRegionOf(partition, 'Pushto');
  if (region === null) {
    throw new Error(`L6 cannot be drawn from the census:\n  ${unresolved.join('\n  ')}`);
  }

  const unit: Unit = {
    id: 'southern-pakhtunkhwa',
    name: 'Southern Pakhtunkhwa',
    // Both names are in use for the same ground, and the app reports what people call things.
    alsoKnownAs: ['Pashtun Balochistan'],
    kind: 'proposed',
    claims: nonEmpty(region.districts, 'the Pashto-plurality districts of Balochistan'),
  };

  return {
    id: 'l6',
    basis: 'language',
    name: 'Pashtun Balochistan separates',
    tagline: 'the one line here with no document behind it',
    rationale:
      'The Pashto-plurality districts of northern Balochistan leave the province. It is the ' +
      'oldest live grievance on this map and the only Language variant whose boundary is not ' +
      'transcribed from anything: no one has published a district list for it, so the line here ' +
      'follows the census — every Balochistan district the 2023 census records as ' +
      'Pashto-plurality, and no others. That is why Mastung, Kalat, Khuzdar, Nushki and Surab are ' +
      'outside it: all four are Brahvi-plurality, and the rule has no way to want them.',
    status:
      'Live since 1970, when the Quetta and Kalat divisions were merged to constitute Balochistan ' +
      'and Khan Abdul Samad Khan Achakzai left the National Awami Party over the Pashtun belt ' +
      'being placed inside a province named for another people. No province has been created and ' +
      'no constitutional amendment to create one has passed.',
    advocacy: {
      kind: 'advocated',
      by: [
        'Pashtunkhwa Milli Awami Party (PkMAP) and the Achakzai political tradition',
        'Pashtun nationalist opinion in northern Balochistan',
      ],
    },
    opposedBy: [
      'Baloch nationalist parties, for whom Balochistan’s territorial integrity is foundational',
    ],
    universe: 'drawn',
    // Not the basis's `census · proxy` and not `documented` either: this boundary was computed
    // here. `census` because the plurality is PBS's own figure, `proxy` because mother tongue is
    // standing in for the identity the claim is actually about, and `derived` because the line is
    // this build's arithmetic and must say so where it is drawn.
    badges: ['census', 'proxy', 'derived'],
    composition: {
      kind: 'derived',
      rule:
        'every Balochistan district whose dominant mother tongue in PBS 2023 Census Table 11 is ' +
        'Pushto, taken as one region because they form a single connected group across shared ' +
        'district borders',
      from: 'PBS 2023 Census Table 11, and the district adjacency graph in data/bundle/adjacency.json',
    },
    units: [
      unit,
      intactProvince('Balochistan', unit.claims),
      intactProvince('Punjab'),
      intactProvince('Khyber Pakhtunkhwa'),
      intactProvince('Sindh'),
      intactProvince('Islamabad Capital Territory'),
      intactProvince('Azad Jammu & Kashmir'),
      intactProvince('Gilgit-Baltistan'),
    ],
    footnotes: [
      {
        kind: 'derived-boundary',
        text:
          'This boundary was drawn from census data, not copied from a proposal. Its advocates ' +
          'have never published a district list, so the rule stands in for one: every ' +
          'Balochistan district the 2023 census records as Pashto-plurality, and nothing else. ' +
          'Change the census and this line moves; nobody whose claim it is chose where it runs. ' +
          'What it produces is the whole of Quetta division and the whole of Zhob division, ' +
          'three of Loralai division’s four districts — Barkhan is Balochi-plurality and stays ' +
          'where it is — and Harnai and Ziarat out of Sibi division’s five.',
      },
      {
        kind: 'note',
        text:
          'Two readings, one territory. Some advocates ask for these districts to be merged into ' +
          'Khyber Pakhtunkhwa; others for them to be constituted as a province of their own, ' +
          'usually called Southern Pakhtunkhwa. The ground leaving Balochistan is identical ' +
          'either way, so this is one variant and not two. What is drawn is the separate-province ' +
          'reading, because the merged one would put this territory inside Khyber Pakhtunkhwa’s ' +
          'own outline and leave a reader unable to see what had moved.',
      },
      {
        kind: 'contested-edge',
        text:
          'Quetta is inside the line, and it is the capital of the province this variant divides. ' +
          'The census records Pushto as the mother tongue of 60.0% of those counted there, so the ' +
          'rule does not have to strain to place it — but a boundary that takes a province’s own ' +
          'capital out of it is the part of this claim that is argued hardest, and a language ' +
          'figure is not what that argument is about.',
      },
    ],
    sources: [
      {
        label:
          'PBS 2023 Census Table 11 — mother tongue by district, the only input to this ' +
          'boundary besides the district borders themselves',
      },
      {
        label:
          'data/bundle/adjacency.json — the district adjacency graph this build derives from the ' +
          'arcs the map is drawn with, used to check that the Pashto-plurality districts form a ' +
          'single connected group',
      },
      {
        label:
          'The merger of the Quetta and Kalat divisions to constitute Balochistan in 1970, and ' +
          'Khan Abdul Samad Khan Achakzai’s resignation from the National Awami Party over it',
      },
      {
        label:
          'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
          'district set this partition is expressed in',
        url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
      },
    ],
    notes: [
      {
        label: 'Relationship to the mother-tongue map',
        text:
          'These twelve districts also come out of the rule applied nationally, as part of the ' +
          'much larger Pashto region that reaches across Khyber Pakhtunkhwa. This variant is the ' +
          'attributed claim — a demand with a movement behind it — and the national one is an ' +
          'arithmetic nobody proposes.',
        relatedVariants: ['l7'],
      },
    ],
  };
}

/** L7 — every district assigned by its plurality mother tongue, which nobody has ever proposed. */
function motherTongueEverywhere(context: DerivationContext): Variant {
  const { partition, problems } = partitionByDominantLanguage({
    districts: CENSUS_DISTRICTS,
    graph: context.graph,
    dominant: context.dominant,
    populations: context.populations,
  });
  if (partition === null) {
    throw new Error(`L7 cannot be drawn from the census:\n  ${problems.join('\n  ')}`);
  }
  // The copy below names Khowar and Chitral. If the census ever left a different district without
  // a dominant tongue, that copy would be describing ground it no longer means.
  const unreached = [...partition.unnamed].sort((a, b) => a.localeCompare(b));
  if (unreached.join('|') !== [...WITHOUT_A_DOMINANT_TONGUE].sort().join('|')) {
    throw new Error(
      `L7 expects exactly ${WITHOUT_A_DOMINANT_TONGUE.join(' and ')} to have no dominant mother ` +
        `tongue in the census, and the census now leaves ${unreached.join(', ') || 'nothing'} ` +
        `without one. The card names Khowar and Chitral, so this is copy to rewrite rather than a ` +
        `list to widen.`,
    );
  }

  const regions: Unit[] = partition.regions.map((region) => ({
    id: slug(region.name),
    name: region.name,
    kind: 'proposed',
    claims: nonEmpty(region.districts, `the districts of the ${region.name} region`),
  }));

  const chitral: Unit = {
    id: 'chitral',
    name: 'Chitral',
    kind: 'proposed',
    claims: nonEmpty(
      WITHOUT_A_DOMINANT_TONGUE,
      'the districts the census names no dominant tongue for',
    ),
    note:
      'The rule does not reach these two districts. Khowar has no column in census Table 11, so ' +
      'neither has a dominant mother tongue to be assigned by — an answer the census could not ' +
      'file, not a question it did not ask.',
  };

  return {
    id: 'l7',
    basis: 'language',
    name: 'Mother tongue applied everywhere',
    tagline: 'the arithmetic nobody is arguing for',
    rationale:
      'Every district in Pakistan assigned to the province of its plurality mother tongue, and ' +
      'each language then cut into the connected groups its districts actually form. It is the ' +
      'only variant in this app that nobody proposes: it is a rule applied to a census, run to ' +
      'the end without being stopped anywhere it produces something awkward. Where its output ' +
      'coincides with a real demand — the Seraiki belt, Hazara, Karachi, the Pashto districts of ' +
      'Balochistan — the claim belongs to the people making it and not to this arithmetic.',
    status:
      'Not a proposal, and not a demarcation that has ever existed. It is what census Table 11 ' +
      'says if it is read as a map, which nobody in Pakistani politics is asking for.',
    // The shape L7 exists for. An empty advocacy list would read as an oversight; this says the
    // absence out loud, and the card renders these words.
    advocacy: {
      kind: 'unadvocated',
      note:
        'Nobody advocates this map. It is a rule applied to the census, drawn so that the ' +
        'attributed claims elsewhere in this app can be read against what the language data ' +
        'alone would say. Several of its regions look like real demands; those demands are ' +
        'argued by people, on grounds this rule cannot see, and are drawn as variants of their ' +
        'own.',
    },
    // Not "nobody, because nobody proposes it". The objection to language as the basis of
    // provincial boundaries is a real position with a long history, and it is the objection this
    // whole map runs into.
    opposedBy: [
      'those who reject mother tongue as a basis for provincial boundaries at all, for whom the ' +
        'argument is administrative rather than ethnic',
      'the Pakistan Peoples Party, the Grand Democratic Alliance and Awami Tehreek alike, and ' +
        'Sindhi nationalist opinion broadly, which rejects any division of Sindh — and this map ' +
        'divides it in four',
      'Baloch nationalist parties, for whom Balochistan’s territorial integrity is foundational ' +
        'and which this map cuts into four as well',
    ],
    universe: 'drawn',
    // The reviewed draft says `census · synthesized`; `proxy` is added deliberately, because the
    // Language basis carries it and this is the variant that leans on it hardest — every boundary
    // here is mother tongue standing in for the identity the argument is actually about. The
    // distinction from L6's `derived` is the real one: `derived` is a line computed from data,
    // and `synthesized` is a whole map assembled by a rule no document stands behind.
    badges: ['census', 'proxy', 'synthesized'],
    composition: {
      kind: 'derived',
      rule:
        'every census district assigned to its dominant mother tongue in PBS 2023 Census Table ' +
        '11, each language then split into the connected groups its districts form across shared ' +
        'district borders, and the two districts the census names no dominant tongue for kept ' +
        'together as themselves',
      from: 'PBS 2023 Census Table 11, and the district adjacency graph in data/bundle/adjacency.json',
    },
    units: nonEmpty(
      [
        ...regions,
        chitral,
        // Outside the rule because they are outside the census: PBS published no mother tongue for
        // any of their twenty districts (D25), so there is nothing here to sort them by.
        intactProvince('Azad Jammu & Kashmir'),
        intactProvince('Gilgit-Baltistan'),
      ],
      'the regions of the mother-tongue map',
    ),
    footnotes: [
      {
        kind: 'derived-boundary',
        text:
          'Every line on this map was computed from census data. No movement drew it, no ' +
          'commission proposed it, and nothing here was adjusted because the result looked odd — ' +
          'which is the point of running the rule to the end. A unit is named for the language ' +
          'that produced it, qualified by its largest district where a language produced more ' +
          'than one; those are descriptions of an output, not names anybody uses for a place.',
      },
      {
        kind: 'note',
        text:
          'Two of the regions are what a mechanical rule looks like when it does not flinch. ' +
          'Keamari comes out as a Pashto region of one district inside Karachi, because Pushto is ' +
          'the largest single mother tongue there at 33.1% — a plurality in a district where no ' +
          'language has a majority. Hyderabad comes out as an Urdu region separate from Karachi’s ' +
          'at 45.9%, because the districts between them are Sindhi-plurality and the two never ' +
          'touch. Both are drawn rather than absorbed into a neighbour: absorbing them would be a ' +
          'second rule with nothing behind it but our sense of how a map should look.',
      },
      {
        kind: 'note',
        text:
          'Balochi is dominant in two places that do not touch — the Makran coast and the ' +
          'Nasirabad plains — with the Brahvi-plurality districts between them, so it produces ' +
          'two regions rather than one province in two pieces. The same rule keeps the Kohistan ' +
          'districts together as Kohiostani, which is the census’s own spelling of the category ' +
          'and is used here unaltered.',
      },
      {
        kind: 'note',
        text:
          'Every census district changes hands in this variant, because not one of them stays ' +
          'inside a unit named after the province it is in today. That is what applying a rule ' +
          'everywhere means, and not an artefact of how the figure is counted.',
      },
    ],
    notes: [
      {
        label: 'Where this coincides with somebody’s claim',
        text:
          'Four of these regions land close to demands that real movements make: the Seraiki ' +
          'belt, Hazara’s Hindko districts, Karachi’s Urdu-plurality districts, and the Pashto ' +
          'districts of Balochistan. Those are attributed variants in this app, argued by named ' +
          'people on grounds a census cannot see. The resemblance runs one way — the movements ' +
          'came first, and this arithmetic takes no credit for their politics.',
        relatedVariants: ['l1', 'l4', 'l5', 'l6'],
      },
    ],
    sources: [
      {
        label:
          'PBS 2023 Census Table 11 — mother tongue by district, summed from the 591 tehsil rows ' +
          'the structured release carries and reconciled against PBS’s printed province figures ' +
          'in all fifteen categories',
      },
      {
        label:
          'data/bundle/adjacency.json — the district adjacency graph this build derives from the ' +
          'arcs the map is drawn with, which is what splits each language into connected regions',
      },
      {
        label: 'docs/research/mother-tongue-table-11.md — how the district figures were obtained',
      },
      {
        label:
          'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
          'district set this partition is expressed in',
        url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// The Administrative basis — one map drawn by a stated rule, and one change of standing.
//
// A6 is the rule engine's (#27), and it is here for the reason L6 and L7 are: nobody publishes a
// district list for "no province above 25 million people, seated at a divisional headquarters",
// and a partition somebody has to take on trust is an editorial opinion wearing a `derived` badge.
// So it states its rule in words a reader can redraw the map from, the arithmetic is re-run by the
// suite against the committed census, the committed borders and the committed composite, and the
// card says the line was computed.
//
// It replaces the four maps this basis used to carry — a ceiling, twelve units, fourteen units and
// a distance to a capital — which drew across provincial boundaries and answered a question about
// administrative load by rearranging the federation. Their ids are retired rather than reused: a
// link to `#/administrative/a1` now resolves to the baseline, because serving a stranger's link a
// different proposal under the same address is the one substitution the deep-link rules refuse.
//
// A5 was retired with them, later and for a different reason: it proposed no boundary at all —
// it promoted Gilgit-Baltistan and Azad Jammu & Kashmir and moved not one district — so it argued
// about constitutional standing on a basis about administrative size. Its id is retired on the
// same terms as theirs, `#/administrative/a5` resolving to the baseline and never to A6.
// ---------------------------------------------------------------------------------------------

/** The one rule this basis draws, stated once so the card and the suite cannot state two. */
export const ADMINISTRATIVE_RULE: PartitionRule = {
  kind: 'within-province-centres',
  ceiling: 25_000_000,
  km: 300,
  developmentFloor: 0.5,
};

/** The rule engine, run over the 136 districts PBS published 2023 results for. */
function drawnByRule(id: string, rule: PartitionRule, context: DerivationContext): GeneratedPartition {
  const { partition, problems } = partitionByRule(rule, {
    // The census districts and no others. The twenty AJK and Gilgit-Baltistan districts carry no
    // PBS figure, so a rule stated in people cannot see them and the engine refuses them by name
    // (D25); they are carried through below as themselves.
    scope: CENSUS_DISTRICTS,
    neighbours: context.graph,
    populations: context.populations,
    // The frame, out of the roster this module already partitions by: the rule draws inside the
    // provinces that exist, so the province of every district is an input to it rather than
    // something the engine works out for itself.
    provinces: new Map(
      ROSTER.flatMap((province) =>
        province.districts.map((district) => [district, province.name] as const),
      ),
    ),
    divisions: context.divisions,
    development: context.development,
    centroids: context.centroids,
  });
  if (partition === null) {
    throw new Error(`${id.toUpperCase()} cannot be drawn from the census:\n  ${problems.join('\n  ')}`);
  }
  return partition;
}

/** The generated units, with the two territories carried through as what they are. */
const withTerritories = (partition: GeneratedPartition): Variant['units'] =>
  nonEmpty(
    [
      ...proposedUnits(partition),
      // Outside the rule because they are outside the census, exactly as in L7. Nothing about
      // their standing changes here; this basis argues about administrative size.
      intactProvince('Azad Jammu & Kashmir'),
      intactProvince('Gilgit-Baltistan'),
    ],
    'the units of an administrative partition',
  );

/** Largest, smallest and the spread between them, in the words a footnote sets them in. */
function spreadOf(partition: GeneratedPartition): string {
  const ranked = [...partition.units].sort((a, b) => b.population - a.population);
  const largest = ranked[0];
  const smallest = ranked[ranked.length - 1];
  if (largest === undefined || smallest === undefined) return '';
  const ratio = (largest.population / smallest.population).toFixed(1);
  return (
    `${partition.units.length} units, the largest seated at ${largest.name} with ` +
    `${group(largest.population)} people and the smallest at ${smallest.name} with ` +
    `${group(smallest.population)} — a spread of ${ratio} to 1`
  );
}

/** How many units the rule drew in each province, in the words the card lists them in. */
function perProvince(partition: GeneratedPartition): string {
  const counted = new Map<string, number>();
  for (const unit of partition.units) counted.set(unit.province, (counted.get(unit.province) ?? 0) + 1);
  return [...counted]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([province, units]) => `${province} ${units}`)
    .join(', ');
}

/**
 * The units the headquarters test could not seat, named rather than counted.
 *
 * A one-district unit is a real output of this rule and not a defect, but it is also the output a
 * reader is most likely to read as one — so the card says which units the fallback drew and why,
 * rather than leaving a province looking as though the engine gave up on it.
 */
function fallbackNote(partition: GeneratedPartition): string {
  const fallen = partition.units.filter((unit) => unit.centreKind === 'fallback');
  if (fallen.length === 0) {
    return (
      'Every unit on this map is seated at a divisional headquarters that clears the development ' +
      'floor. The rule provides for a fallback — the most populous remaining district seeds a ' +
      'unit where nothing left in a province qualifies — and on this census it never fires.'
    );
  }
  return (
    `${fallen.length} of the ${partition.units.length} units are not seated at a qualifying ` +
    `headquarters: ` +
    fallen
      .map(
        (unit) =>
          `${unit.name} (${unit.province}, ${unit.districts.length} ` +
          `district${unit.districts.length === 1 ? '' : 's'})`,
      )
      .join(', ') +
    `. Growing units one at a time strands pockets of a province behind the distance limit, and ` +
    `when nothing left in a province is both a headquarters and above the development floor the ` +
    `most populous remaining district seeds the unit instead. The alternative was to leave those ` +
    `districts in no unit at all, and a partition with a hole in it is not a partition (D6).`
  );
}

/**
 * The divisional headquarters the development floor refuses, named and counted.
 *
 * A gate that turns nothing away is a gate a reader should be told about, and so is one that
 * turns districts away without moving a line. Both are computed here rather than asserted in
 * prose, so the sentence on the card is a description of this census and not of the one the copy
 * was written against.
 */
function belowTheFloor(context: DerivationContext): readonly string[] {
  const seats = divisionalHeadquarters(
    CENSUS_DISTRICTS,
    context.divisions,
    new Map(
      ROSTER.flatMap((province) =>
        province.districts.map((district) => [district, province.name] as const),
      ),
    ),
    context.populations,
  );
  return [...seats]
    .filter((seat) => (context.development.get(seat) ?? 0) < ADMINISTRATIVE_RULE.developmentFloor)
    .sort((a, b) => a.localeCompare(b));
}

/** The divisions no district is named after, which is where the headquarters rule needs its second clause. */
function unnamedDivisions(context: DerivationContext): string {
  const letters = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '');
  const members = new Map<string, string[]>();
  for (const district of CENSUS_DISTRICTS) {
    const division = context.divisions.get(district);
    if (division === undefined) continue;
    const found = members.get(division);
    if (found === undefined) members.set(division, [district]);
    else found.push(district);
  }
  const seated = [...members]
    .filter(([division, districts]) => !districts.some((d) => letters(d) === letters(division)))
    .map(([division, districts]) => {
      const seat = [...districts].sort(
        (a, b) =>
          (context.populations.get(b) ?? 0) - (context.populations.get(a) ?? 0) || a.localeCompare(b),
      )[0];
      return `${division} at ${seat ?? '—'}`;
    })
    .sort((a, b) => a.localeCompare(b));
  return seated.join(', ');
}

/**
 * The things a rule-drawn card has to say, and says the same way.
 *
 * Written apart from the copy because they are properties of the *engine* rather than of the
 * particular numbers it was given, and because every one of them is a cost rather than a feature:
 * a reader should meet them in the same words whatever the rule is next stated at.
 */
function ruleFootnotes(partition: GeneratedPartition, context: DerivationContext): readonly Footnote[] {
  return [
    {
      kind: 'derived-boundary',
      text:
        'This boundary was computed, not copied from a proposal. Nobody publishes a district list ' +
        `for this rule, so the rule stands in for one — ${partition.statement} It produces ` +
        `${spreadOf(partition)}. Change the census and these lines move; nobody whose argument ` +
        'this is chose where they run.',
    },
    {
      kind: 'note',
      text:
        'The distance limit is a straight line and the card does not call it anything else. There ' +
        'is no road network in this app’s data and no routing source at its vintage, so 300 km is ' +
        'measured great-circle from one district centroid to another — shorter than any road ' +
        'between the same two places, which makes the limit the more generous reading of the two, ' +
        'and measured to a centroid, which is not where anybody lives. Calling it travel distance ' +
        'would be a figure with no source under every boundary on this map.',
    },
    {
      kind: 'note',
      text:
        'A centre is the headquarters of a division, and which district that is follows from a ' +
        'rule rather than from a table somebody typed: the district carrying the division’s own ' +
        'name, or, where no district does, the most populous district in the division. PBS ' +
        'publishes the division each district belongs to and publishes no seat column, and a ' +
        'transcribed one would be the only unsourced table in this app holding up a boundary. ' +
        `Four divisions are not named after a district and are seated by the second clause — ` +
        `${unnamedDivisions(context)}. Where that clause fires the seat is the rule’s and not ` +
        'necessarily the gazetted headquarters, which this app has no published source for; the ' +
        'rule is stated so a reader can see exactly which district it chose and disagree with it.',
    },
    {
      kind: 'note',
      text: fallbackNote(partition),
    },
    {
      kind: 'note',
      text:
        'The development floor is this project’s own composite — the unweighted mean of literacy, ' +
        'improved drinking water and households with a flush toilet — and it is the one input to ' +
        'this rule that nobody published, which is why this variant carries a synthesized badge ' +
        'beside its derived one. It is not a poverty measure: the census asks about service ' +
        'access and attainment and does not ask about income, consumption or nutrition. On the ' +
        `2023 census the floor turns away ${belowTheFloor(context).length} of the 31 divisional ` +
        `headquarters — ${belowTheFloor(context).join(', ')}, every one of them in Balochistan — ` +
        'and **moves no boundary at all**: each of those divisions falls inside a unit seated ' +
        'elsewhere before its own seat would have been reached, and removing the floor entirely ' +
        'draws the identical map. That is reported rather than quietly dropped, because a ' +
        'constraint that binds nothing is exactly the kind of thing a rule is believed to have ' +
        'done work it did not do.',
    },
    {
      kind: 'note',
      text:
        'Each unit is named for the district its centre sits in, which is a description of an ' +
        'output and not a name anybody uses for a province. The engine has no source for a name, ' +
        'and inventing one is the editorial voice the rule exists to keep out.',
    },
    {
      kind: 'note',
      text:
        'Every district the census covers changes hands here, because not one of them stays ' +
        'inside a unit carrying the name of the province it is in today — even though no unit ' +
        'leaves the province it was drawn in. That is what the count of districts moved measures ' +
        'and not an artefact of the rule. Islamabad is a unit of its own for the same reason it ' +
        'is a province of its own in the census, and nothing here preserves it as a federal ' +
        'territory. Azad Jammu & Kashmir and Gilgit-Baltistan are outside the rule entirely — the ' +
        'census does not reach their twenty districts, so a rule stated in people cannot see ' +
        'them — and are drawn and named exactly as they are today.',
    },
  ];
}

/** Where a rule-drawn boundary came from, printed on the card as a provenance line. */
const RULE_INPUTS =
  'PBS 2023 Digital Census district populations and the division each district is filed under, ' +
  'the district adjacency graph in data/bundle/adjacency.json, district centroids taken from the ' +
  'geometry in data/bundle/geography.topojson.json, and the development composite in ' +
  'data/bundle/development-index.json';

/** What the rule-drawn card cites, which is one file per input the rule actually reads. */
const RULE_SOURCES: NonEmpty<Source> = [
  {
    label:
      'PBS 2023 Digital Census, district table — the population of every district, which the ' +
      'ceiling is stated in, and the division each district belongs to, which the centre rule ' +
      'is stated in',
  },
  {
    label:
      'data/bundle/adjacency.json — the district adjacency graph this build derives from the arcs ' +
      'the map is drawn with, across which every unit is grown and by which every unit is ' +
      'contiguous by construction',
  },
  {
    label:
      'data/bundle/geography.topojson.json — the district geometry this build draws, from which ' +
      'every centroid the distance limit is measured between is taken',
  },
  {
    label:
      'data/bundle/development-index.json — this project’s own composite of three published PBS ' +
      'rates, which decides which districts may seat a unit',
  },
  {
    label:
      'scripts/lib/partitioner.ts — the engine that draws this boundary, whose rule statement is ' +
      'quoted on this card in full',
  },
  {
    label:
      'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
      'district set this partition is expressed in and the division each is filed under',
    url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
  },
];

/** The opposition a rule-drawn map runs into. */
const RULE_OPPOSITION: Variant['opposedBy'] = [
  'those for whom a province is a people and not a population — the Seraiki, Hazara, Karachi and ' +
    'Pashtun Balochistan claims elsewhere in this app are all arguments a rule stated in ' +
    'district populations cannot see, and every one of them is cut across here',
  'Sindhi nationalist opinion broadly, which rejects any division of Sindh, and Baloch ' +
    'nationalist parties, for whom Balochistan’s territorial integrity is foundational',
  'opponents of dividing Punjab at all, for whom the province’s size is its weight',
  'those who argue that new provinces are an administrative expense before they are anything ' +
    'else — a secretariat, a high court bench, a public service commission and a share of the ' +
    'divisible pool for each',
  'those for whom the provincial frame is the flaw rather than the safeguard: a rule that may ' +
    'not cross a provincial boundary cannot answer the case of a district better served from a ' +
    'city in the next province, which is a real argument this map is built not to make',
];

/**
 * A6 — the rule drawn inside the provinces that already exist.
 *
 * The one Administrative map this app computes. Every unit lies wholly inside one of the four
 * provinces or the capital territory, is grown outward from a divisional headquarters the census
 * finds well enough served, and is closed by whichever of the two limits binds first — 25 million
 * people, or 300 km from its centre.
 */
function withinProvinces(context: DerivationContext): Variant {
  const partition = drawnByRule('a6', ADMINISTRATIVE_RULE, context);
  const provinces = new Set(partition.units.map((unit) => unit.province)).size;
  return {
    id: 'a6',
    basis: 'administrative',
    name: 'Provinces subdivided at their own headquarters',
    tagline: 'a ceiling, a distance, and no unit that crosses a provincial line',
    rationale:
      'Each existing province is partitioned on its own, and no new unit crosses a provincial ' +
      `boundary — ${provinces} provinces come to ${partition.units.length} units. A unit is ` +
      'grown outward from a divisional headquarters the census finds well enough served, taking ' +
      'the nearest district on its edge each time, and it stops when it would either pass 25 ' +
      'million people or reach further than 300 km from its own centre. Both limits are the ' +
      'administrative argument stated as arithmetic: Punjab alone is 127,688,922 people governed ' +
      'from Lahore, more than all but a dozen countries on earth, and Balochistan is 14,894,402 ' +
      'people spread across the largest province in the country, where population says nothing ' +
      'and distance says everything. The number of units is a finding and not an input.',
    status:
      'Not a proposal, and not a demarcation that has ever existed. The argument that Pakistan’s ' +
      'provinces are too large to administer is made widely and across parties, and the argument ' +
      'that new provinces should be carved inside the existing ones rather than across them is ' +
      'the form nearly every real proposal in this app takes; no party has published a boundary ' +
      'for it, and no constitutional amendment creating any province has passed since 1970.',
    advocacy: {
      kind: 'unadvocated',
      note:
        'Nobody advocates this map. The case behind it is real and is argued across Pakistani ' +
        'politics — that four provinces and a capital territory are too few administrative units ' +
        'for 241,499,431 people, and that a province is administered from a city its districts ' +
        'can reach — but that case is made about the size of a province and not about where any ' +
        'particular line should run. This partition is the arithmetic that follows from stating ' +
        'it, drawn so the attributed claims elsewhere in this app can be read against what a ' +
        'stated rule would say.',
    },
    opposedBy: RULE_OPPOSITION,
    universe: 'drawn',
    // The basis shades `census · derived`; this variant adds `synthesized`, because its centres
    // are gated on this project's own composite and a reader re-deriving the boundary needs that
    // figure. The badge says an input is ours even though, on this census, the gate moves no line
    // — which the footnote states rather than letting the badge imply more than it did.
    badges: ['census', 'derived', 'synthesized'],
    composition: {
      kind: 'derived',
      rule: partition.statement,
      from: RULE_INPUTS,
    },
    units: withTerritories(partition),
    footnotes: [
      ...ruleFootnotes(partition, context),
      {
        kind: 'note',
        text:
          `The rule draws ${perProvince(partition)}. Those are counts and not quotas: nothing in ` +
          'the rule says how many units a province should have, and the number each gets is what ' +
          'its population and its geography cost under the two limits. Balochistan is the case ' +
          'the distance limit exists for — its units are closed by the 300 km limit long before ' +
          'the ceiling comes near — and Punjab is the case the ceiling exists for.',
      },
    ],
    notes: [
      {
        label: 'The same districts, cut a different way',
        text:
          'The Development basis groups the districts the census serves alike, without regard to ' +
          'which province they are in — the same 136 districts, cut by a question about service ' +
          'rather than about size, and the one place this app’s own composite draws a line ' +
          'instead of only gating one.',
        relatedVariants: ['d1'],
      },
    ],
    sources: [
      ...RULE_SOURCES,
      {
        label:
          'PBS Census-2023 Table 1 (national) — 241,499,431 people, and the province totals this ' +
          'card quotes for Punjab and Balochistan',
      },
    ],
  };
}

/**
 * D1 — the districts the census serves alike, grouped where they touch (#31).
 *
 * The one variant on the Development basis, and the only boundary in the app drawn from what the
 * census says about **service access** rather than from language, from population or from a
 * document. Nobody publishes a district list for it, so the rule stands in for one, exactly as it
 * does for L6, L7 and A1 to A4: `development-partition.ts` computes the grouping and the card
 * prints the rule that produced it.
 *
 * Two things about it are worth reading before the copy below.
 *
 * **The scores are the committed composite, not a recomputation.** `development-index.json` is
 * where the formula is applied, once, and both the shading and this boundary read it — because a
 * composite computed twice is two composites, and the map would be free to shade a district one
 * way while the line drawn over it had been decided on another number. The **bands** are the
 * shading's own four at their fixed cuts, applied through `bandOf` — the same function that wrote
 * the artifact — so a unit is exactly a run of one colour and a reader can see the boundary before
 * it is drawn.
 *
 * **The unit count is a finding and not a setting.** Nothing here is optimised: the rule groups,
 * and what it makes of the 2023 census is what it makes. Eleven of the units are a single district,
 * and the population spread between the largest and the smallest is the widest in the app by a long
 * way — both are reported on the card rather than smoothed away with a merging rule nobody
 * published.
 */
function developmentGradient(context: DerivationContext): Variant {
  // The four provinces. Islamabad Capital Territory is one district and is carried through below,
  // as it is today, rather than drawn as a unit of its own named for its one district. AJK and
  // Gilgit-Baltistan are outside the census entirely (D25), so the rule cannot see them at all.
  const provinces = ROSTER.filter(
    (entry) => entry.kind !== 'territory' && entry.districts.length > 1,
  ).map((entry) => ({ province: entry.name, districts: entry.districts }));
  const capital = ROSTER.find(
    (entry) => entry.kind !== 'territory' && entry.districts.length === 1,
  );

  // The band a district is in, from the score the artifact carries — one cut applied by the one
  // function that defines it, so the line between two units is the line between two colours.
  const districtBands = new Map(
    [...context.development].map(([district, score]) => [district, bandOf(score).id] as const),
  );

  const { partition, problems } = groupByDevelopmentBand({
    provinces,
    graph: context.graph,
    bands: INDEX_BANDS,
    districtBands,
    scores: context.development,
    populations: context.populations,
  });
  if (partition === null) {
    throw new Error(`D1 cannot be drawn from the census:\n  ${problems.join('\n  ')}`);
  }
  if (capital === undefined) {
    throw new Error('D1 expects a single-district capital territory to carry through, and the roster has none');
  }

  const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

  /**
   * One group of same-band, touching districts, as a unit. Named for its most populous district —
   * through `unitName`, so a unit built around one of Karachi's four quarters is called Karachi
   * rather than after the quarter, exactly as A6's is. The district it was named for is still said
   * in the note, since that is the provenance and the name is only the label over the shape.
   */
  const names = unitNames(partition.units.map((unit) => unit.principal));
  const groups = partition.units.map(
    (unit, index): Unit => ({
      id: slug(names[index] as string),
      name: names[index] as string,
      kind: 'proposed',
      claims: nonEmpty(unit.districts, `the ${unit.band.label} group around ${unit.principal}`),
      note:
        `${unit.districts.length} district${unit.districts.length === 1 ? '' : 's'} of ` +
        `${unit.province} in the ${unit.band.label} band, touching one another — averaging ` +
        `${percent(unit.mean)} on the development index, and ${group(unit.population)} people. ` +
        `Named for ${unit.principal}, the most populous district in it` +
        (names[index] === unit.principal
          ? '.'
          : `, and set as ${names[index]} — the city those districts are quarters of.`),
    }),
  );

  /** How many units each province comes out in, which is the whole shape of the finding. */
  const perProvince = provinces
    .map((scope) => {
      const count = partition.units.filter((unit) => unit.province === scope.province).length;
      return `${scope.province} ${count}`;
    })
    .join(', ');

  /** The units of one district — the fragments the rule makes and does not absorb. */
  const singletons = partition.units
    .filter((unit) => unit.districts.length === 1)
    .map((unit) => unit.principal)
    .sort((a, b) => a.localeCompare(b));

  const bySize = [...partition.units].sort((a, b) => b.population - a.population);
  const largest = bySize[0];
  const smallest = bySize[bySize.length - 1];

  /**
   * The convergence with the Seraiki claim, computed rather than asserted.
   *
   * This is the finding #31 is written around, and it is the one sentence on the card most likely
   * to become false without anybody noticing — the census moves, the bands move, and a claim
   * about which districts two independent lines agree on goes on sitting there. So it is derived
   * from L1's own district list and from the partition, in the same run. The comparison is against
   * the **best-served group of Punjab**, since what the Seraiki claim is being read against is the
   * ground this rule leaves *outside* it.
   */
  const southPunjab = new Set(
    SOUTH_PUNJAB.claims.flatMap((claim) => {
      const found = resolveClaimedDistrict(claim);
      return found === null ? [] : [found.district];
    }),
  );
  const punjabUnits = partition.units.filter((unit) => unit.province === 'Punjab');
  const servedPunjab = [...punjabUnits].sort((a, b) => b.population - a.population)[0];
  const lowerPunjab = new Set(
    punjabUnits.flatMap((unit) => (unit === servedPunjab ? [] : unit.districts)),
  );
  const shared = [...southPunjab].filter((district) => lowerPunjab.has(district)).sort();
  const claimedNotFound = [...southPunjab].filter((district) => !lowerPunjab.has(district)).sort();
  const foundNotClaimed = [...lowerPunjab].filter((district) => !southPunjab.has(district)).sort();

  return {
    id: 'd1',
    basis: 'development',
    name: 'The districts the census serves alike, grouped where they touch',
    tagline: 'the map service access draws, with nothing else in it',
    // The basis shades `census · synthesized`; this variant's boundary adds `derived`, because the
    // composite is a figure this project defines and the *line* is arithmetic this build did over
    // it. Both claims are on the card, and the card says why the two disagree with the basis.
    badges: ['census', 'synthesized', 'derived'],
    rationale:
      'Districts that fall in the same development band and touch one another inside the same ' +
      'province are drawn as one unit. The index behind the band is this project’s own: the ' +
      'unweighted ' +
      'mean of literacy among people aged 10 and above, the share of households with an improved ' +
      'drinking-water source, and the share with a flush toilet. No language, no history and no ' +
      'population figure goes into the line — the only question asked of a district is how many ' +
      'of its people can read and how many of its households have water and a toilet.',
    status:
      'Not a proposal and not a demarcation that has ever existed. The argument that Pakistan’s ' +
      'provinces contain regions too differently served to be administered as one unit is made ' +
      'widely, and the southern-Punjab case is made in exactly those terms; nobody has published ' +
      'a boundary drawn from service-access data, and no constitutional amendment creating any ' +
      'province has passed since the four were restored.',
    advocacy: {
      kind: 'unadvocated',
      note:
        'Nobody advocates this map. The case behind it is argued — that a province holding both ' +
        'the best-served and the worst-served districts in the country is administering two ' +
        'different places — but it is argued about a region, never as a rule over all four ' +
        'provinces at once, and this partition is the arithmetic that follows from stating it as ' +
        'one. It is drawn so that the attributed claims elsewhere in this app can be read against ' +
        'what service access alone would say.',
    },
    opposedBy: [
      'those for whom a province is a people and not a service-delivery statistic — the Seraiki, ' +
        'Hazara, Karachi and Pashtun Balochistan claims elsewhere in this app are all arguments ' +
        'this rule cannot see, and it cuts across every one of them',
      'Sindhi nationalist opinion broadly, which rejects any division of Sindh, and Baloch ' +
        'nationalist parties, for whom Balochistan’s territorial integrity is foundational',
      'those who argue that a development gap is a reason to spend in a region rather than to ' +
        'make a province of it, and that drawing the boundary around it entrenches the gap ' +
        'instead of closing it',
      'those who argue that new provinces are an administrative expense before they are anything ' +
        'else — a secretariat, a high court bench, a public service commission and a share of the ' +
        'divisible pool for each',
    ],
    universe: 'drawn',
    composition: {
      kind: 'derived',
      rule: BAND_RULE,
      from:
        'data/bundle/development-index.json — the composite this build computes from PBS 2023 ' +
        'Census Tables 12, 23 and 24 — and the district adjacency graph in ' +
        'data/bundle/adjacency.json',
    },
    units: nonEmpty(
      [
        ...groups,
        // The capital, whole, as it is today: it is one district, so a unit drawn out of it would
        // be the same ground under a different name. Said on the card rather than left as a
        // thirty-fourth thing on the map nobody explained.
        intactProvince(capital.name),
        intactProvince('Azad Jammu & Kashmir'),
        intactProvince('Gilgit-Baltistan'),
      ],
      'the units of a development-band partition',
    ),
    footnotes: [
      {
        kind: 'derived-boundary',
        text:
          'This boundary was computed, not copied from a proposal. Nobody publishes a district ' +
          `list for this rule, so the rule stands in for one — ${BAND_RULE} What it makes of the ` +
          `2023 census is ${partition.units.length} units across the provinces it groups ` +
          `(${perProvince}), which is a finding and not a setting: nothing here is optimised and ` +
          'no number of provinces was aimed at. Change the census and these lines move; nobody ' +
          'whose argument this is chose where they run.',
      },
      {
        kind: 'note',
        text:
          `The index is not a poverty measure and nothing here calls it one. ${INDEX_FORMULA} ` +
          NOT_A_POVERTY_MEASURE +
          ' Its third component is named for the column PBS actually publishes: the census ' +
          'classifies drinking-water sources as improved or not, but for toilets prints only ' +
          'flush, non-flush and none — a non-flush toilet may be improved or not and the census ' +
          'does not say which — so what is averaged in is the flush-toilet share, and there is no ' +
          'improved-sanitation figure in this app because there is none to have.',
      },
      {
        kind: 'note',
        text:
          'Each unit is named for its most populous district, which is a description of an output ' +
          'and not a name anybody uses for a province. The engine has no source for a name, and ' +
          'inventing one — "lower Punjab", "the served belt" — would be both the editorial voice ' +
          'the rule exists to keep out and a judgement about the people living there. Two units ' +
          'of one province can sit in the same band without touching, and they are told apart by ' +
          'their districts and their scores, which are on each unit above.',
      },
      {
        kind: 'note',
        text:
          `A district whose neighbours are all served differently from it is a unit on its own, ` +
          `and ${singletons.length} of the ${partition.units.length} are: ` +
          `${singletons.join(', ')}. They are drawn rather than absorbed into a neighbour, ` +
          'because absorbing them would take a second rule — a size below which a group is too ' +
          'small to be a province — and nobody publishes that number either. The same absence of ' +
          'tuning is why the units are the size they are: the rule is stated in service access ' +
          `and says nothing whatever about population, so ${largest?.principal ?? ''} holds ` +
          `${group(largest?.population ?? 0)} people and ${smallest?.principal ?? ''} holds ` +
          `${group(smallest?.population ?? 0)}. The scorecard prints that spread; it is the ` +
          'widest in this app, and it is what a map drawn from one question and no others costs.',
      },
      {
        kind: 'note',
        text:
          `${capital.name} is one district, so a unit drawn out of it would be the same ground ` +
          'under a different name; it is carried through exactly as it is, and is the only ' +
          'first-level entity inside the census this rule leaves alone. Azad Jammu & Kashmir and Gilgit-Baltistan are outside it entirely: PBS ' +
          'published no literacy, water or toilet figure for any of their twenty districts, so ' +
          'they have no index, and a district with no figure is not a district scoring zero. ' +
          'They are drawn and named exactly as they are today.',
      },
    ],
    notes: [
      {
        label: 'What it agrees with, and what it does not',
        text:
          'In Punjab this rule lands close to the Seraiki claim without being told anything about ' +
          `language: ${shared.length} of South Punjab’s ${southPunjab.size} drawn districts fall ` +
          'outside the best-served group of the province' +
          (claimedNotFound.length === 0
            ? ''
            : `, ${claimedNotFound.join(' and ')} being the exception` +
              `${claimedNotFound.length === 1 ? '' : 's'}`) +
          (foundNotClaimed.length === 0
            ? ''
            : `, and the ground outside it takes in ${foundNotClaimed.join(', ')} besides`) +
          '. Elsewhere the agreement stops, and it stops in a way the old cut could not show: ' +
          'this rule does not divide a province in two, so Sindh and Balochistan come out in ' +
          'several pieces each and Khyber Pakhtunkhwa in more than any of them — the census ' +
          'serves its valleys, its settled plain and its western districts too differently for ' +
          'one line to be the story. The rule is reported as it ran rather than tuned until it ' +
          'agreed, because a rule adjusted to match the claims it is meant to be independent of ' +
          'has nothing left to say about them.',
        relatedVariants: ['l1', 'l2', 'l3'],
      },
      {
        label: 'The other rules this app draws',
        text:
          'An Administrative variant partitions the same 136 districts from population and ' +
          'distance inside the provinces that already exist, and two Language ones from the ' +
          'census’s dominant mother tongue. They are different maps because they are different ' +
          'questions, and the app draws one at a time.',
        relatedVariants: ['a6', 'l7'],
      },
    ],
    sources: [
      {
        label:
          'PBS Census-2023 Table 12 — literacy rate, enrolment and out-of-school population by ' +
          'sex and rural/urban, the first of the three rates this index averages',
        url: 'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_12_national.pdf',
      },
      {
        label:
          'PBS Census-2023 Table 23 — housing facilities by source of drinking water by region, ' +
          'and the improved/not-improved classification is the census’s own published column',
        url: 'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_23_national.pdf',
      },
      {
        label:
          'PBS Census-2023 Table 24 — facilities of toilet and washroom used by households. It ' +
          'prints flush, non-flush and none, and no improved-sanitation column, which is why the ' +
          'third component is the flush-toilet share and is named as such',
        url: 'https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_24_national.pdf',
      },
      {
        label:
          'data/bundle/development-index.json — the composite itself, one score per district, ' +
          'with the formula and the band cuts recorded beside it. Badged synthesized: no ' +
          'published source states this figure',
      },
      {
        label:
          'data/bundle/adjacency.json — the district adjacency graph this build derives from the ' +
          'arcs the map is drawn with, across which each half is grown and by which both halves ' +
          'of every province are whole',
      },
      {
        label:
          'scripts/lib/development-partition.ts — the engine that draws these boundaries, whose ' +
          'rule statement is quoted on this card in full',
      },
      {
        label:
          'docs/research/development-indicators.md — what reconciled against PBS’s printed ' +
          'province figures, the 6,374 households PBS’s two releases of Table 23 disagree by, and ' +
          'why there is no improved-sanitation figure to join',
      },
      {
        label:
          'PBS — List of Administrative Districts by Division & Province (as on 01-03-2023), the ' +
          'district set this partition is expressed in',
        url: 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf',
      },
    ],
  };
}

/**
 * Every variant, in the order the selectors offer them in.
 *
 * Grouped by basis, because a reader entering a basis lands on its first variant (D13), so the
 * first of each group is a deliberate choice and not an accident of when it was written. Within
 * the Language group the transcribed claims come first and the two derived ones last: L6 and L7
 * are answers to "what does the data alone say", which reads as a question only once the claims
 * it is being asked about are on the table.
 */
export function variantsFrom(context: DerivationContext): readonly Variant[] {
  return [
    L1,
    L2,
    L3,
    L4,
    L5,
    pashtunBalochistan(context),
    motherTongueEverywhere(context),
    // The Administrative group. One rule, one map: the basis carried a second variant — a
    // constitutional regularisation promoting Gilgit-Baltistan and Azad Jammu & Kashmir, moving no
    // district — and it was retired with the four rule-drawn maps before it. Its id is retired
    // with theirs and never reused, on the deep-link rule below.
    withinProvinces(context),
    // H1 stays first, and the ordering is otherwise chronological. A reader entering the Historical
    // basis lands on its first variant (D13), and that landing is One Unit rather than the states
    // of 1947 — the most dramatic map on the basis, and the one the other three are legible
    // against. Reordering the group to put H2 first would change which map the basis opens on,
    // which is a product decision and not a consequence of adding a variant.
    H1,
    H2,
    H3,
    H4,
    // The Development basis, and its one variant (#31). Last, because that is where the basis
    // sits in the selectors and in CLAUDE.md's own table; it is the only basis whose shading is a
    // figure this project defines rather than one somebody published, and the card leads with it.
    developmentGradient(context),
  ];
}
