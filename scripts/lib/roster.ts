/**
 * The 2023 census district roster — the authority on *which districts exist*.
 *
 * Source: PBS, "List of Administrative Districts by Division & Province (as on 01-03-2023)"
 * https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf
 *
 * This is the vintage the app draws (ADR-0001). Districts created after 1 March 2023 are not
 * in this list; they are folded into their parent by `POST_CENSUS_FOLDS` and never rendered.
 *
 * Names are reproduced as PBS spells them, including PBS's own irregularities ("ABBOTABAD"
 * with one T, "KACHHI (BOLAN)"). Matching against OSM goes through `normalizeName` and
 * `NAME_ALIASES` — never raw string equality, because PBS's own documents disagree with each
 * other on spelling and OSM's primary `name` tag is Urdu.
 */

import postCensusFolds from '../../data/reference/post-census-district-folds.json' with {
  type: 'json',
};

export type ProvinceCode = 'PB' | 'KP' | 'SD' | 'BA' | 'ICT' | 'AJK' | 'GB';

export interface Province {
  readonly code: ProvinceCode;
  readonly name: string;
  /** Constitutional status. Territories are drawn but never shaded — see D25. */
  readonly kind: 'province' | 'territory' | 'capital';
  readonly districts: readonly string[];
}

export const ROSTER: readonly Province[] = [
  {
    code: 'KP',
    name: 'Khyber Pakhtunkhwa',
    kind: 'province',
    districts: [
      'Upper Chitral', 'Lower Chitral', 'Upper Dir', 'Lower Dir', 'Swat', 'Shangla', 'Buner',
      'Malakand', 'Bajaur', 'Upper Kohistan', 'Lower Kohistan', 'Kolai Pallas Kohistan',
      'Mansehra', 'Torghar', 'Batagram', 'Abbotabad', 'Haripur', 'Mardan', 'Swabi', 'Charsadda',
      'Peshawar', 'Nowshera', 'Khyber', 'Mohmand', 'Kohat', 'Hangu', 'Karak', 'Orakzai',
      'Kurram', 'Bannu', 'Lakki Marwat', 'North Waziristan', 'Dera Ismail Khan', 'Tank',
      'South Waziristan',
    ],
  },
  {
    code: 'PB',
    name: 'Punjab',
    kind: 'province',
    districts: [
      'Attock', 'Rawalpindi', 'Jhelum', 'Chakwal', 'Sargodha', 'Bhakkar', 'Khushab', 'Mianwali',
      'Faisalabad', 'Jhang', 'Chiniot', 'Toba Tek Singh', 'Gujranwala', 'Hafizabad', 'Gujrat',
      'Mandi Bahauddin', 'Sialkot', 'Narowal', 'Lahore', 'Kasur', 'Sheikhupura', 'Nankana Sahib',
      'Sahiwal', 'Okara', 'Pakpattan', 'Vehari', 'Multan', 'Lodhran', 'Khanewal',
      'Dera Ghazi Khan', 'Rajanpur', 'Layyah', 'Muzaffargarh', 'Bahawalpur', 'Bahawalnagar',
      'Rahim Yar Khan',
    ],
  },
  {
    code: 'SD',
    name: 'Sindh',
    kind: 'province',
    districts: [
      'Jacobabad', 'Kashmore', 'Shikarpur', 'Larkana', 'Kambar Shahdadkot', 'Sukkur', 'Ghotki',
      'Khairpur', 'Naushahro Feroze', 'Shaheed Benazirabad', 'Sanghar', 'Dadu', 'Jamshoro',
      'Hyderabad', 'Matiari', 'Tando Allah Yar', 'Tando Mohammad Khan', 'Badin', 'Thatta',
      'Sujawal', 'Mirpur Khas', 'Umerkot', 'Tharparkar', 'Karachi East', 'Karachi West',
      'Karachi South', 'Karachi Central', 'Malir', 'Korangi', 'Keamari',
    ],
  },
  {
    code: 'BA',
    name: 'Balochistan',
    kind: 'province',
    districts: [
      'Quetta', 'Pishin', 'Killa Abdullah', 'Chaman', 'Chagai', 'Nushki', 'Kharan', 'Washuk',
      'Loralai', 'Duki', 'Barkhan', 'Musa Khel', 'Killa Saifullah', 'Zhob', 'Sherani', 'Sibi',
      'Harnai', 'Ziarat', 'Kohlu', 'Dera Bugti', 'Jaffarabad', 'Nasirabad', 'Kachhi (Bolan)',
      'Jhal Magsi', 'Sohbatpur', 'Kalat', 'Surab', 'Mastung', 'Khuzdar', 'Awaran', 'Lasbela',
      'Kech', 'Gwadar', 'Panjgur',
    ],
  },
  {
    code: 'ICT',
    name: 'Islamabad Capital Territory',
    kind: 'capital',
    districts: ['Islamabad'],
  },
  {
    code: 'AJK',
    name: 'Azad Jammu & Kashmir',
    kind: 'territory',
    // Names as the AJ&K Bureau of Statistics prints them — the territory's own government is
    // the authority on what its districts are called, and OSM disagrees with it on two of the
    // ten. Official name for display, OSM name for the join: `docs/research/ajk-district-set.md`.
    districts: [
      'Jhelum Valley', 'Muzaffarabad', 'Neelum', 'Bagh', 'Haveli', 'Sudhnoti', 'Poonch',
      'Bhimber', 'Mirpur', 'Kotli',
    ],
  },
  {
    code: 'GB',
    name: 'Gilgit-Baltistan',
    kind: 'territory',
    districts: [
      'Gilgit', 'Hunza', 'Nagar', 'Ghizer', 'Skardu', 'Kharmaung', 'Shigar', 'Ghanche',
      'Astore', 'Diamir',
    ],
  },
];

