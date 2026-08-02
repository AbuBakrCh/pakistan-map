/**
 * Entry point: the selection, and everything that answers to it.
 *
 * Runtime state is one value — the active basis and variant, or the baseline (D20). Nothing here
 * is a framework's job: a selection changes, four surfaces redraw, and each of them is told the
 * whole answer rather than a patch. The decisions those surfaces render are all upstream in
 * `lib/`, under test; what is here is the wiring.
 *
 * Provenance travels with every one of them. A basis shades districts, a variant draws provinces
 * that do not exist, and both are on screen at once — so the legend says what the colours mean,
 * the colophon says which table and whose proposal, and neither is allowed to fall out of step
 * with the map by being written once at load.
 */

import './styles.css';
import {
  censusStatistics,
  geographyTopology,
  provenance,
  scenarioBundle,
  unitOutlineBundle,
  type BasisId,
  type VariantRecord,
} from './bundle.ts';
import { shortFormExpansions } from './lib/labels.ts';
import { arcsOf, readLineOfControl } from './lib/line-of-control.ts';
import {
  motherTongueFills,
  motherTongueLegend,
  type DistrictFill,
  type LegendEntry,
} from './lib/mother-tongue.ts';
import {
  BASELINE,
  basisChoices,
  mapDescription,
  variantOf,
  type Selection,
} from './lib/selection.ts';
import type { UnitMembership } from './lib/tooltip.ts';
import { readUnitOutlines, unitBoundaries, unitByDistrict, unitLegend } from './lib/units.ts';
import { variantCard } from './lib/card.ts';
import { renderMap, type MapView } from './map.ts';
import { renderControls, renderVariantCard } from './panel.ts';

const mount = document.getElementById('map');
if (mount === null) throw new Error('#map is missing from index.html');
const controlMount = document.getElementById('controls');
if (controlMount === null) throw new Error('#controls is missing from index.html');
const cardMount = document.getElementById('card');
if (cardMount === null) throw new Error('#card is missing from index.html');

/**
 * What each basis shades districts with — and, by being the same object, which bases may be
 * selected at all.
 *
 * One entry today. The administrative, historical and development bases have their tables in the
 * bundle and no fill in the renderer, and the selector says exactly that rather than offering a
 * basis that would shade nothing. Stated once so the menu and the map cannot disagree: a basis
 * offered here and unshaded there is a basis that switches the boundaries back and explains
 * nothing.
 */
const FILLS: Partial<Record<BasisId, ReadonlyMap<string, DistrictFill>>> = {
  language: motherTongueFills(censusStatistics),
};
const SHADEABLE = new Set(Object.keys(FILLS) as BasisId[]);

/**
 * The ceasefire line's arcs, held out of every unit outline.
 *
 * Azad Jammu & Kashmir is a unit in every variant, and its outline runs along the Line of
 * Control. Stroking it solid over the dash would fill the dash's gaps in and leave a line that
 * looks like an international border, which is the one thing this map must not draw (D12).
 */
const locArcs = arcsOf(geographyTopology.objects['lineOfControl'] as never);

const choices = basisChoices(scenarioBundle, SHADEABLE);

/** Everything a selection puts on the map, assembled in one place so no half-view can exist. */
function viewFor(selection: Selection): MapView {
  const variant = variantOf(scenarioBundle, selection);
  const description = mapDescription(scenarioBundle, selection);
  if (selection === null || variant === null) {
    return { fill: null, units: null, boundaries: null, membershipOf: null, description };
  }

  const owner = unitByDistrict(variant);
  return {
    fill: FILLS[selection.basis] ?? null,
    units: readUnitOutlines(geographyTopology, unitOutlineBundle, variant.id),
    boundaries: unitBoundaries(geographyTopology, unitOutlineBundle, variant.id, locArcs),
    membershipOf: (district): UnitMembership => {
      const unit = owner.get(district);
      return {
        variant: variant.name,
        universe: variant.partition.universe,
        unit: unit === undefined ? null : { name: unit.name, kind: unit.kind },
      };
    },
    description,
  };
}

let selection: Selection = BASELINE;
const map = renderMap(mount, geographyTopology, censusStatistics, viewFor(selection));
const panel = renderControls(controlMount, scenarioBundle, choices, (next) => {
  selection = next;
  render();
});
const card = renderVariantCard(cardMount);

function render(): void {
  const variant = variantOf(scenarioBundle, selection);
  panel.show(selection);
  map.show(viewFor(selection));
  // The card is the argument the outlines are drawing, so it arrives and leaves with them: at the
  // baseline there is no proposal on screen and there is no card either (#19).
  card.show(variant === null ? null : variantCard(scenarioBundle, variant));
  renderLegend(selection, variant);
  renderColophon(selection, variant);
}

const swatch = (entry: LegendEntry): string =>
  entry.swatch.kind === 'colour'
    ? `<span class="swatch" style="background:${entry.swatch.colour}"></span>`
    : `<span class="swatch swatch-${entry.swatch.kind}"></span>`;
const item = (entry: LegendEntry): string =>
  `<span class="legend-item">${swatch(entry)}${entry.label}</span>`;

/**
 * The dashed line is drawn under every basis, so its legend entry survives every basis too.
 * Stratum 1 replaces what the fills mean, not what the lines mean: a ceasefire line with no key
 * is a line a reader is entitled to read as a border.
 */
const lineOfControlEntry = `
  <span class="legend-item"><span class="swatch swatch-dashed"></span>Line of Control —
    ceasefire line, not an international border</span>`;

