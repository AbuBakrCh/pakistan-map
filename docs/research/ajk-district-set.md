# Azad Jammu & Kashmir — verified district set

Research for issue [#5](https://github.com/AbuBakrCh/pakistan-map/issues/5). Consumed by
issue #3 (bundle v0) and by the AJK-touching scenario tickets #24 and #30.

**All sources accessed 2026-08-01.** No application code was written or changed for this
document.

---

## Headline

- **AJK has 10 districts, grouped into 3 divisions.** The count and the set in the
  from-memory list are **correct**.
- **All 10 are rows in the PBS 2023 Digital Census.** Nothing has to be folded into a parent
  under the project's vintage rule.
- **Two names in the from-memory list are wrong or non-official**, and one of them
  ("Hattian Bala") is the name OSM uses, so the bundle needs an explicit alias map rather
  than a name-based join. See [Discrepancies](#discrepancies-vs-the-from-memory-list) and
  [Name-join hazards](#name-join-hazards).
- **AJK is absent from every PBS-published 2023 census results surface we could find** other
  than the census-areas count. Population reaches us only through the AJK Bureau of
  Statistics, which republishes it attributed to PBS Census 2023. Mother tongue and the
  development indicators are **not** available for AJK districts from any source found —
  this is an unresolved risk for the Language and Development bases, flagged below.

---

## The verified list

Names in the "Official name" column are as the **AJ&K Bureau of Statistics, Planning &
Development Department** prints them — the AJK government's own statistical authority, and
the publisher that carries the 2023 census figures for the territory.

| # | Official name (AJK BoS) | Division | HQ | 2023 census population | Also appears as |
|---|---|---|---|---|---|
| 1 | Muzaffarabad | Muzaffarabad | Muzaffarabad | 703,661 | Mzd. (AJK BoS tables) |
| 2 | Neelum | Muzaffarabad | Athmuqam | 221,512 | Neelum Valley (AJK EC); Neelam Valley (OSM); Neelam |
| 3 | Jhelum Valley | Muzaffarabad | Hattian Bala | 257,059 | Jehlum Valley (AJK BoS, elsewhere in same book); **Hattian Bala** (OSM, Wikipedia); Hattian |
| 4 | Bagh | Poonch | Bagh | 436,795 | — |
| 5 | Haveli | Poonch | Forward Kahuta | 170,828 | Haveli (Kahuta) (AJK BoS, AJK EC) |
| 6 | Poonch | Poonch | Rawalakot | 544,898 | Poonch (Rawalakot) |
| 7 | Sudhnoti | Poonch | Pallandri | 313,671 | **Sudhnuti** (AJK EC); **Sudhanoti** (OSM, Wikipedia) |
| 8 | Kotli | Mirpur | Kotli | 804,265 | — |
| 9 | Mirpur | Mirpur | Mirpur | 441,784 | New Mirpur City (HQ town) |
| 10 | Bhimber | Mirpur | Bhimber | 438,994 | Bhimbar |
| — | **AJ&K total** | — | — | **4,333,467** | — |

Source for names and populations: *Azad Jammu & Kashmir at a Glance – 2025*, AJ&K Bureau of
Statistics, P&DD — "District wise Population & Growth Rate of AJ&K" (p. 3) and "District &
Area-wise Population of AJ&K" (p. 4), the latter sourced in the document itself to
"Population & Housing Census 2023, Pakistan Bureau of Statistics".
<https://pndajk.gov.pk/uploadfiles/downloads/AJK%20At%20a%20Glance%202025.pdf>

Count corroborated by the same publication's "Administrative Setup of AJ&K (2024)" table
(p. 2): **Divisions 03, Districts 10, Sub Divisions (Tehsils) 35**.

---

## Division groupings

| Division | Districts |
|---|---|
| **Muzaffarabad** | Muzaffarabad, Neelum, Jhelum Valley |
| **Poonch** | Bagh, Haveli, Poonch, Sudhnoti |
| **Mirpur** | Kotli, Mirpur, Bhimber |

Primary source: *AJ&K Statistical Year Book 2023*, AJ&K Bureau of Statistics, P&DD —
**Table 7.10, "Division-wise Administrative Setup and District-wise Sub-Division, Union
Council & Villages of AJ&K (2022)"**, p. 92, which lists the districts under each division
with sub-totals (Muzaffarabad 7 tehsils / 74 UCs / 671 villages; Poonch 14 / 88 / 412;
Mirpur 11 / 116 / 686; grand total 10 districts / 32 tehsils / 278 UCs / 1,769 villages).
<https://pndajk.gov.pk/uploadfiles/downloads/AJ&K%20Statistical%20Year%20Book%202023(1).pdf>

Corroborated in prose by the same book, §1.13 "Administrative Setup of AJ&K", p. 5:
"Presently, AJ&K is divided into three divisions (Muzaffarabad, Poonch and Mirpur), with 10
administrative districts and 32 Sub-divisions having Muzaffarabad city as the State capital."

**Independently confirmed against OSM** (the project's boundary source) on 2026-08-01 via
Overpass: the three `admin_level=5` relations in AJK contain exactly these `admin_level=6`
members and no others.

| OSM division relation | `admin_level=6` children returned |
|---|---|
| 16344837 مظفرآباد ڈویژن / Muzaffarabad Division | Neelam Valley (8191217), Muzaffarabad (8191414), Hattian Bala (8192278) |
| 16343427 پونچھ ڈویژن / Poonch Division | Poonch (8191016), Bagh (8192015), Sudhanoti (8198049), Haveli (8199078) |
| 16342315 میرپور ڈویژن / Mirpur Division | Mirpur (8181854), Bhimber (8183916), Kotli (8184277) |

Query used (repeat per division id): `[out:json];area(id:3600000000+<rel>)->.a;
rel(area.a)[boundary=administrative][admin_level=6];out tags;` against
<https://overpass-api.de/api/interpreter>. OSM data © OpenStreetMap contributors, ODbL.

**OSM and the AJK government agree exactly on division membership.** The only differences are
in spelling (below).

### Tehsils per district (2022 set, 32 total)

From *AJ&K Statistical Year Book 2023*, Table 7.11, p. 92. Recorded because the AJK EC's
constituency notification is written in tehsils and patwar circles, not districts, and
because the 2025 publication's count of 35 tehsils implies three later additions we could
not enumerate.

| District | Tehsils (2022) |
|---|---|
| Muzaffarabad | Muzaffarabad, Naseerabad |
| Neelum | Athmuqam, Sharda |
| Jhelum Valley | Hattian, Chikar, Leepa |
| Bagh | Bagh, Dhirkot, Harighel |
| Haveli | Haveli, Khurshidabad, Mumtazabad |
| Poonch | Rawalakot, Hajira, Abbaspur, Thorar |
| Sudhnoti | Pallandari, Mung, Trarkhal, Baloch |
| Kotli | Kotli, Khuiratta, Charhoi, Darlia Jattan, Sehnsa, Fatehpur Thakyala |
| Mirpur | Mirpur, Dudyal |
| Bhimber | Bhimber, Barnala, Samahni |

---

## Coverage in the PBS 2023 Digital Census

The project's vintage rule requires that every district drawn have a 2023 census row. All ten
do.

1. **PBS counts 10 census districts for AJK.** *Number of Census Areas by Province/Area –
   2023*, Pakistan Bureau of Statistics: row "AZAD JAMMU & KASHMIR — 10 rural, 0 urban, **10**
   census districts; 102 charges; 468 circles; 4,124 blocks."
   <https://www.pbs.gov.pk/wp-content/uploads/2020/07/Number-of-Census-Areas-2023.pdf>

2. **In AJK, a census district *is* an administrative district.** *7th Population & Housing
   Census 2023 National Census Report*, PBS, §2 (methodology): "In Punjab, Sindh and Khyber
   Pakhtunkhwa, tehsils were declared as Census Districts, whereas in the rest of the country
   including Gilgit-Baltistan and Azad Jammu & Kashmir, Admn. districts were declared as
   Census Districts."
   <https://www.pbs.gov.pk/wp-content/uploads/2020/07/National-Census-Report-2023.pdf>

   Taken together: 10 administrative districts = 10 census districts, one-to-one. **No district
   needs folding into a parent.**

3. **Per-district 2023 population** is published by the AJK Bureau of Statistics and
   attributed there to PBS Census 2023 — the table reproduced above. AJK's own
   "Administrative Setup (2024)" table still shows 10 districts, so no post-census district
   creation had occurred as of that publication.

### What PBS itself does *not* publish for AJK

Checked on 2026-08-01:

- The **PBS census results portal** (<https://census23.pbos.gov.pk/>) returns **136 districts
  and 31 divisions**, none in AJK or GB. (Verified by calling its own dropdown endpoint,
  `POST /Misc/GetDropDownDataComp/` with `Level=2` and `Level=3`, and grepping the returned
  lists — the only near-misses are Mirpur Khas and Muzaffargarh.)
- PBS's release announcement for the detailed 2023 reports covers "Pakistan, Punjab, Sindh,
  Khyber Pakhtunkhwa, Balochistan, and Islamabad Capital Territory" only — **no AJK or GB
  report**.
  <https://www.pbs.gov.pk/release-of-national-and-provincial-census-reports-of-population-and-housing-census-2023-2/>
- Consequently the **mother-tongue table (Table 11)** and the **development indicators**
  (literacy 10+, improved drinking water, improved sanitation) could not be located for AJK
  districts in any PBS publication, and the AJK BoS publications examined carry census-2017
  literacy by district but no 2023 district-level literacy, water, sanitation or mother
  tongue.

  **Consequence for the app:** as things stand, AJK districts can be drawn and can carry
  population, but they have **no data to shade** under the Language basis or the Development
  basis. This is a real gap for #24/#30 and for the basis work, not a research shortfall to
  paper over. It needs an explicit product decision (hatched "no data" fill, or exclusion of
  AJK from those two bases' shading) rather than a substituted number.

---

## Name-join hazards

The bundle must not join AJK districts to census rows or to each other **by name**. Reasons:

1. **OSM's primary `name` tag for every AJK district and division is Urdu**, not English —
   e.g. `ضلع مظفر آباد` with `name:en=Muzaffarabad District`. Any join must read `name:en`,
   and must strip the trailing ` District` / ` Division`.
2. **Three genuine spelling divergences between OSM and the AJK government:**

   | AJK BoS (official) | OSM `name:en` | AJK Election Commission |
   |---|---|---|
   | Jhelum Valley | Hattian Bala District | (district not used; tehsil "Hattian" under Muzaffarabad) |
   | Neelum | Neelam Valley District | District Neelum Valley |
   | Sudhnoti | Sudhanoti District | Poonch & Sudhnuti District |

   Note also that AJK BoS itself spells the third district **"Jhelum Valley"** in *At a Glance*
   and **"Jehlum Valley"** in one table of the *Statistical Year Book 2023* (p. 47) — its own
   spelling is not stable.
3. **Cross-border collisions inside any bounding-box extract of the region.** Confirmed on
   2026-08-01 by Overpass over bbox `32.8,73.0,35.2,75.3`:
   - **Haveli** — Indian-administered J&K contains an `admin_level=6` relation named
     `Haveli tehsil` (OSM rel 10379058; Nominatim resolves it to "Haveli tehsil, Poonch,
     Jammu and Kashmir, 185101, India"). It sits at the **same admin level** as AJK's Haveli
     District. A level-6 bbox extract picks up both.
   - **Poonch** — Indian-administered J&K has a Poonch district (OSM rel 1944922, tagged
     `admin_level=5`), name-identical to AJK's Poonch District.
   - This is the same class of stray-geometry filtering already specified for the
     India/Afghanistan boundary in CLAUDE.md; it applies with extra force here because the
     names match exactly.
4. **Intra-Pakistan collisions** for fuzzy or prefix matching:
   - **Jhelum Valley** (AJK) vs **Jhelum** district and **Jhelum** tehsil in Punjab.
   - **Mirpur** (AJK) vs **Mirpur Khas** district *and* Mirpur Khas division in Sindh (both
     present in the PBS district list), and Mirpurkhas/Mirpur Mathelo place names.
   - **Haveli** (AJK) vs **Haveli Lakha** in Punjab; the AJK district's HQ, **Forward Kahuta**,
     is frequently written just "Kahuta", which is also a tehsil of Rawalpindi District,
     Punjab.
   - **Bagh** (AJK) vs numerous "Bagh" settlements elsewhere.

   **Recommendation for #3:** key AJK districts on their OSM relation id (listed in the
   division table above) and carry the AJK BoS official name as the display name, with the
   OSM/EC/Wikipedia variants as an alias list for search. Do not fuzzy-match.

---

## Discrepancies vs the from-memory list

From-memory list under review: *Muzaffarabad, Neelum, Hattian Bala, Mirpur, Bhimber, Kotli,
Poonch, Bagh, Haveli, Sudhanoti.*

| Aspect | Verdict |
|---|---|
| **Count (10)** | **Correct.** Confirmed by AJK BoS (Administrative Setup 2024) and independently by PBS (10 census districts). |
| **Set of entities** | **Correct.** All ten refer to real, current districts; there are no extras and none missing. |
| **"Hattian Bala"** | **Wrong as the official name.** The district's official name in AJK government publications is **Jhelum Valley**; Hattian Bala is the headquarters town and the tehsil (as "Hattian"). It is, however, the name OSM uses (`Hattian Bala District`), so both must be carried — official name for display, OSM name for the geometry join. |
| **"Sudhanoti"** | **Non-official spelling.** AJK BoS prints **Sudhnoti**; the AJK Election Commission prints **Sudhnuti**; OSM and Wikipedia print **Sudhanoti**. Use Sudhnoti as canonical, alias the rest. |
| **"Neelum"** | **Correct as written** (AJK BoS: *Neelum*), but note OSM says **Neelam Valley District** and the EC says **District Neelum Valley** — alias both. |
| **Division groupings** | **Absent from the from-memory list.** Now established: Muzaffarabad (3), Poonch (4), Mirpur (3). Note in particular that **Haveli sits in Poonch division, not Muzaffarabad** — an easy wrong guess given its northern position, and it matters for any variant stated in divisions. |
| **Anything requiring a fold-in** | **None.** All ten are 2023 census districts. |

Net: the from-memory list was **right about the hard part (which ten) and unreliable about
names**, and said nothing about divisions. Nothing in scenario tickets #24/#30 that depends
only on *which districts exist* needs revising; anything that renders or matches on district
*names* does.

---

## Sources

All accessed **2026-08-01**.

| # | Source | Publisher | Provenance class | URL |
|---|---|---|---|---|
| S1 | *Azad Jammu & Kashmir at a Glance – 2025* | AJ&K Bureau of Statistics, P&DD, Azad Govt. of the State of Jammu & Kashmir | Official (AJK government); relays PBS Census 2023 | <https://pndajk.gov.pk/uploadfiles/downloads/AJK%20At%20a%20Glance%202025.pdf> |
| S2 | *AJ&K Statistical Year Book 2023* | AJ&K Bureau of Statistics, P&DD | Official (AJK government) | <https://pndajk.gov.pk/uploadfiles/downloads/AJ&K%20Statistical%20Year%20Book%202023(1).pdf> |
| S3 | *Azad Jammu & Kashmir at a Glance – 2023* | AJ&K Bureau of Statistics, P&DD | Official (AJK government) | <https://www.pndajk.gov.pk/uploadfiles/downloads/AJK%20at%20a%20Glance%202023.pdf> |
| S4 | *Number of Census Areas by Province/Area – 2023* | Pakistan Bureau of Statistics | Official (federal, census) | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/Number-of-Census-Areas-2023.pdf> |
| S5 | *7th Population & Housing Census 2023 — National Census Report* | Pakistan Bureau of Statistics | Official (federal, census) | <https://www.pbs.gov.pk/wp-content/uploads/2020/07/National-Census-Report-2023.pdf> |
| S6 | Census 2023 results portal (district/division dropdown endpoints) | Pakistan Bureau of Statistics | Official (federal, census) | <https://census23.pbos.gov.pk/> |
| S7 | "Release of National and Provincial Census Reports of Population and Housing Census 2023" | Pakistan Bureau of Statistics | Official (federal, census) | <https://www.pbs.gov.pk/release-of-national-and-provincial-census-reports-of-population-and-housing-census-2023-2/> |
| S8 | *Delimitation of Constituencies — Final Notification 2020* (Notification No. EC/S/398-419/2020, 14-02-2020) | Azad Jammu and Kashmir Election Commission / Delimitation Commission | Official (AJK statutory body) | <https://ec.ajk.gov.pk/wp-content/uploads/2022/09/Delimitation-of-Constituencies-Final-Notification-2020.pdf> |
| S9 | OSM administrative relations for AJK, queried via Overpass | OpenStreetMap contributors (ODbL) | Project's own boundary source | <https://overpass-api.de/api/interpreter> |

### A caution about S8 (the Election Commission notification)

The AJK EC's 2020 delimitation notification is a primary legal instrument, but **its district
headings are not the current district set** and must not be used as one. It groups
constituencies under: `MIRPUR DISTRICT`, `BHIMBER DISTRICT`, `KOTLI DISTRICT`, `DISTRICT
BAGH`, `POONCH & SUDHNUTI DISTRICT`, `DISTRICT NEELUM VALLEY`, `DISTRICT MUZAFFARABAD` —
seven headings. Haveli appears inside the Bagh block ("LA-XVII, Bagh-IV — the whole Tehsil of
Haveli (Kahuta)…") and Hattian appears inside the Muzaffarabad block, i.e. the notification
still uses the **pre-2009 seven-district frame** for constituency nomenclature. It is cited
here only for official spellings ("Sudhnuti", "Neelum Valley", "Haveli (Kahuta)") and as
evidence of how volatile AJK district naming is across official bodies.

---

## What could not be resolved

Documented rather than guessed, per the project rule.

1. **No gazette notification for the 2009 creation of Haveli and Jhelum Valley districts.**
   Secondary sources date both to July 2009 (Haveli carved from Bagh, Jhelum Valley/Hattian
   Bala from Muzaffarabad), but no AJK gazette or departmental notification for either was
   findable online. **This does not affect the bundle** — both districts are current, both are
   2023 census districts — so no claim in the app needs to rest on the creation date. If a
   scenario card wants to state "created in 2009", that sentence is currently unsourced to a
   primary document and should be cut or hedged.
2. **PBS does not publish an AJK district table of its own that we could retrieve.** AJK
   district populations are therefore cited to **S1 (AJK BoS)**, which attributes them to PBS
   Census 2023. If provenance badging distinguishes "census" from "relayed by a subnational
   statistics office", AJK's population figures belong in the second bucket.
3. **No 2023-census mother tongue, literacy, drinking water or sanitation figures for AJK
   districts were found anywhere** — not from PBS, not from AJK BoS. Unresolved. See the
   consequence note above; it needs a product decision, and it is the single most likely thing
   in this document to block #24/#30.
4. **PBS census district codes for the ten AJK districts are unknown.** The public portal
   exposes codes only for the 136 province/ICT districts. Any district-code-based join in #3
   will need AJK codes assigned by the project (and labelled as project-assigned) unless PBS
   microdata surfaces them.
5. **Per-district area in km² was not found** in either AJK BoS publication examined (only the
   territory total, 13,297 km²). Derive from geometry if needed, and label it derived.
6. **The three tehsils added between the 2022 count (32) and the 2024 count (35) could not be
   identified.** Irrelevant to the district set; relevant only if tehsil geometry is ever used.
7. **Currency as of today (2026-08-01) rests on a 2025 publication describing the 2024 setup.**
   Searches for a newer AJK district or an eleventh district returned nothing, but absence of
   evidence is not a primary source. If AJK created a district in 2025–26, this document would
   not know — and under the vintage rule such a district would in any case be folded into its
   parent for statistics, exactly as CLAUDE.md prescribes for the new Balochistan divisions.