/**
 * ICT has no division tier in the census. A pseudo-division is injected so the
 * province -> division -> district hierarchy is total and the map has no hole (#3).
 */
export const ICT_PSEUDO_DIVISION = 'Islamabad';

/**
 * OSM division spelling -> PBS spelling. Kept separate from `NAME_ALIASES` because the two tiers
 * are different name spaces that happen to collide: Balochistan has both a Kalat *district* and
 * a Kalat *division*, and OSM spells both "Qalat". Merging the tables would work today only by
 * coincidence — the moment a division and a district sharing a name need different corrections,
 * one table would have to pick a winner and silently rename the other tier.
 */
export const DIVISION_ALIASES: Readonly<Record<string, string>> = {
  qalat: 'Kalat',
  makran: 'Mekran',
  makuran: 'Mekran',
};

/** Fold OSM's post-census divisions into their 2023 parent. */
export const POST_CENSUS_DIVISION_FOLDS: Readonly<Record<string, string>> = {
  // Punjab, created after 01-03-2023
  Gujrat: 'Gujranwala',
  Mianwali: 'Sargodha',
  // Sindh, created after 01-03-2023
  Banbhore: 'Hyderabad',
};

/**
 * Districts that did not exist at the census date, and the 2023 district each folds into.
 *
 * The table itself lives in `data/reference/post-census-district-folds.json`, not here. It is
 * the vintage rule (ADR-0001) expressed as data: it changes whenever Pakistan reorganises, it
 * is reviewed as a diff with a date on it, and both pipelines that need it — the geometry
 * dissolve and the census join — read the same file rather than each carrying a copy.
 *
 * Each entry names exactly one parent, so the dissolve recovers the 2023 boundary exactly
 * rather than approximating it. Two children sharing a parent is normal: South Waziristan was
 * split into Upper and Lower after the census, so its 2023 geometry is the union of both.
 */
export const POST_CENSUS_DISTRICT_FOLDS: Readonly<Record<string, string>> = Object.freeze(
  indexFolds(postCensusFolds.folds),
);

/**
 * The fold table's rows, with their per-entry provenance intact, for the statistics artifact.
 * `POST_CENSUS_DISTRICT_FOLDS` is the same data indexed for lookup; this is the reviewable list.
 */
export const POST_CENSUS_FOLD_TABLE: readonly (typeof postCensusFolds.folds)[number][] =
  postCensusFolds.folds;

/**
 * Index the fold rows by child district, refusing a duplicate.
 *
 * `Object.fromEntries` would let a second row for the same district silently win, which is how a
 * hand-maintained table acquires two answers to "where do these people go" and reports only one.
 * The file is edited by hand precisely because it changes when Pakistan reorganises, so the
 * failure mode is a real one: the same district pasted twice with different parents.
 */
