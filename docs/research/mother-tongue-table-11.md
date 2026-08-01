# PBS Census-2023 Table 11 — mother tongue

What the language basis is shaded from, what the published table does and does not contain, and
the four places where it disagrees with itself or with Table 1. Written while implementing #10.

## Where the numbers come from

| | |
|---|---|
| Table | PBS Census-2023 **Table 11** — population by mother tongue, sex and rural/urban |
| Structured copy | `PakPC2023` 0.2.0 (CRAN, GPL-2), object `TABLE_11` |
| Committed as | `data/raw/pakpc2023-table-11.RData`, the package's own file byte-for-byte |
| Verify | `md5 data/raw/pakpc2023-table-11.RData` → `da7f29dc1a8c5e58b11cbb3f4d90f1a6`, which is the line for `data/TABLE_11.RData` in the package's `MD5` manifest |
| Anchor figures | [`table_11_national.pdf`](https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_11_national.pdf), typed into `scripts/join-census.ts` |

The file is **xz-compressed**, unlike the package's three `PakPC2023Pak*` tables, which are gzip.
Node's `zlib` has no xz, so the build decompresses it with `xz-decompress` rather than committing
a re-compressed copy — the point of committing upstream bytes is that the MD5 above matches
CRAN's, and a conversion of ours would put a step nobody can check between the two.

## The published table has no district tier

Table 11 in the package is **tehsil-level only**: 9,456 cells, being 591 units × 16 categories.
`ADMIN_UNIT` runs `SUB-DIVISION`, `TEHSIL`, `SUB-TEHSIL`, `SUB-DIVISION_CITY`, `TALUKA`,
`DE-EXCLUDED_AREA` — no `DISTRICT` row, and no division, province or national row either. The
district tier this project shades by therefore does not exist upstream and is **summed from the
tehsils**.

Two things make that safe rather than hopeful:

- The `DISTRICT` column carries exactly **136 distinct names**, which is the 2023 census district
  set — so the tehsils are already grouped by the atom we need, and no district has to be guessed
  at from geometry.
- The sums reconcile **exactly** against the province figures PBS printed, in **all fifteen
  categories for all five provinces**, and hence at the national total. Column by column matters:
  a tehsil summed into the wrong district inside a province moves whole languages while leaving
  the province total untouched, so a check on totals alone would not see it.

`PROVINCE` and `DIVISION` are **null** on 192 rows (twelve units, Chaman's among them) and on
every row of Tando Allah Yar, whose 922,012 people would otherwise vanish from Sindh. The join
takes province from the roster, never from the row.

There is a district-level PBS source — `table_11_<province>_districts.pdf`, four files of ~3.5 MB
each. Not used: they are PDFs of the same figures, and a PDF-scraping step would be a second,
less reliable path to a tier that already reconciles exactly.

## Four things upstream gets wrong, or does not explain

### 1. Table 11 counts 1,041,342 fewer people than Table 1

Table 11's universe is **240,458,089**. Table 1's population is **241,499,431**.

The gap is not foreigners: Table 10 (nationality) prints the *same* 240,458,089 — 238,332,010
Pakistani, 1,923,453 Afghani, 26,900 Bangali, 3,568 Chinese, 172,158 other. So Tables 10 and 11
share a universe and both differ from Table 1 by an amount PBS does not explain anywhere we
found.

The build states the difference and does not close it. Shares are shares of the universe the
table itself publishes; inventing a "not reported" residual would be putting a figure on the map
that PBS never printed.

### 2. The gap is not spread evenly

Coverage against each district's own 2023 population, lowest first:

| District | Table 11 counts | Population | Coverage |
|---|---:|---:|---:|
| Kolai Pallas Kohistan | 236,726 | 280,162 | 84.5% |
| Quetta | 2,271,290 | 2,595,492 | 87.5% |
| Upper Kohistan | 374,183 | 422,947 | 88.5% |
| Lower Kohistan | 303,305 | 340,017 | 89.2% |
| Islamabad | 2,283,244 | 2,363,863 | 96.6% |

Shares within a district are still shares of that district's own counted population, so a
dominant language is unaffected by how many people the table missed. It is worth knowing before
anyone treats `counted` as a population.

### 3. Four districts are counted *above* their own population

Malir +15,777, Toba Tek Singh +12,081, Surab +946, Kachhi (Bolan) +62.

A table cannot cover more people than live somewhere, so this is upstream disagreeing with
itself — most plausibly a tehsil attributed to a neighbouring district, which is consistent with
the province columns all reconciling exactly. The artifact names them under
`motherTongue.districtsCountedAbovePopulation` rather than smoothing them, and the largest is
0.6% of its district.

### 4. One unit's `TOTAL` row contradicts its own languages

Rajanpur tehsil: the published `TOTAL` is **851,729**, its fifteen language rows sum to
**893,470** — 41,741 apart. Every other one of the 590 units agrees with itself.

The build never reads the `TOTAL` row. District totals are summed from the language columns,
which is the side that reconciles to the published province figures.

## Two districts the census names no language for

Khowar has **no column in Table 11**. Chitral's population lands in `Others`:

| District | `Others` | Largest named | Counted |
|---|---:|---|---:|
| Upper Chitral | 194,851 (99.8%) | Urdu, 150 | 195,161 |
| Lower Chitral | 279,298 (87.8%) | Pushto, 29,799 | 318,234 |

So `dominant` is **`null`** for both, and the fill has to say the census does not name it.
Handing the label to the largest named category would print "Upper Chitral: Urdu" on a district
where 150 people out of 195,161 speak it — a false claim, produced by an `argmax` nobody
questioned. `Others` cannot take the label either: it is a residual, not a language.

The same shape shows up benignly elsewhere — Kolai Pallas Kohistan and Upper Kohistan are
overwhelmingly `Kohiostani`, which *is* a column, so they are named.

## Categories

Fifteen, in the census's own order and the census's own spelling:

> Urdu · Punjabi · Sindhi · Pushto · Balochi · Kashmiri · Saraiki · Hindko · Brahvi · Shina ·
> Balti · Mewati · Kalasha · Kohiostani · Others

`Kohiostani` is PBS's spelling of Kohistani and is reproduced, not corrected. Nothing is merged:
whether Hindko is Punjabi, or Brahvi belongs with Balochi, is a live argument in Pakistan, and
this app reports the census's answer rather than adjudicating (D4/D5). A category appearing in a
future release that this build does not know **fails the build** rather than falling into
`Others`, which would publish a distribution silently missing a language PBS chose to name.
