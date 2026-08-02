/**
 * The variants themselves — the product.
 *
 * This module is the source of truth for scenario content. `SCENARIOS-DRAFT.md` is the review
 * copy and is deleted once every variant has been migrated here (#36, CLAUDE.md open item 4);
 * keeping both would be two sources that drift within a week. Everything in a variant is
 * rendered card content, not documentation: rationale, status, advocacy, opposition, footnotes
 * and per-unit district lists all appear on screen.
 *
 * Eight variants are expressed so far — L1, L2, L3, L4 and L5 on the Language basis, H1, H3 and H4
 * on the Historical one. The remaining nine arrive under #26–#31, each as a diff against this file
 * that the partition validator has to accept before it can be committed.
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

import { intactProvince, remainderOf, type Unit, type Variant } from './scenarios.ts';

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

/**
 * Order is the order the selectors offer them in, grouped by basis: a reader entering a basis
 * lands on its first variant (D13), so the first of each group is a deliberate choice and not an
 * accident of when it was written.
 */
export const VARIANTS: readonly Variant[] = [L1, L2, L3, L4, L5, H1, H3, H4];
