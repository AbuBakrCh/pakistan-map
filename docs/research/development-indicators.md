# PBS Census-2023 Tables 12, 23 and 24 — development indicators

What the development basis is shaded from, which published columns exist and which do not, and
the three places where the census disagrees with itself. Written while implementing #11.

## Where the numbers come from

| | |
|---|---|
| Literacy | PBS Census-2023 **Table 12** — literacy rate, enrolment and out-of-school population by sex and rural/urban |
| Drinking water | PBS Census-2023 **Table 23** — housing facilities by source of drinking water by region |
| Sanitation | PBS Census-2023 **Table 24** — housing characteristics, facilities of toilet and washroom used by households, rural/urban |
| Structured copy | `PakPC2023` 0.2.0 (CRAN, GPL-2), objects `TABLE_12`, `TABLE_23`, `TABLE_24` |
| Committed as | `data/raw/pakpc2023-table-{12,23,24}.RData`, the package's own files byte-for-byte |
| Verify | `md5 data/raw/pakpc2023-table-12.RData` → `9bf094d3316c0a8de46ca434c7233204`; table 23 → `b2358aa248f7b70ca35db56ebcfc716f`; table 24 → `ae3d7db89dc0a552cfa16f8b3dd04c36`. Each is the line for `data/TABLE_NN.RData` in the package's `MD5` manifest |
| Anchor figures | [`table_12_national.pdf`](https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_12_national.pdf), [`table_23_national.pdf`](https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_23_national.pdf), [`table_24_national.pdf`](https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_24_national.pdf), typed into `scripts/join-census.ts` |

All three are **xz**-compressed, like Table 11 and unlike the three `PakPC2023Pak*` summary
tables. The build decompresses them with `xz-decompress` rather than committing a re-compressed
copy, so the MD5s above match CRAN's.

## None of the three has a district tier

Same shape as Table 11: **591 tehsil-level units, no district row**, and no division, province or
national row either. Table 12 publishes 8,865 rows (591 × 15 indicators), Tables 23 and 24 publish
1,773 each (591 × `OVERALL` / `RURAL` / `URBAN`). The `DISTRICT` column carries exactly the **136**
2023 census district names in all three, so the district tier this project shades by is **summed
from the tehsils** under them.

Units are keyed on `DISTRICT | TEHSIL | ADMIN_UNIT`, all three. Rajanpur is published as both a
`TEHSIL` (129,625 households) and a `DE-EXCLUDED_AREA` (6,438) under the same district-and-tehsil
name; a two-part key drops one of them, which is exactly the mistake `mother-tongue-table-11.md`
records having made once already.

`PROVINCE` and `DIVISION` are **null** on twelve units, Chaman's and all three of Tando Allahyar's
among them. The join takes province from the roster, never from the row — as the mother-tongue
join does.

## What reconciled, against what

Counts, never rates. A province literacy rate is not the mean of its districts' rates; it is
literate people over people, so the only checkable figures are **both halves of every rate**, and
PBS prints both. The build sums the districts and compares eight counts against the five province
rows and the national row typed from the PDFs — from outside the `PakPC2023` package, so this
checks the package as well as the join.

| Count | Table | Punjab | Sindh | KP | Balochistan | ICT | Pakistan |
|---|---|---|---|---|---|---|---|
| Population 10+ | 12 | ✓ | ✓ | ✓ | ✓ | ✓ | 171,714,532 ✓ |
| Literate 10+ | 12 | ✓ | ✓ | ✓ | ✓ | ✓ | 104,148,094 ✓ |
| Households | 23 & 24 | ✓ | ✓ | ✓ | ✓ | ✓ | 38,292,556 ✓ |
| Improved drinking water | 23 | **+2,226** | **+1,458** | **+1,151** | **+1,513** | **+26** | 35,200,804 vs **35,194,430** |
| Flush toilet | 24 | ✓ | ✓ | ✓ | ✓ | ✓ | 30,870,460 ✓ |
| Non-flush toilet | 24 | ✓ | ✓ | ✓ | ✓ | ✓ | 2,499,076 ✓ |
| No toilet | 24 | ✓ | ✓ | ✓ | ✓ | ✓ | 4,923,020 ✓ |
| Separate toilet | 24 | ✓ | ✓ | ✓ | ✓ | ✓ | 26,007,432 ✓ |

Seven of the eight are exact, to the person and to the household. The eighth is below.

Two further consistency checks hold at district level and fail the build if they stop:
flush + non-flush + none equals the household total in all 136 districts, and Tables 23 and 24
publish the **same** household count for every one of them.

## Three things upstream does not explain

### 1. Table 23 disagrees with Table 23 about improved water, by 6,374 households

PBS's **tehsil-level** release of Table 23 counts **35,200,804** improved-drinking-water
households. PBS's **printed province** table for the same table counts **35,194,430** — 6,374
fewer, and the tehsil rows are higher in all five provinces.

It is a reclassification, not a missing unit:

- The household totals reconcile **exactly**, tier by tier.
- The nine source columns — inside, outside, tap water, motor pump, dug well, filtration plant,
  bottled water, others — each differ between the two releases, and within every province the
  differences **cancel to zero**. Punjab, for instance: motor pump +39,610, tap water −22,245,
  filtration plant −12,267, others −3,666, bottled −1,030, dug well −402. Inside and outside
  differ by +28,657 and −28,657 exactly.

So a few thousand households are classified under different sources in the two releases, and the
improved/not-improved line moved with them. Nothing here can say which release is right, and
6,374 is 0.017% of the households in question.

