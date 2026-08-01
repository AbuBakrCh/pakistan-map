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
Statistics join:       District                   ← the census publishes here
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

### L5 · Karachi / urban Sindh (Urdu-speaking)

**New unit: Karachi** — the 7 districts of Karachi Division: Karachi Central, Karachi East,
Karachi South, Karachi West, Korangi, Malir, Keamari.

**Status:** the long-standing MQM / MQM-P demand, raised repeatedly and as recently as 2026.
Framed by its advocates as a province for **urban Sindh** rather than Karachi alone, on the
basis of "mother tongue Sindh" and exchanged land. Their economic argument: one segment of
Karachi's population generates the large majority of Sindh's tax revenue while provincial
budget control sits elsewhere.
**⚠ Footnote required:** MQM-P's "urban Sindh" framing extends beyond Karachi Division to urban
Hyderabad, Sukkur and Mirpur Khas, but **no published district list exists** for that wider
claim. We draw the expressible core — Karachi Division — and say so on the card rather than
inventing the remainder.
**Advocated by:** MQM-P; historically MQM.
**Opposed by:** PPP, the Grand Democratic Alliance, and Awami Tehreek alike — Sindhi nationalist
opinion rejects any division of Sindh outright. This is close to a cross-party consensus in
rural Sindh and must be on the card.

### L6 · Pashtun Balochistan separates

**New unit:** the Pashto-plurality districts of northern Balochistan, determined from census
Table 11 — covering the Quetta, Pishin, Zhob and Loralai division areas, and excluding
Brahvi- and Balochi-plurality districts such as Mastung.

**⚠ Boundary is data-determined, not transcribed.** Unlike L1–L5 there is no published district
list for this claim, so the boundary follows census plurality. The card must say the line was
drawn from census data rather than copied from a proposal.
**Two readings, same territory:** advocates split between merging these districts into Khyber
Pakhtunkhwa and constituting them as a separate province ("Southern Pakhtunkhwa"). Territory is
identical either way, so it is one variant, with both readings named on the card.
**Status:** live since 1970, when Quetta and Kalat Divisions were merged to form Balochistan.
Khan Abdul Samad Khan Achakzai quit the National Awami Party in protest at the Pashtun belt
being merged into Baloch areas under the name Balochistan.
**Advocated by:** PkMAP and the Achakzai political tradition; Pashtun nationalist opinion.
**Opposed by:** Baloch nationalist parties, for whom Balochistan's territorial integrity is
foundational.

### L7 · Mother-tongue majority applied everywhere (~13 units)

Every district assigned by census plurality mother tongue, contiguity enforced.
Produces: Seraiki belt · Hindko (Hazara) · Urdu (Karachi) · Pashto units absorbing northern
Balochistan · Brahvi (Khuzdar/Kalat) · Balochi (Makran, Rakhshan, Nasirabad).

**Badge:** `census` · `synthesized` — a rule applied to census data, **not a proposal anyone
advances.** Copy must say so plainly.
**Relationship to L1–L6:** this is the only Language variant with no named advocate. Where its
output coincides with a real claim — the Seraiki belt, Hazara, Karachi, Pashtun Balochistan —
the card should point at the attributed variant rather than let the algorithm take credit for
someone's politics.
**Most contested unit:** Karachi. Sindhi nationalist opposition (PPP, GDA, Awami Tehreek)
applies here exactly as in L5.

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
| Amb, Phulra | *sub-district* (within Mansehra / Haripur) | **omitted** |

**Amb and Phulra are omitted**, with a footnote on the card naming them and stating why: they
are smaller than any district, so we cannot draw them without inventing a boundary. Consistent
with refusing to render what we can't source.

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

## Basis 4 — Development
Source: **PBS 2023 Census**, three district-level indicators · Badge: `census` · `synthesized`

| Indicator | Census measure |
|---|---|
| Literacy | Literacy rate, population aged 10+ |
| Water | Households with improved drinking water source |
| Sanitation | Households with improved sanitation |

All three are **published directly at district level** — no derivation, no latent variable.

**Named "Development", not "Economic" or "Poverty".** The census can see service access and
attainment. It cannot see income, consumption, child mortality or nutrition — the things that
make MPI a poverty measure. Shading a map from literacy and toilets and calling it poverty
would be a claim these three indicators can't support.

**MPI dropped entirely.** Earlier drafts used the national MPI (PSLM 2014/15, then 2019-20).
Replaced because the census gives one source and one vintage for the whole app, and because
three named published rates are more interrogable than a 15-indicator weighted composite with
censoring rules.

**Why `synthesized`:** the three rates are census figures, but combining them into one shading
is our choice — equal weighting is still a weighting. Therefore: the formula is stated on the
card, and **all three component rates show per district on hover**, so the composite is never
the only thing visible. Same badge and same reasoning as L7.

**Reservation retained.** Deprivation is arguably the true engine of the debate — the South
Punjab case is fundamentally about it, not language — but it doesn't form contiguous blocs the
way language does. Kept as a standalone basis with one variant.

### D1 · Development fault lines *(the only Development variant)*
Split each province where its internal development gradient is steepest — which independently
reproduces South Punjab, interior Sindh, and interior Balochistan **from indicators with no
linguistic or historical input at all.** That convergence is the most interesting single result
in the app: three service-access rates, measured for entirely unrelated reasons, land on
roughly the boundaries the political movements have been arguing for.

**Cut from the earlier draft:** quartile-banding (works as shading, weak as a partition) and
poorest-districts-as-one-unit (non-contiguous, would be flagged invalid).

---

## Count

| Basis | Variants |
|---|---|
| Language | 7 |
| Administrative | 5 |
| Historical | 4 |
| Development | 1 |
| **Total** | **17** |

---

## Open items

Both are verification tasks for build time, not decisions.

1. **AJK district list** (Muzaffarabad, Neelum, Hattian Bala, Mirpur, Bhimber, Kotli, Poonch,
   Bagh, Haveli, Sudhanoti) is from memory — **verify against a primary source.**
2. **Balochistan's 11-division / expanded-district set** needs verification; Wikipedia and OSM
   disagree and it is the most recently churned region in the country.

## Resolved

- **Amb and Phulra** — omitted with a footnote naming them (H2)
- **Economic basis** — kept standalone, rebuilt from the **2023 census** (literacy, water,
  sanitation) and renamed **Development**; MPI dropped
- **Karachi** and **Pashtun Balochistan** — promoted from algorithmic by-products of L7 to
  attributed variants with named advocates and named opposition

## Resolved by moving to districts

- ~~L3 over-inclusion of the Waziristans~~ — exactly expressible
- ~~Princely states smaller than divisions~~ — all but Amb and Phulra
- ~~Sub-block mechanism~~ — deleted, never needed
- ~~Deprivation data aggregated above its published resolution~~ — joins natively at district level
- ~~Division-layer vintage alignment~~ — divisions carry no data
