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
    districts: [
      'Hattian Bala', 'Muzaffarabad', 'Neelum', 'Bagh', 'Haveli', 'Sudhnoti', 'Poonch',
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
 * OSM division spelling -> PBS spelling. Kept separate from `NAME_ALIASES` because the two
 * tiers genuinely disagree: Balochistan has both a Kalat *district* and a Kalat *division*, and
 * OSM spells the division "Qalat" while spelling the district "Kalat". One shared table would
 * have to pick a winner and would silently rename the other tier.
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
 * Districts OSM carries that the 2023 census does not. Each folds into exactly one parent —
 * verified for Balochistan in `docs/research/balochistan-division-district-set.md`, which
 * confirmed no post-census unit was carved from two parents. A one-parent fold means the
 * dissolve recovers the 2023 boundary exactly rather than approximating it.
 *
 * Two relations folding into the *same* parent is normal and expected: South Waziristan was
 * split into Upper and Lower after the census, so its 2023 geometry is the union of both.
 */
export const POST_CENSUS_DISTRICT_FOLDS: Readonly<Record<string, string>> = {
  // Punjab
  Wazirabad: 'Gujranwala',
  Taunsa: 'Dera Ghazi Khan',
  'Kot Addu': 'Muzaffargarh',
  Talagang: 'Chakwal',
  Murree: 'Rawalpindi',
  // Khyber Pakhtunkhwa
  'Central Dir': 'Lower Dir',
  'Lower South Waziristan': 'South Waziristan',
  'Upper South Waziristan': 'South Waziristan',
  // Balochistan — docs/research/balochistan-division-district-set.md
  Hub: 'Lasbela',
  'Usta Muhammad': 'Jaffarabad',
  // Gilgit-Baltistan
  'Gupis-Yasin': 'Ghizer',
  Tangir: 'Diamir',
  Darel: 'Diamir',
};

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
 */
export const NAME_ALIASES: Readonly<Record<string, string>> = {
  'neelam valley': 'Neelum',
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
  'jhelum valley': 'Hattian Bala',
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

/** Constitutional status, which drives territory styling — D12, D25. */
export function kindOf(province: string): Province['kind'] {
  return ROSTER.find((p) => p.name === province)?.kind ?? 'province';
}

export const ROSTER_DISTRICT_COUNT = ROSTER.reduce((n, p) => n + p.districts.length, 0);

/** Districts in the four provinces plus ICT — the statistical atom. Excludes AJK and GB. */
export const CENSUS_DISTRICT_COUNT = ROSTER.filter((p) => p.kind !== 'territory').reduce(
  (n, p) => n + p.districts.length,
  0,
);
