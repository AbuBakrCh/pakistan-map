# Balochistan: division and district set, verified

**Issue:** [#6](https://github.com/AbuBakrCh/pakistan-map/issues/6) — Verify the Balochistan division and district set
**Consumed by:** #3 (bundle v0), #24, #26
**Researched:** 2026-08-01. All URLs accessed 2026-08-01.
**Status:** resolved for the baseline the app actually draws. Partially unresolved for the
current-day (post-July-2026) set — see [Unresolved](#unresolved--needs-a-gazette).

---

## What this settles

Three different "correct" answers for Balochistan are in circulation, and they are all correct
about different dates:

| Answer | Divisions | Districts | Vintage |
|---|---|---|---|
| **PBS 2023 Digital Census** | 8 | 34 | as on 01-03-2023 — **this is what we draw** |
| OSM `admin_level=5`/`6` today | 8 | 36 | ~2022 administrative state, with two defects |
| Government of Balochistan today | 11 | 41 | 8 July 2026 notification |
| Wikipedia today | 11 | 42 | wrong — see [Wikipedia is not usable here](#wikipedia-is-not-usable-here) |

Per the vintage rule in `CLAUDE.md`, the app **renders the 2023 census set: 8 divisions,
34 districts.** Everything created after 1 March 2023 folds into its parent for statistics and
is noted in copy, not drawn.

**The 34 census districts sum exactly to the published provincial total** — 14,894,402 — which
proves the set is complete and non-overlapping. Source: PBS Census-2023 Table 1, Balochistan,
row `BALOCHISTAN 347,190 14,894,402`.

---

## A. Divisions rendered on the base map (8)

Source: PBS, *List of Administrative Districts by Division & Province (as on 01-03-2023)*,
[PDF](https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf).
Provenance badge: `official`.

| # | Division (PBS spelling) | Districts | Note |
|---|---|---|---|
| 1 | Quetta | 4 | |
| 2 | Rakhshan | 4 | marked `*` in the PBS list = created after the 2017 census, before 2023 |
| 3 | Zhob | 3 | |
| 4 | Loralai | 4 | |
| 5 | Sibi | 5 | renamed **Sevi** in 2026 — not our vintage |
| 6 | Nasirabad | 5 | |
| 7 | Kalat | 6 | **abolished** in 2026 — not our vintage |
| 8 | Mekran | 3 | PBS spells it *Mekran*; OSM and press use *Makran*; renamed *Makuran* in 2026 |

Independently corroborated: OpenStreetMap holds exactly these eight and no others as
`admin_level=5` inside Balochistan (query run 2026-08-01, Overpass; see
[OSM audit](#e-osm-audit)). Of the 39 `admin_level=5` relations in Pakistan, eight are
Balochistan's, and OSM's division→district membership matches the PBS mapping in Table B
district-for-district.

---

## B. Districts, mapped to division (34)

Source: PBS *List of Administrative Districts … (as on 01-03-2023)* for the division mapping and
the ordering; PBS **Census-2023 Table 1, Balochistan**
([PDF](https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_balochistan_districts.pdf))
for the existence of a district-level census row and the 2023 population.

Every row below has a district-level census row. Populations are as published (all sexes).

| # | District (PBS) | Division | Population 2023 | Note |
|---|---|---|---|---|
| 1 | Quetta | Quetta | 2,595,492 | split into Quetta East / Quetta West, 2026 |
| 2 | Pishin | Quetta | 835,482 | moved to Pishin division, 2026 |
| 3 | Killa Abdullah | Quetta | 361,971 | |
| 4 | Chaman | Quetta | 466,218 | `*` created after 2017 census, before 2023 |
| 5 | Chagai | Rakhshan | 269,192 | |
| 6 | Nushki | Rakhshan | 207,834 | |
| 7 | Kharan | Rakhshan | 260,352 | |
| 8 | Washuk | Rakhshan | 302,623 | |
| 9 | Loralai | Loralai | 272,432 | `*` |
| 10 | Duki | Loralai | 205,044 | `*` |
| 11 | Barkhan | Loralai | 210,249 | |
| 12 | Musa Khel | Loralai | 182,275 | Table 1 spells it `MUSAKHEL` |
| 13 | Killa Saifullah | Zhob | 380,200 | |
| 14 | Zhob | Zhob | 355,692 | |
| 15 | Sherani | Zhob | 191,687 | |
| 16 | Sibi | Sibi | 224,148 | |
| 17 | Harnai | Sibi | 127,571 | |
| 18 | Ziarat | Sibi | 189,535 | |
| 19 | Kohlu | Sibi | 260,220 | |
| 20 | Dera Bugti | Sibi | 355,274 | split N/S, 2026 |
| 21 | Jaffarabad | Nasirabad | 594,558 | **includes Usta Muhammad** |
| 22 | Nasirabad | Nasirabad | 563,315 | |
| 23 | Kachhi (Bolan) | Nasirabad | 442,674 | Table 1 spells it `KACHHI` |
| 24 | Jhal Magsi | Nasirabad | 203,368 | |
| 25 | Sohbatpur | Nasirabad | 240,106 | |
| 26 | Kalat | Kalat | 271,560 | |
| 27 | Surab | Kalat | 279,038 | `*`; formerly Shaheed Sikandarabad |
| 28 | Mastung | Kalat | 313,271 | moved to Quetta division, 2026 |
| 29 | Khuzdar | Kalat | 997,214 | |
| 30 | Awaran | Kalat | 178,958 | |
| 31 | Lasbela | Kalat | 680,977 | **includes Hub** |
| 32 | Kech | Mekran | 1,060,931 | |
| 33 | Gwadar | Mekran | 305,160 | |
| 34 | Panjgur | Mekran | 509,781 | |
| | **Total** | | **14,894,402** | matches published provincial total exactly |

`*` = PBS's own footnote, "CREATED AFTER 2017 CENSUS" — i.e. these exist in the 2023 census but
not the 2017 one. They are **in scope**; they carry census rows.

**Surab is not a post-census district.** The ticket listed it among the doubtful new units. It
was created between the 2017 and 2023 censuses and has a full 2023 census row (279,038). Draw it.

---

## C. Post-census units and the fold mapping

This is the operative output of this ticket. Anything below has **no district-level row in the
2023 census** and therefore must fold into the census parent named here.

### C.1 Created between the census (1 Mar 2023) and 2026 — already exist administratively

| Unit | Type | Created | Carved from | **Folds into (census district)** |
|---|---|---|---|---|
| Usta Muhammad | district | cabinet 7 Jun 2022 | Jaffarabad | **Jaffarabad** |
| Hub | district | cabinet 7 Jun 2022 | Lasbela | **Lasbela** |
| Karezat | district | cabinet 7 Jun 2022, **abolished Nov 2022** | Pishin | **Pishin** (fold — see the correction below) |

Sources: [Express Tribune, 7 June 2022 — "Balochistan creates three new
districts"](https://tribune.com.pk/story/2360394/balochistan-creates-three-new-districts)
(cabinet chaired by CM Mir Quddus Bizenjo approved Hub, Karezat and Osta Muhammad);
[Wikipedia, *List of districts in
Balochistan*](https://en.wikipedia.org/wiki/List_of_districts_in_Balochistan) for the Karezat
abolition in November 2022 — **secondary, not traced to a gazette**, see Unresolved.

The fold is confirmed positively inside the census itself, not merely by absence: Table 1 lists
`USTA MUHAMMAD SUB-DIVISION` (210,870) as a sub-division **of** Jaffarabad district, and
`HUB SUB-DIVISION` (233,443) as a sub-division **of** Lasbela district. The census counted this
territory; it counted it under the parent.

Note that these two are why the pre-2026 press baseline is "36 districts" while PBS says 34.
34 census + Usta Muhammad + Hub = 36. That reconciles the two figures completely.

### C.2 Created by the 2026 restructuring

Notification: Revenue Department, Government of Balochistan, **8 July 2026**, issued under
sections 5, 6 and 6-A of the Balochistan Land Revenue Act, 1967. Cabinet approvals 19 January
2026 and 24–26 February 2026.

| Unit | Type | Created | Carved from | **Folds into (census district)** |
|---|---|---|---|---|
| Quetta East | district | 8 Jul 2026 | Quetta (Saddar, City, Sariab sub-divisions) | **Quetta** |
| Quetta West | district | 8 Jul 2026 | Quetta (Kuchlak, Brewery, Panjpai sub-divisions) | **Quetta** |
| Barshore (Barshor / Borshore) | district | cabinet 19 Jan 2026; notified 8 Jul 2026 | Pishin (Barshore tehsil + Toba Kakari) | **Pishin** |
| Wadh | district | 8 Jul 2026 | Khuzdar (Wadh, Nal, Ornach sub-divisions) | **Khuzdar** |
| Tump | district | notified 24 Feb 2026 | Kech (Tump sub-division) | **Kech** |
| Upper / North Dera Bugti | district | cabinet 26 Feb 2026 | Dera Bugti | **Dera Bugti** |
| South Dera Bugti | district | 8 Jul 2026 (renaming of the residual Dera Bugti) | Dera Bugti | **Dera Bugti** |

| Division | Created | Composed of | **Folds into (census division)** |
|---|---|---|---|
| Pishin | cabinet 19 Jan 2026; notified 8 Jul 2026; HQ Saranan | Pishin, Barshore, Chaman, Killa Abdullah | **Quetta** |
| Koh-e-Sulaiman (Koh-i-Suleman) | cabinet 19 Jan 2026; notified 8 Jul 2026; HQ Rakhni | Upper Dera Bugti, Kohlu, Barkhan | **Sibi** (Kohlu, Dera Bugti) and **Loralai** (Barkhan) — *splits across two census divisions* |
| Khuzdar | 8 Jul 2026 | Khuzdar, Kalat, Surab, Wadh | **Kalat** |
| Lasbela | 8 Jul 2026 | Lasbela, Hub, Awaran | **Kalat** |

Also in the 8 July 2026 notification, and equally out of vintage:
Kalat division **abolished**; Mastung moved Kalat → Quetta division;
Kachhi moved Nasirabad → Sevi division; Ziarat and Harnai moved Sibi/Sevi → Loralai division;
Sibi renamed **Sevi**; Makran respelled **Makuran**.

Sources: [Dawn, 12 Jul 2026 — "Quetta split into two districts as Balochistan undergoes
administrative restructuring"](https://www.dawn.com/news/2014627);
[Dawn, 13 Jul 2026 — "Balochistan undergoes major
restructuring"](https://www.dawn.com/news/2014773/balochistan-undergoes-major-restructuring);
[ProPakistani, 12 Jul 2026](https://propakistani.pk/2026/07/12/balochistan-govt-notifies-new-divisions-and-districts/);
[Quetta Voice, 11 Jul 2026](https://quettavoice.com/2026/07/11/balochistan-announces-major-administrative-restructuring-creates-new-divisions-districts-and-tehsils/)
(gives the enabling sections of the Land Revenue Act);
[Bol News, 11 Jul 2026](https://www.bolnews.com/pakistan/balochistan-govt-notifies-creation-of-new-divisions-and-districts/);
[ProPakistani, 25 Feb 2026 — cabinet approval of 19 Jan
2026](https://propakistani.pk/2026/02/25/balochistan-approves-new-divisions-and-districts/);
[The Asian Mirror, 25 Feb 2026](https://theasianmirror.com/top-stories/77252/balochistan-administrative-reforms-2026-new-districts-divisions-announced/).
Tump: [Wikipedia, *Tump District*](https://en.wikipedia.org/wiki/Tump_District), citing Daily
Times and Daily Independent, 9 Mar 2026. Upper Dera Bugti:
[Wikipedia, *Upper Dera Bugti district*](https://en.wikipedia.org/wiki/Upper_Dera_Bugti_district),
citing 24NewsHD 25 Feb 2026 and Dawn 1 Mar 2026.

### C.3 Arithmetic check on the 2026 set

The press consistently reports the notification as taking Balochistan **from 8 divisions and 36
districts to 11 divisions and 41 districts**. That reconciles exactly:

```
36 (34 census + Usta Muhammad + Hub)
 +1  Quetta → Quetta East + Quetta West
 +1  Barshore ex Pishin
 +1  Wadh ex Khuzdar
 +1  Tump ex Kech
 +1  Upper Dera Bugti ex Dera Bugti
 = 41 ✓
```

```
8 divisions − 1 (Kalat abolished) + Pishin + Koh-e-Sulaiman + Khuzdar + Lasbela = 11 ✓
```

**Taftan is therefore not a district.** It is a sub-division of Chagai (census population
19,259) and no source traces it to a creation notification. Wikipedia's claim of 42 districts
including a Taftan district does not reconcile with any reported total.

### C.4 Do not reconstruct populations for the new districts

It is tempting to give Wadh, Tump, Barshore etc. a population by summing the census
sub-divisions inside them. Do not, and not only because the project joins at district level:
the notification **also moves sub-divisions around**, so the new district is not the old
sub-division. Wadh district is Wadh + Nal + Ornach (116,229 + 103,631 + 41,811 = 261,671), not
the 116,229 of the census `WADH SUB-DIVISION`. Any figure derived this way is `derived`, not
`census`, and would need its own badge. The fold in C.1/C.2 is the sanctioned treatment.

---

## D. Name spelling variants that can break a name-based join

PBS's own two documents disagree with each other, and OSM disagrees with both. **Join on a code,
not a name.** These are the observed variants (PBS admin list / PBS Table 1 / OSM `name:en` /
press):

### Divisions

| Canonical | Variants seen |
|---|---|
| Mekran | `MEKRAN` (PBS), `Makran` (OSM, press), `Makuran` (2026 notification) |
| Kalat | `KALAT` (PBS), `Qalat Division` (OSM), *Kalat* (press) |
| Sibi | `SIBI` (PBS, OSM), `Sevi` (2026 notification) |
| Nasirabad | `NASIRABAD` (PBS, OSM), `Naseerabad` (press) |
| Koh-e-Sulaiman | `Koh-e-Sulaiman`, `Koh-e-Suleiman`, `Koh-i-Suleman`, `Koh-e-Suleman` |

### Districts

| Canonical (PBS admin list) | PBS Table 1 | OSM `name:en` | Other |
|---|---|---|---|
| KALAT | KALAT | **Qalat District** | Qalat |
| KILLA ABDULLAH | KILLA ABDULLAH | **Qilla Abdullah District** | Qila Abdullah, Killa Abdullah |
| KILLA SAIFULLAH | KILLA SAIFULLAH | **Qilla Saifullah District** | Qila Saifullah |
| MUSA KHEL | **MUSAKHEL** | Musakhel District | Musakhail, Musa Khel Bazar |
| KACHHI (BOLAN) | **KACHHI** | Kachhi District | Bolan |
| JAFFARABAD | JAFFARABAD | **Jafarabad District** | Jafferabad |
| SURAB | SURAB | Surab District | Shaheed Sikandarabad (former name) |
| BARKHAN | BARKHAN | Barkhan District | OSM Urdu is `بارخان`, normally `بارکھان` |
| KECH | KECH | Kech District | Turbat (HQ, used as district name colloquially) |
| CHAGAI | CHAGAI | Chagai District | Chaghi, Chagi |
| SHERANI | SHERANI | Sherani District | Sherani/Shirani |
| SOHBATPUR | SOHBATPUR | Sohbatpur District | Sohbat Pur |
| DERA BUGTI | DERA BUGTI | Dera Bugti District | after 2026: North/South Dera Bugti |
| Barshore (post-census) | — | — | Barshor, Borshore, Barshoor |

---

## E. OSM audit

Queried 2026-08-01 via Overpass (`overpass-api.de`) and the OSM API. Overpass returned
`Dispatcher_Client::request_read_and_idx::timeout` on several attempts before succeeding —
consistent with the reliability note in `CLAUDE.md`, and a reason the build script needs retry
logic.

- **Divisions**: OSM has exactly 39 `admin_level=5` relations in Pakistan, of which 8 are in
  Balochistan (`Quetta` 16635945, `Rakhshan` 16653787, `Zhob` 16629735, `Loralai` 16626736,
  `Sibi` 16642355, `Nasirabad` 16653752, `Qalat` 16653802, `Makran` 16347101). This matches the
  census-vintage set. **No change needed.**
- **Districts**: OSM has 168 `admin_level=6` relations in Pakistan; 36 are in Balochistan. That
  is the 34 census districts **plus Hub (16659106) plus Karezat (16632271)**.
- **Defect 1 — Karezat.** OSM carries a Karezat district relation. Karezat was abolished in
  November 2022 and has no census row, so it is never drawn as itself.

  **Corrected: fold it into Pishin, do not drop it.** This section originally said "drop it; its
  area is inside Pishin", which is true of the territory and false of the OSM relation — OSM cut
  Karezat's 3,504 km² *out* of the Pishin polygon when it added the district, and never put it
  back when the district was abolished. Dropping the relation therefore dropped the ground: the
  shipped map had a hole 3,504 km² wide and 85 km deep in northern Balochistan, opening at the
  Zhob-division end of the province boundary and reading as an unnatural dent in the outline.
  Drawn Pishin was 2,219 km² against a published 6,218; folded, it is 5,723. The lesson is the
  general one, and is now a rule in `scripts/lib/roster.ts` and an assertion in `bundle.test.ts`:
  a relation is **dropped** only when its ground is not Pakistan's or it is not a unit at all,
  and Pakistani ground under a name the census does not carry is a **fold**, whether the unit was
  created after the census or abolished before it.
- **Defect 2 — Usta Muhammad.** OSM does **not** carry Usta Muhammad as a district, so its area
  is already inside the Jaffarabad polygon. This happens to be exactly what our vintage rule
  wants — but it is a coincidence, not a guarantee, and should be re-checked each build.
- **Defect 3 — stray member.** Relation 16667449 (`Nag Tehsil`, `admin_level=7`) is a direct
  member of the Rakhshan division relation. The build must filter division members to
  `admin_level=6`, or Nag will be picked up as a district.
- **Consequence for the pipeline:** after folding Karezat into Pishin and merging Hub into
  Lasbela, OSM yields exactly the 34-district census set. OSM's own division→district membership then agrees
  with Table B for all 34.

---

## Wikipedia is not usable here

Recorded because the ticket asked whether Wikipedia could be trusted as a lead. It can be used
to find a notification date. It cannot be used for the set or for any number.

- *[List of districts in Balochistan](https://en.wikipedia.org/wiki/List_of_districts_in_Balochistan)*
  states 42 districts, a total that reconciles with no reported figure, and includes a Taftan
  district for which no notification exists.
- The same article gives "Quetta West: 313,271", which is Mastung's census figure, and "Quetta
  East: 2,595,492", which is the whole undivided Quetta district.
- *[Upper Dera Bugti district](https://en.wikipedia.org/wiki/Upper_Dera_Bugti_district)* gives a
  population of 260,220, which is Kohlu district's census figure.
- *[Divisions of Balochistan](https://en.wikipedia.org/wiki/Divisions_of_Balochistan)*
  self-contradicts between 10 and 11 divisions within one article.

Every population Wikipedia attributes to a post-census district is either a mis-copy or a
`derived` split presented as `census`. Under the project's no-unsourced-surface rule, none of it
is usable.

---

## Unresolved / needs a gazette

These are recorded as open, not guessed.

1. **The 8 July 2026 notification text was not obtained.** Everything in section C.2 comes from
   press reporting of it. The Board of Revenue downloads page
   (`https://bor.balochistan.gov.pk/downloads/`) returned HTTP 403 on 2026-08-01 and no copy of
   the notification was found on `balochistancode.gob.pk` or `balochistan.gov.pk`. Its
   notification number is unknown. **This does not block the app** — nothing in it is drawn —
   but any copy claiming the current-day set is one remove from a primary source and must be
   badged accordingly.

2. **The full current-day district roster is not resolvable from any source found.** Every press
   report gives division-wise detail only for Quetta, Khuzdar, Lasbela, Pishin and Sevi, and
   explicitly omits Rakhshan, Makuran, Naseerabad, Zhob, Loralai and Koh-i-Suleman. The 41 total
   reconciles arithmetically (section C.3), but the *assignment* of roughly a dozen districts to
   the six unreported divisions is inference, not evidence.

3. **Sources disagree on where Musakhel sits after 2026.** The Asian Mirror places Musakhel in
   both Zhob division and Loralai division in the same article. Unresolved.

4. **Dera Bugti's post-2026 placement is contradictory.** Dawn's second piece implies a "Dera
   Bugti Division"; ProPakistani and Bol News place South Dera Bugti in Sevi division and Upper
   (North) Dera Bugti in Koh-i-Suleman. The two-way split is corroborated; the division names
   are not settled.

5. **Karezat's abolition rests on Wikipedia alone.** No gazette or press report of the November
   2022 abolition was located. The June 2022 creation *is* sourced (Express Tribune). Since we
   fold Karezat into Pishin either way — abolished, or post-census — this does not change the
   output, but the stated reason is weakly sourced. (This item originally said "drop"; see the
   correction under Defect 1. The two are not interchangeable: one keeps the ground, one loses
   it.)

6. **Usta Muhammad's parent.** One search summary asserted Usta Muhammad was carved from Killa
   Saifullah. That is wrong on the geography and is contradicted by the census, which lists
   `USTA MUHAMMAD SUB-DIVISION` inside Jaffarabad district. We use **Jaffarabad**, on the
   strength of the census structure itself. Flagged only because the erroneous claim is in
   circulation.

7. **No Election Commission delimitation cross-check was performed.** ECP's *District Wise Voter
   Statistics as on 31 May 2023* exists
   (`https://ecp.gov.pk/storage/files/3/District%20Wise%20Voter%20Statistics%20as%20on%2031%20May%202023.pdf`)
   and would independently corroborate the 2023 district set. It was not needed — the census
   districts summing exactly to the provincial total is a stronger proof — but it remains
   available if a third source is ever wanted.

---

## What issue #3 should do

- Render **8 divisions** and build from **34 districts** for Balochistan.
- From the OSM extract: fold the `Karezat` relation into Pishin; expect no `Usta Muhammad` relation, and
  fail the build loudly if one appears (it would mean OSM has re-cut Jaffarabad and the geometry
  no longer matches the census).
- Filter division members to `admin_level=6` so `Nag Tehsil` is not mistaken for a district.
- Do not join on names. If a name key is unavoidable, normalise `Qalat→Kalat`,
  `Qilla→Killa`, `Jafarabad→Jaffarabad`, `Musakhel→Musa Khel`, `Makran→Mekran`.
- Provenance metadata for Balochistan: source `PBS, List of Administrative Districts by Division
  & Province (as on 01-03-2023)` + `PBS Census-2023 Table 1, Balochistan`, geometry `OSM
  admin_level=5/6`, vintage `2023-03-01`.
- Copy for the variant/basis surfaces should note: *Balochistan was restructured on 8 July 2026
  into 11 divisions and 41 districts. That set post-dates the 2023 census and carries no
  population, so this map shows the census-vintage 8 divisions and 34 districts.*

---

## Sources

All accessed **2026-08-01**.

**Primary — Pakistan Bureau of Statistics**

- PBS, *List of Administrative Districts by Division & Province (as on 01-03-2023)* —
  https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf
- PBS, *Census-2023 Table 1: Area, Population by Sex, Sex Ratio, Population Density, Urban
  Population, Household Size and Annual Growth Rate — Balochistan* —
  https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_1_balochistan_districts.pdf
- PBS, *Provincial Census Report 2023 — Balochistan* (not parsed for this note; listed for
  completeness) —
  https://www.pbs.gov.pk/wp-content/uploads/2020/07/Provincial-Census-Report-2023-Balochistan-1.pdf

**Primary — geometry**

- OpenStreetMap, `admin_level=5` and `admin_level=6` relations, queried via Overpass API and the
  OSM API on 2026-08-01. Relation IDs are given inline in section E.

**Secondary — the 2026 restructuring** (the notification itself was not obtained)

- Dawn, *Quetta split into two districts as Balochistan undergoes administrative restructuring* —
  https://www.dawn.com/news/2014627
- Dawn, *Balochistan undergoes major restructuring* —
  https://www.dawn.com/news/2014773/balochistan-undergoes-major-restructuring
- Quetta Voice, *Balochistan Announces Major Administrative Restructuring…* —
  https://quettavoice.com/2026/07/11/balochistan-announces-major-administrative-restructuring-creates-new-divisions-districts-and-tehsils/
- ProPakistani, *Balochistan Govt Notifies New Divisions and Districts* —
  https://propakistani.pk/2026/07/12/balochistan-govt-notifies-new-divisions-and-districts/
- ProPakistani, *Balochistan Approves New Divisions and Districts* —
  https://propakistani.pk/2026/02/25/balochistan-approves-new-divisions-and-districts/
- Bol News, *Balochistan govt notifies creation of new divisions and districts* —
  https://www.bolnews.com/pakistan/balochistan-govt-notifies-creation-of-new-divisions-and-districts/
- The Asian Mirror, *Balochistan Administrative Reforms 2026* —
  https://theasianmirror.com/top-stories/77252/balochistan-administrative-reforms-2026-new-districts-divisions-announced/
- Express Tribune, *Balochistan creates three new districts* (7 Jun 2022) —
  https://tribune.com.pk/story/2360394/balochistan-creates-three-new-districts

**Consulted and found unreliable**

- Wikipedia, *List of districts in Balochistan* —
  https://en.wikipedia.org/wiki/List_of_districts_in_Balochistan
- Wikipedia, *Divisions of Balochistan* — https://en.wikipedia.org/wiki/Divisions_of_Balochistan
- Wikipedia, *Upper Dera Bugti district* —
  https://en.wikipedia.org/wiki/Upper_Dera_Bugti_district
- Wikipedia, *Tump District* — https://en.wikipedia.org/wiki/Tump_District (used only for the
  notification date, which it cites to Daily Times / Daily Independent, 9 Mar 2026)

**Attempted, unavailable**

- Board of Revenue, Government of Balochistan — downloads —
  https://bor.balochistan.gov.pk/downloads/ — HTTP 403 on 2026-08-01
- Pakistan Today, *Balochistan raises divisions to 11…* —
  https://www.pakistantoday.com.pk/2026/07/11/balochistan-raises-divisions-to-11-splits-quetta-into-east-and-west-districts
  — HTTP 403 on 2026-08-01 (content reached indirectly via search snippet only)
