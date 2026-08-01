# Scenario Draft — district resolution

Status: **draft for approval.** No application code written yet.

Rewritten from the division-level draft, which broke on its first scenario. Every scenario
below is a complete partition of Pakistan expressed in **districts**, because that is how
every real proposal is stated.

---

## Resolution model

```
Base map (rendered):   Province └── Division      ← current-day, reference only, carries no data
Building block:        District                   ← every unit is composed of these
Statistics join:       District                   ← census + MPI both publish here
```

**The division layer carries no statistics.** That falls out of the district move and it
matters, because the division layer is genuinely unstable:

- **Mianwali Division** and **Banbhore Division** (Sindh) exist in OSM but not in current
  listings — both created ~2023, subsequently reverted.
- **Balochistan has restructured to 11 divisions** with many new districts.

Since divisions are now pure reference, we render the **current-day** set and let the census
join happen entirely at district level. No vintage alignment needed on the division layer.

**District vintage rule (unchanged):** districts created after the 2023 census fold into their
parent for statistics. Affects Taunsa, Kot Addu, Talagang, Wazirabad, Murree, Paharpur, Allai,
Upper Swat, Central Dir, and most of the new Balochistan set.

---

## Basis 1 — Language / dialect
Source: PBS 2023 Census **Table 11**, mother tongue by district · Badge: `census` · `proxy`

### L1 · South Punjab Secretariat — *the version that partly exists*

**New unit: South Punjab** — 13 districts

| Division | Districts |
|---|---|
| Multan | Multan, Lodhran, Khanewal, Vehari |
| Bahawalpur | Bahawalpur, Bahawalnagar, Rahim Yar Khan |
| Dera Ghazi Khan | Dera Ghazi Khan, Layyah, Muzaffargarh, Rajanpur, Taunsa, Kot Addu |

**Status:** a separate civil secretariat covering exactly these three divisions has been
operational since **15 October 2020**. Also the PTI position.
**⚠ Footnote required:** sources say *"11 districts"* — that was the pre-2022 count, before
**Taunsa** and **Kot Addu** were carved out. Same territory, 13 districts today. The card must
say so or it looks like we miscounted.
**Advocated by:** PTI; operational as a secretariat under multiple governments.
**Opposed by:** central Punjab political interests; opponents of Punjab's division generally.

### L2 · PPP reading

**New unit: South Punjab** — L1 **+ Mianwali, Bhakkar** = 15 districts
*(both now sit in Sargodha Division)*

**Status:** PPP position — "13 districts", being the pre-2022 11 plus Mianwali and Bhakkar.
**Contested edge:** Mianwali and Bhakkar. Local opinion there has publicly rejected inclusion
in South Punjab, citing Potohar/Punjabi identity.
**Opposed by:** as L1, plus organised local opposition within Mianwali and Bhakkar themselves.

### L3 · Saraikistan Qaumi Council — maximal ✅ *now exactly expressible*

**New unit: Saraikistan** — L2 **+ Dera Ismail Khan, Tank, Paharpur** (from KP) = 18 districts

**Explicitly excluded: Upper South Waziristan and Lower South Waziristan** — 888,675 people,
**95.5–97.8% Pashto-speaking**, which the claim has never included.

This was unbuildable at division resolution: D.I. Khan *Division* contains the Waziristans, so
the app would have shaded those districts Pashto (stratum 1) while enclosing them in a Seraiki
province (stratum 3) — a self-contradiction visible on screen, defaming advocates who never
made that claim. At district resolution the boundary lands exactly where the movement puts it.

**Significance:** the only scenario in the app where a proposed province **crosses an existing
provincial boundary**. Without it, the app would imply new provinces are only ever carved from
within existing ones, which is false.
**Advocated by:** Saraikistan Qaumi Council.
**Opposed by:** KP parties across the spectrum; Pashtun nationalist opinion in D.I. Khan.

### L4 · Hazara (Hindko)

**New unit: Hazara** — the 9 current districts of Hazara Division: Abbottabad, Haripur,
Mansehra, Battagram, Torghar, Allai, Upper Kohistan, Lower Kohistan, Kolai-Palas.