export function indexFolds(
  folds: readonly { district: string; into: string }[],
): Record<string, string> {
  const index: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const fold of folds) {
    // Normalized, because two spellings of one district are the same duplicate wearing a hat.
    const key = normalizeName(fold.district);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(
        `post-census-district-folds.json lists ${fold.district} twice — once folding into ` +
          `${index[previous]}, once into ${fold.into}. One district, one parent.`,
      );
    }
    seen.set(key, fold.district);
    index[fold.district] = fold.into;
  }
  return index;
}

/**
 * Relations to drop outright, with the reason. Being explicit here is the point: an unmatched
 * relation must be *classified*, never silently discarded, or the district set drifts without
 * anyone noticing.
 */
export const DROPPED_RELATIONS: Readonly<Record<number, string>> = {
  // Abolished Nov 2022; OSM still carries it. Its area is inside Pishin.
  // docs/research/balochistan-division-district-set.md
  16632271: 'Karezat — district abolished November 2022, did not exist at census date',
  // A village mis-tagged admin_level=6, with no member geometry. Found by #2.
  18325503: 'Mehmood kot Hashim wala — village mis-tagged as a district',
  // Indian-administered Jammu & Kashmir, east of the Line of Control.
  10389554: 'Kupwara — Indian-administered Jammu & Kashmir, not Pakistan',
  10389555: 'Karnah — Indian-administered Jammu & Kashmir, not Pakistan',
};

/**
 * Districts whose names are not unique across the Line of Control, pinned to the exact OSM
 * relation the verification checked.
 *
 * Indian-administered Jammu & Kashmir carries a name-identical **Poonch** district and a
 * **Haveli** at the same admin level. Name matching alone would let either silently merge into
 * its AJK namesake if a refetch ever returned them — territory from the other side of a
 * ceasefire line, absorbed into a Pakistani district with no error. Nothing in the current cache
 * triggers this; the assertion exists so that a future Overpass result cannot.
 *
 * Ids verified in `docs/research/ajk-district-set.md`.
 */
export const PINNED_RELATION_IDS: Readonly<Record<string, number>> = {
  Poonch: 8191016,
  Haveli: 8199078,
  Mirpur: 8181854,
  Bhimber: 8183916,
  Kotli: 8184277,
  Bagh: 8192015,
  Muzaffarabad: 8191414,
  Neelum: 8191217,
  Sudhnoti: 8198049,
  // OSM calls this one "Hattian Bala District", after the headquarters town. The id is what
  // joins it, so the roster is free to display the official name — ajk-district-set.md.
  'Jhelum Valley': 8192278,
};

/**
 * OSM relation id -> roster district, for relations whose `name:en` is actively misleading.
 * Karachi's four renamed districts are the reason CLAUDE.md's "join on id, never on name" rule
 * exists: OSM labels Karachi South as plain "Karachi District", and calls Karachi West
 * "Orangi" — a name that in the post-2023 reorganisation belongs to a *different* unit. Keying
 * these on name would silently misplace population in Pakistan's largest city.
 *
 * Identities confirmed via each relation's `wikidata` tag (labels and aliases on Q6367790,
 * Q6367734, Q6367745, Q6367783), all with inception 2013 — a relabelling, not a restructuring,
 * so the census's seven Karachi districts map one-to-one onto OSM's seven.
 */
export const RELATION_OVERRIDES: Readonly<Record<number, string>> = {
  16347667: 'Karachi West', // OSM "Orangi District", wikidata Q6367790
  16349281: 'Karachi Central', // OSM "Nazimabad District", wikidata Q6367734
  16350242: 'Karachi East', // OSM "Gulshan District", wikidata Q6367745
  16350836: 'Karachi South', // OSM "Karachi District", wikidata Q6367783
};

