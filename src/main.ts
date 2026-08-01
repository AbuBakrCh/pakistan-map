/**
 * Entry point. Mounts the baseline map and writes the page's own provenance, which is read out
 * of the bundle rather than typed here — no unsourced surface, including the line that says
 * where the surfaces come from.
 */

import './styles.css';
import { geographyTopology, provenance } from './bundle.ts';
import { shortFormExpansions } from './lib/labels.ts';
import { renderBaselineMap } from './map.ts';

const mount = document.getElementById('map');
if (mount === null) throw new Error('#map is missing from index.html');
renderBaselineMap(mount, geographyTopology);

const legend = document.getElementById('legend');
if (legend !== null) {
  legend.innerHTML = `
    <span class="legend-item"><span class="swatch swatch-province"></span>Province</span>
    <span class="legend-item"><span class="swatch swatch-territory"></span>Territory — not
      constitutionally a province</span>
    <span class="legend-item"><span class="swatch swatch-rule"></span>Division</span>
  `;
}

const colophon = document.getElementById('colophon');
if (colophon !== null) {
  const { counts, sources, vintage } = provenance;
  colophon.innerHTML = `
    <p><strong>Boundaries</strong> OpenStreetMap, ODbL — ${counts['provinces']} provinces and
      territories, ${counts['divisions']} divisions, dissolved to the 2023 census set.
      Districts are not drawn on the baseline.</p>
    <p><strong>Vintage</strong> ${vintage}. Administrative units created since are folded into
      their 2023 parent, so the map is knowingly not today's map: the Balochistan restructuring
      of 8 July 2026 is not drawn.</p>
    <p><strong>On the map</strong> ${shortFormExpansions
      .map(([short, full]) => `${short} — ${full}`)
      .join(' · ')}. Names are shortened only where the full name is wider than the ground it
      names, and only to the form the unit uses for itself.</p>
    <p><strong>Sources</strong> ${sources['boundaries']} · roster: PBS.</p>
  `;
}