**Status:** movement founded 1987 (Hazara Qaumi Mahaz); mass mobilisation April 2010 after
NWFP was renamed Khyber Pakhtunkhwa. **On 12 April 2010 police fired on demonstrators in
Abbottabad, killing seven.**
**⚠ Footnote required:** the movement names *"six districts"* — Haripur, Abbottabad, Mansehra,
Battagram, Kohistan, Torghar. Kohistan has since split three ways and Allai was created, so the
same territory is 9 districts today.
**Advocated by:** Hazara Qaumi Mahaz; broad cross-party support within the division.
**Opposed by:** Pashtun nationalist parties (ANP), for whom KP's territorial integrity is tied
to the province's Pashtun identity.

### L5 · Mother-tongue majority applied everywhere (~13 units)

Every district assigned by census plurality mother tongue, contiguity enforced.
Produces: Seraiki belt · Hindko (Hazara) · Urdu (Karachi) · Pashto units absorbing northern
Balochistan · Brahvi (Khuzdar/Kalat) · Balochi (Makran, Rakhshan, Nasirabad).

**Badge:** `census` · `synthesized` — a rule applied to census data, **not a proposal anyone
advances.** Copy must say so plainly.
**Real-world anchors it echoes:** Pashtun nationalist demands (Achakzai onward) that
Balochistan's Pashtun belt join KP or form "Southern Pakhtunkhwa"; MQM-P's standing demand for
an urban/Urdu-speaking province in Sindh.
**Most contested unit:** Karachi (7 districts — Central, East, South, West, Korangi, Malir,
Keamari). Sindhi nationalists across PPP, GDA and Awami Tehreek reject any division of Sindh
outright. That line must appear on the card.

---

## Basis 2 — Administrative
Source: 2023 census population + derived geometry · Badge: `census` · `derived`

**Generated by stated rule, not hand-drawn.** Each variant declares a constraint; composition
is computed at build time under contiguity. Reproducible, and my editorial hand is out of it.
Working over ~165 districts rather than 40 divisions produces far more sensible equal-population
units — a direct benefit of the resolution change.

Anchoring facts for copy: Punjab alone is **~128M** governed from Lahore. Division populations
range **6M–24M in Punjab**, 4M–20M in Sindh, 3M–10M in KP, 0.9M–4M in Balochistan. The standard
published argument: four provinces served 60M in 1970; at 240M, Pakistan needs **12–14**.

| # | Rule | Approx. units |
|---|---|---|
| **A1** | No unit exceeds 25M | ~9 |
| **A2** | Twelve units, population as equal as contiguity allows | 12 |
| **A3** | Fourteen units | 14 |
| **A4** | No district further than ~300km from its unit capital | computed |

### A5 · Constitutional regularisation (9 units)
Gilgit-Baltistan (10 districts) and Azad Kashmir (10 districts) become full provinces.
**Status:** live. Provisional provincial status announced by PM Imran Khan **1 November 2020**;
draft 26th Amendment prepared; GB Legislative Assembly passed a unanimous resolution.
**Opposed by:** India, which rejects any change to the status of these territories.
**Note:** LoC treatment (dashed, labelled) is identical in this scenario.

---

## Basis 3 — Historical
Source: documented past demarcations, 1947 onward · Badge: `documented`

### H1 · One Unit, 1955–1970 (1 unit)
All of West Pakistan consolidated **14 October 1955**; dissolved **1 July 1970**. The whole map
goes to one colour — visually the most dramatic scenario in the app.

### H2 · 1947–1955, provinces and princely states ✅ *mostly resolved*

Punjab, Sindh, NWFP, Balochistan, plus states that acceded between **August 1947 and March 1948**
retaining internal self-government:

| State | Districts today | Status |
|---|---|---|
| Bahawalpur | Bahawalpur, Bahawalnagar, Rahim Yar Khan | ✅ clean |
| Khairpur | Khairpur | ✅ clean |
| Kalat | Kalat, Khuzdar, Wadh, Surab | ✅ approximate |
| Las Bela | Lasbela, Hub | ✅ clean |
| Kharan | Kharan, Washuk | ✅ clean |
| Makran | Kech, Gwadar, Panjgur, Tump | ✅ clean |
| Swat | Swat, Upper Swat, Shangla, Buner | ✅ approximate |
| Dir | Lower Dir, Upper Dir, Central Dir | ✅ clean |
| Chitral | Upper Chitral, Lower Chitral | ✅ clean |
| **Hunza** | **Hunza** | ✅ **now its own district** |
| **Nagar** | **Nagar** | ✅ **now its own district** |
| Amb, Phulra | *sub-district* (within Mansehra / Haripur) | ⚠ **still unresolvable** |

**Remaining ruling needed:** Amb and Phulra. Options — (a) omit with a footnote listing them,
(b) render as labelled points rather than areas, (c) fold into Hazara silently. My
recommendation: **(a)**, consistent with refusing to draw what we can't source.

**⚠ Hard rule for this scenario: attach no modern population figures.** 2023 census numbers do
not describe 1947 boundaries. Card shows area and composition only.

### H3 · 1970 restoration (6 units)
Punjab, Sindh, NWFP, Balochistan restored, with FATA and the Northern Areas separate — the map
before the 2018 FATA merger and before GB's renaming. Shows how much has *already* changed
without any new province being created.

### H4 · Bahawalpur restored (5 units)
**New unit: Bahawalpur** — Bahawalpur, Bahawalnagar, Rahim Yar Khan.
**Status:** a province in its own right **1947–1955** before absorption into One Unit. The
restoration movement dates from 1970; Bahawalpur Muttahida Mahaz won **4 National Assembly and
9 provincial seats** in the 1970 election on it. It remains near-impossible to win a seat in the
region while opposing it. PML-N's position is two provinces — Bahawalpur separate, and a South
Punjab of Multan + D.G. Khan.
**Collision with L1–L3:** Bahawalpur advocates explicitly reject being folded into a Seraiki
province. Different bases, so the app never draws both — the Q8/Q9 behaviour working as intended.

---

## Basis 4 — Economic
Source: district MPI (Planning Commission + OPHI, 15 indicators) · Badge: `survey 2014/15`

**Now on firmer ground:** MPI is published at district level *only*, so at division resolution
we'd have been aggregating a survey to a resolution it was never published at. The district move
fixes that.

**Still a reservation.** Deprivation is arguably the true engine of the debate — the South Punjab
case is fundamentally economic, not linguistic — but it doesn't form contiguous blocs the way
language does.

### E1 · Deprivation fault lines *(recommended: the only Economic variant)*
Split each province where its internal deprivation gradient is steepest — which independently
reproduces South Punjab, interior Sindh, and interior Balochistan **from a data source with no
linguistic or historical input at all.** That convergence is the most interesting single result
in the app.

**Cut from the earlier draft:** quartile-banding (works as an overlay, weak as a partition) and
poorest-divisions-as-one-unit (non-contiguous, would be flagged invalid).

**Open question:** does one variant justify a standalone basis, or should this fold into Language
and Administrative as supporting evidence on their cards?

---

## Count

| Basis | Variants |
|---|---|
| Language | 5 |
| Administrative | 5 |
| Historical | 4 (H2 pending the Amb/Phulra ruling) |
| Economic | 1 |
| **Total** | **15** |

---

## Open items

1. **H2 — Amb and Phulra** are sub-district. Omit with footnote *(recommended)*, render as
   points, or fold into Hazara.
2. **Economic** — keep as a standalone basis with one variant, or fold into the others?
3. **AJK district list** (Muzaffarabad, Neelum, Hattian Bala, Mirpur, Bhimber, Kotli, Poonch,
   Bagh, Haveli, Sudhanoti) is from memory — **verify at build time.**
4. **Balochistan's 11-division / expanded-district set** needs verification against a primary
   source; Wikipedia and OSM disagree and it's the most recently churned region.

## Resolved by moving to districts

- ~~L3 over-inclusion of the Waziristans~~ — exactly expressible
- ~~Princely states smaller than divisions~~ — all but Amb and Phulra
- ~~Sub-block mechanism~~ — deleted, never needed
- ~~MPI aggregated above its published resolution~~ — joins natively
- ~~Division-layer vintage alignment~~ — divisions carry no data
