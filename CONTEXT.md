# Pakistan Map

An explorer for curated, sourced proposals to redraw Pakistan's provinces. Users switch
between complete proposals and compare each against the map as it actually is.

## Language

### Geography

**District**:
The atomic building block. Every proposed boundary is composed of whole districts, because
every real proposal in Pakistan is stated in districts.
_Avoid_: zila, area, region, block, cell

**Division**:
The administrative tier between province and district. Rendered on the base map for
orientation only — it carries no statistics and nothing is composed from it.
_Avoid_: sub-province, region

**Province**:
An existing first-level administrative unit of Pakistan. Only ever refers to what exists
today, never to something proposed.
_Avoid_: state, region

**Territory**:
A first-level entity that is not constitutionally a province — Azad Kashmir, Gilgit-Baltistan,
Islamabad Capital Territory. Styled distinctly from provinces because calling them provinces
is factually wrong.
_Avoid_: province, region, area

**Line of Control**:
The ceasefire line east of Azad Kashmir and Gilgit-Baltistan. Always rendered dashed and
labelled, never as an international border.
_Avoid_: border, boundary, LoC border

### The model

**Unit**:
A proposed new province. Exists only inside a variant, never on the base map.
_Avoid_: province, new province, region, zone, entity

**Variant**:
A complete, named, sourced partition of Pakistan into units. Atomic — users switch between
variants and never edit them.
_Avoid_: scenario, proposal, preset, configuration, option

**Basis**:
The ground on which a variant's boundaries are argued — language, administrative, historical,
development. Selecting one determines both which variants exist and how districts are shaded.
_Avoid_: category, lens, mode, dimension, criterion

**Baseline**:
The default view — current provinces and divisions, named, with no variant active. What every
variant is compared against.
_Avoid_: default, current map, home, reset state

**Partition**:
The invariant that a variant assigns every district to exactly one unit. No gaps, no overlaps,
no unassigned territory.
_Avoid_: coverage, assignment, allocation

**Compare**:
The transient gesture (hold `Space`, or the button) that hides the data shading and unit
outlines to reveal the baseline. The only map comparison in the app.
_Avoid_: toggle, peek, reveal, diff

### Data integrity

**Badge**:
The provenance marker shown on every data surface, declaring what kind of claim it is —
`official`, `census`, `proxy`, `derived`, `documented`, `synthesized`, or a survey vintage.
_Avoid_: label, tag, source, chip

**Proxy**:
A badge meaning the displayed attribute stands in for one we cannot measure — mother tongue
for ethnicity, principally.
_Avoid_: estimate, approximation

**Synthesized**:
A badge meaning the variant was produced by applying a stated rule to real data, rather than
advanced by anyone. Distinct from a sourced proposal and must be labelled as such.
_Avoid_: generated, computed, derived, algorithmic

**Vintage**:
The date of the data behind a surface. Everything pins to the 2023 census; administrative
units created afterwards fold into their parent, because a unit with no census row cannot
carry a population.
_Avoid_: version, date, freshness, as-of

**Advocated by / Opposed by**:
The paired attribution lines every variant card carries. Both are required — without the
opposition line the app reads as advocating whatever is on screen.
_Avoid_: supporters, critics, pros and cons

### Rendering

**Stratum**:
One of the three stacked visual layers: district fill (data), current boundaries (faded), unit
outlines (prominent). Fill always shows data, never unit membership.
_Avoid_: layer, level, tier, z-layer

**Overlay**:
Not used as a noun for a separate control. The basis *is* the overlay — selecting a basis
shades the districts.
_Avoid_: as a distinct toggle or layer control

**Contiguity**:
Whether a unit's districts form a single connected region. Flagged on the variant scorecard,
never enforced.
_Avoid_: connectedness, adjacency (reserve *adjacency* for the precomputed district graph)

**Scorecard**:
The computed figures on a variant card — population spread, largest:smallest ratio, districts
moved, non-contiguous units.
_Avoid_: stats, metrics, summary