/**
 * OSM `name:en` -> PBS roster name, where the two genuinely differ. Spelling-only differences
 * are handled by `normalizeName`; this table is for real naming disagreements.
 *
 * The direction is load-bearing and is asserted in both halves by `reconcile.test.ts`: the
 * **value** is the name every rendered surface prints, and the **key** is only ever a spelling
 * somebody else uses to find it. Inverting a pair leaves every join passing while the map
 * displays the wrong name, which is what happened to Jhelum Valley until #46.
 *
 * Two checks guard it and they catch different things, which is worth knowing before trusting
 * either. The **general** one — no alias key may normalize to a name the roster displays —
 * catches a *half* inversion, where the roster is edited and the alias left behind, and names
 * the offending pair. It does **not** catch a clean full inversion of both sides at once: that
 * is a well-formed table saying the wrong thing, and no structural rule can tell which of two
 * names a government uses. What catches that is the **pair-specific** assertion naming Jhelum
 * Valley as displayed and Hattian Bala as not, which is why the named pair is asserted rather
 * than left to the general rule.
 *
 * The three AJK entries are ruled on in `docs/research/ajk-district-set.md` — official name for
 * display, OSM name for the geometry join:
 *   - **Jhelum Valley** is the AJ&K Bureau of Statistics' name; `Hattian Bala` is the
 *     headquarters town and the tehsil, and is what OSM tags the district with.
 *   - **Neelum** is the AJK BoS name; OSM has `Neelam Valley` and the AJK Election Commission
 *     `District Neelum Valley`, so both are carried — the canonical name being right is not
 *     evidence that either alias exists.
 *   - **Sudhnoti** is the AJK BoS name; OSM has `Sudhanoti`.
 */
export const NAME_ALIASES: Readonly<Record<string, string>> = {
  'neelam valley': 'Neelum',
  'neelum valley': 'Neelum',
  'hattian bala': 'Jhelum Valley',
  sudhanoti: 'Sudhnoti',
  qalat: 'Kalat',
  bolan: 'Kachhi (Bolan)',
  kachhi: 'Kachhi (Bolan)',
  'qilla abdullah': 'Killa Abdullah',
  'qila abdullah': 'Killa Abdullah',
  'qilla saifullah': 'Killa Saifullah',
  'qila saifullah': 'Killa Saifullah',
  musakhel: 'Musa Khel',
  abbottabad: 'Abbotabad',
  jafarabad: 'Jaffarabad',
  kamber: 'Kambar Shahdadkot',
  'qambar shahdadkot': 'Kambar Shahdadkot',
  'shaheed benazir abad': 'Shaheed Benazirabad',
  kiamari: 'Keamari',
  diamer: 'Diamir',
  kharmang: 'Kharmaung',
  'tando muhammad khan': 'Tando Mohammad Khan',
  'tando allahyar': 'Tando Allah Yar',
  battagram: 'Batagram',
  'kolai palas': 'Kolai Pallas Kohistan',
  'kolai pallas': 'Kolai Pallas Kohistan',
};

/**
 * Casefold and strip the noise that varies freely between OSM, PBS and press: the
 * "District"/"Division" suffix, punctuation, and runs of whitespace.
 */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(district|division|tehsil|agency)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Resolve an OSM name to its roster spelling, or `null` if it is not a 2023 district. */
export function resolveRosterName(osmName: string): string | null {
  const normalized = normalizeName(osmName);
  const aliased = NAME_ALIASES[normalized];
  if (aliased) return aliased;
  for (const province of ROSTER) {
    for (const district of province.districts) {
      if (normalizeName(district) === normalized) return district;
    }
  }
  return null;
}

/** The province a roster district belongs to. */
export function provinceOf(district: string): string | null {
  for (const province of ROSTER) {
    if (province.districts.includes(district)) return province.name;
  }
  return null;
}

/**
 * Constitutional status, which drives territory styling — D12, D25.
 *
 * Throws rather than defaulting. A default of 'province' would stamp an unrecognised name as a
 * province in the bundle, and CONTEXT.md is explicit that calling AJK or GB provinces is
 * factually wrong — precisely the claim this app must not make by accident.
 */
export function kindOf(province: string): Province['kind'] {
  const match = ROSTER.find((p) => p.name === province);
  if (match === undefined) throw new Error(`${province} is not a province in the roster`);
  return match.kind;
}

export const ROSTER_DISTRICT_COUNT = ROSTER.reduce((n, p) => n + p.districts.length, 0);

/**
 * Districts in the four provinces plus ICT — the statistical atom. Excludes AJK and GB.
 *
 * Every join that reports what the census failed to cover measures against this list, so it is
 * defined once: two copies of the filter would be two answers to "which districts should have
 * data", and the one that drifted would report nothing missing.
 */
export const CENSUS_DISTRICTS: readonly string[] = ROSTER.filter(
  (p) => p.kind !== 'territory',
).flatMap((p) => p.districts);

export const CENSUS_DISTRICT_COUNT = CENSUS_DISTRICTS.length;