function renderLegend(active: Selection, variant: VariantRecord | null): void {
  const legend = document.getElementById('legend');
  if (legend === null) return;

  if (variant === null || active === null) {
    legend.innerHTML = `
      <span class="legend-item"><span class="swatch swatch-province"></span>Province</span>
      <span class="legend-item"><span class="swatch swatch-territory"></span>Territory — not
        constitutionally a province</span>
      <span class="legend-item"><span class="swatch swatch-rule"></span>Division</span>
      ${lineOfControlEntry}
    `;
    return;
  }

  // Stratum 3 is keyed first and stratum 1 second, in the order a reader meets them: the outlines
  // are what the screen is about, and the fills are the evidence they are drawn against.
  const units = unitLegend(variant)
    .map(
      (entry) =>
        `<span class="legend-item"><span class="swatch swatch-${entry.swatch}"></span>${entry.label}</span>`,
    )
    .join('');
  const fill = active.basis === 'language' ? motherTongueKey() : { key: '', grouped: '' };
  // The grouped categories go last, after the line's own entry: they are the six a reader never
  // has to match to the map, and putting them mid-legend pushes the ones they do off the end.
  legend.innerHTML = `${units}${fill.key}${lineOfControlEntry}${fill.grouped}`;
}

/** Stratum 1's key under the language basis, in the census's own order. */
function motherTongueKey(): { key: string; grouped: string } {
  const { onTheMap, namedButNowhereDominant, absences } = motherTongueLegend(censusStatistics);
  return {
    key: `${onTheMap.map(item).join('')}${absences.map(item).join('')}`,
    grouped: `
      <span class="legend-group">
        <span class="legend-group-label">Named by the census, dominant in no district</span>
        ${namedButNowhereDominant.map(item).join('')}
      </span>`,
  };
}

function renderColophon(active: Selection, variant: VariantRecord | null): void {
  const colophon = document.getElementById('colophon');
  if (colophon === null) return;
  const { counts, sources, vintage, lineOfControl } = provenance;
  const loc = readLineOfControl(geographyTopology);
  colophon.innerHTML = `
    ${variant === null ? '' : variantProvenance(variant)}
    <p><strong>Boundaries</strong> OpenStreetMap, ODbL — ${counts['provinces']} provinces and
      territories, ${counts['divisions']} divisions, dissolved to the 2023 census set.
      Districts are not drawn on the baseline.</p>
    <p><strong>Kashmir</strong> Azad Jammu &amp; Kashmir and Gilgit-Baltistan are drawn and named
      but are not provinces, and are not shaded under any basis: PBS's 2023 results cover 136
      districts — the four provinces and Islamabad — so no figure exists for either. ${loc.properties.note}
      The line is not traced by hand: it is the ${lineOfControl.ways} OpenStreetMap ways that
      belong both to a drawn territory and to
      ${lineOfControl.againstRelations.map((r) => r.name).join(' or ')}, ${lineOfControl.lengthKm} km
      of boundary running along ${lineOfControl.alongDistricts.length} districts. South of its
      terminus on the Chenab, the Punjab–Jammu stretch is the Working Boundary and is a different
      line; it is not drawn dashed.</p>
    <p><strong>Vintage</strong> ${vintage}. Administrative units created since are folded into
      their 2023 parent, so the map is knowingly not today's map: the Balochistan restructuring
      of 8 July 2026 is not drawn.</p>
    <p><strong>On the map</strong> ${shortFormExpansions
      .map(([short, full]) => `${short} — ${full}`)
      .join(' · ')}. Names are shortened only where the full name is wider than the ground it
      names, and only to the form the unit uses for itself.</p>
    ${active?.basis === 'language' ? motherTongueProvenance() : ''}
    <p><strong>Sources</strong> ${sources['boundaries']} · roster: PBS.</p>
  `;
}

/**
 * Where the boundaries on screen came from, and that they are not the country's.
 *
 * The variant card (#19) is where the rationale, the advocacy and the opposition go. This is the
 * smaller obligation the working agreement puts on any surface at all: a heavy accent outline
 * drawn over Pakistan is a claim, and a claim carries its badge and its source in the same view
 * as itself — not one click away.
 */
function variantProvenance(variant: VariantRecord): string {
  const composition =
    variant.composition.kind === 'transcribed'
      ? `Transcribed from ${variant.composition.from}.`
      : `Derived — ${variant.composition.rule}, from ${variant.composition.from}.`;
  const folded = variant.units
    .flatMap((unit) => unit.folded)
    .map((fold) => `${fold.from} into ${fold.into}`);
  return `
    <p><strong>On screen</strong> ${variant.name} — a proposal, not official. ${composition}
      ${variant.badges.join(' · ')}. ${variant.counts.units} units, of which
      ${variant.counts.proposedUnits} proposed; stated as ${variant.counts.claimedDistricts}
      districts and drawn as ${variant.counts.drawnDistricts}${
        folded.length === 0 ? '' : `, folding ${folded.join(' and ')} under the 2023 vintage`
      }. ${variant.sources[0]?.label ?? ''}</p>`;
}

/**
 * No unsourced surface anywhere — including a shading. A fill on screen with no line saying
 * where it came from is exactly what the working agreement forbids, so the moment stratum 1 is
 * on, the colophon says which table it is, what its universe is, and where it is silent.
 */
function motherTongueProvenance(): string {
  const { source, universe, categories } = censusStatistics.motherTongue;
  const gap = (universe.population - universe.counted).toLocaleString('en-GB');
  return `
    <p><strong>Mother tongue</strong> ${source.split('.')[0]}. ${categories.length} categories,
      the census's own and unmerged. Its universe is ${universe.counted.toLocaleString('en-GB')} —
      ${gap} below Table 1's population, a difference PBS shares with Table 10 and does not
      explain, so it is stated and not closed. Khowar has no column, so the census names no
      dominant language in Chitral and the map says so rather than guessing one.</p>`;
}

render();
