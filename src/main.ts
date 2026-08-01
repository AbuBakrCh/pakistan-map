/**
 * Entry point. Mounts the baseline map and writes the page's own provenance, which is read out
 * of the bundle rather than typed here — no unsourced surface, including the line that says
 * where the surfaces come from.
 */

import './styles.css';
import { censusStatistics, geographyTopology, provenance } from './bundle.ts';
import { shortFormExpansions } from './lib/labels.ts';
import { readLineOfControl } from './lib/line-of-control.ts';
import { motherTongueFills, motherTongueLegend, type LegendEntry } from './lib/mother-tongue.ts';
import { renderBaselineMap } from './map.ts';

const mount = document.getElementById('map');
if (mount === null) throw new Error('#map is missing from index.html');
const map = renderBaselineMap(
  mount,
  geographyTopology,
  censusStatistics,
  motherTongueFills(censusStatistics),
);

/**
 * Temporary reach for the data stratum, pending #18.
 *
 * #18 owns the basis selector, the deep-link router and the fade-back; none of that is built
 * here, and building half of it would be built twice. Until then `#/language` is the only way to
 * see stratum 1, and the default page is the baseline exactly as it was.
 */
const languageBasis = window.location.hash === '#/language';
map.setDataFill(languageBasis);

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

const legend = document.getElementById('legend');
if (legend !== null && languageBasis) {
  const { onTheMap, namedButNowhereDominant, absences } = motherTongueLegend(censusStatistics);
  legend.innerHTML = `
    ${onTheMap.map(item).join('')}
    ${absences.map(item).join('')}
    ${lineOfControlEntry}
    <span class="legend-group">
      <span class="legend-group-label">Named by the census, dominant in no district</span>
      ${namedButNowhereDominant.map(item).join('')}
    </span>
  `;
} else if (legend !== null) {
  legend.innerHTML = `
    <span class="legend-item"><span class="swatch swatch-province"></span>Province</span>
    <span class="legend-item"><span class="swatch swatch-territory"></span>Territory — not
      constitutionally a province</span>
    <span class="legend-item"><span class="swatch swatch-rule"></span>Division</span>
    ${lineOfControlEntry}
  `;
}

const colophon = document.getElementById('colophon');
if (colophon !== null) {
  const { counts, sources, vintage, lineOfControl } = provenance;
  const loc = readLineOfControl(geographyTopology);
  colophon.innerHTML = `
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
    ${languageBasis ? motherTongueProvenance() : ''}
    <p><strong>Sources</strong> ${sources['boundaries']} · roster: PBS.</p>
  `;
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