The build **pins the five deltas** and reconciles against published-plus-delta, failing on any
other value. That is stronger than a tolerance: a tehsil actually going missing changes the delta
and stops the build, and a future release that closes the gap stops it too rather than passing
quietly. The artifact states both figures under `development.improvedWaterDifference`.

### 2. The housing tables count 48,010 fewer households than the district table

Tables 23 and 24 publish **38,292,556** households. `PakPC2023PakDist` — the table the bundle's
`households` field comes from — publishes **38,340,566**. The two differ in **all 136 districts**,
not in a few:

| District | Housing tables | District table | Difference |
|---|---:|---:|---:|
| Upper Kohistan | 63,712 | 71,543 | −7,831 |
| Kolai Pallas Kohistan | 33,983 | 40,393 | −6,410 |
| Karachi East | 659,389 | 665,452 | −6,063 |
| … | | | |
| Toba Tek Singh | 393,896 | 391,861 | +2,035 |
| Malir | 421,426 | 416,512 | +4,914 |

PBS does not explain it, and the two most positive districts here are also two of the four that
Table 11 counts *above* their own population — Malir and Toba Tek Singh — which is at least
consistent with tehsils attributed differently between releases.

The consequence for this join is a rule, not a correction: **the water and sanitation shares are
taken over the housing tables' own household count**, which is emitted beside them, and the
district table's `households` is left alone. Mixing the two would put a numerator from one release
over a denominator from another.

### 3. Literacy's denominator is not the district population

Table 12 publishes literacy over **population aged 10 and above** — 171,714,532 nationally against
Table 1's 241,499,431 population. That is PBS's own definition and is reproduced, but it means
`development.literacy.population10Plus` is not comparable with `population`, and a rate computed
against the latter would be wrong by roughly a third.

## PBS publishes no improved-sanitation figure

This is the one place the issue's wording and the census part company, and it is worth being plain
about.

For **drinking water**, PBS classifies sources as improved or not and prints the result:
`DRINK_WTR_IMPROVE` is a published column. For **toilets** it does not. Table 24 prints four
counts — separate toilet, flush toilet, non-flush toilet, no toilet — and a non-flush toilet may
be improved (a pit latrine with a slab) or unimproved (an open pit). The census does not say
which, and no other 2023 table does either.

So there is **no improved-sanitation figure to join**. Adding flush to non-flush would be this
project's own definition of "improved" wearing a `census` badge, on the one indicator where the
answer would change a district's colour. What the bundle carries instead:

- all four published counts, as published;
- `flushToiletShare` — the share the map shades by, named as what it is;
- `noToiletShare` beside it, the one category nobody can misread.

`separateToilet` is orthogonal to the other three (it says a toilet is not shared with another
household, not what kind it is) and is carried but not partitioned with them.

## The composite (#31)

Built, and built as its own artifact: `data/bundle/development-index.json`, from
`scripts/lib/development-index.ts`. It is the **unweighted mean of the three rates above** —
literacy (10+), improved drinking water, and the flush-toilet share — each keeping the denominator
PBS gave it, which means the result is a mean of three proportions and not a proportion of anything.
Hence *index*, never *rate*.

Three choices, each made because the census gives no basis for the alternative:

| Choice | Why not otherwise |
|---|---|
| **Unweighted** | A weighted mean claims literacy is worth some stated amount more than a toilet, and no source states that number. Equal weights are also a claim — the difference is that this one fits in a sentence, and the tooltip shows all three components so a reader can disagree with it |
| **PBS's own denominators** | Mixing a numerator from one release with a denominator from another is the mistake this document already records once |
| **Not re-scaled to the observed range** | A district's score would move because another district moved, and the legend would mean something different at each census |

Badged **`synthesized`**, which is what that badge is in the vocabulary for: no published source
states this figure. Shaded in four bands at fixed cuts — under 50%, 50–65%, 65–80%, 80% and above —
rather than quantiles, so a district's colour is not a function of every other district's score.

Observed range on this census: **Kohlu 27.2%** to **Karachi Central 93.1%**, with 26 / 32 / 37 / 41
districts in the four bands. AJK and Gilgit-Baltistan have no composite at all, because they have
none of the three rates.

It is not a poverty measure and no surface in the app calls it one — see the last section of this
document, which is the whole reason the basis is named *Development*.

## Rates

Every share in the artifact is a **proportion in 0–1**, rounded to six places, recomputed from the
summed counts and never averaged across tehsils. Averaging the 591 published percentages would
weight Zamoran's few thousand people like Lahore's millions; summing the counts and dividing once
*is* the population-weighted rate.

Table 12 does publish a `Literate %` per tehsil. It agrees with its own counts to within **0.005
percentage points** across all 591 units — checked, and then not used, because the district tier
it would be needed for does not exist upstream.

The range each indicator actually covers, for a sanity check against the fill:

| Indicator | Lowest | Highest |
|---|---|---|
| Literacy (10+) | Kolai Pallas Kohistan 18.8% | Islamabad 84.0% |
| Improved drinking water | Upper Kohistan 26.1% | Shikarpur 99.1% |
| Flush toilet | Panjgur 22.5% | Karachi Central 97.4% |

## AJK and Gilgit-Baltistan

Absent, not zero (D25). All three tables cover the four provinces and ICT — the same 136 districts
— so no AJK or GB district has a literacy, water or sanitation figure. A zero would shade twenty
districts as the worst in Pakistan on every indicator at once.

## Why *Development* and not *Poverty*

The census sees **service access**. It does not see income, consumption, child mortality or
nutrition, and three access indicators cannot carry the word poverty. MPI was dropped in favour of
one source and one vintage.
