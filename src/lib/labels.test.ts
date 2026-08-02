import { geoContains, geoPath } from 'd3';
import { describe, expect, it } from 'vitest';
import bundle from '../../data/bundle/geography.topojson.json';
import context from '../../data/bundle/context.topojson.json';
import outlines from '../../data/bundle/unit-outlines.json';
import scenarios from '../../data/bundle/scenarios.json';
import type { UnitOutlineBundle } from '../bundle.ts';
import { readCities } from './context.ts';
import { readDistricts, readGeography } from './geography.ts';
import { readUnitOutlines } from './units.ts';
import { fitProjection, frameInset } from './projection.ts';
import {
  baselineLabelSites,
  districtLabelSites,
  DISTRICT_LABEL_ZOOM,
  labelAnchor,
  labelKey,
  labelText,
  layoutLabels,
  shortFormExpansions,
  measureLabel,
  variantLabelSites,
  type LabelBox,
  type LabelTier,
} from './labels.ts';

const { provinces, divisions } = readGeography(bundle as never);
/** The city dots, on the same terms the renderer reads them: a name and the point it stands at. */
const cities = readCities(context as never).features.map((f) => ({
  name: f.properties.name,
  anchor: f.geometry.coordinates as [number, number],
}));

describe('labelAnchor', () => {
  it('puts every division label inside the division it names', () => {
    // Muzaffarabad is the case that matters: it wraps around Poonch, so its centroid falls in
    // another division entirely and a label placed there would name the wrong ground.
    const outside = [...divisions.features, ...provinces.features]
      .filter((f) => !geoContains(f as never, labelAnchor(f as never)))
      .map((f) => f.properties.name);
    expect(outside).toEqual([]);
  });
});

describe('baselineLabelSites', () => {
  const sites = baselineLabelSites({ provinces, divisions });

  it('names every province and every real division exactly once', () => {
    expect(sites).toHaveLength(43);
    expect(new Set(sites.map((s) => s.key)).size).toBe(43);
    expect(sites.filter((s) => s.tier === 'province')).toHaveLength(7);
  });

  it('leaves the injected ICT pseudo-division unnamed', () => {
    // Otherwise the capital is labelled twice, once as a thing no one administers.
    expect(sites.map((s) => s.key)).not.toContain('division:Islamabad');
    expect(sites.map((s) => s.key)).toContain('province:Islamabad Capital Territory');
  });

  it('ranks every province above every division, and larger ground above smaller', () => {
    const lowestProvince = Math.min(
      ...sites.filter((s) => s.tier === 'province').map((s) => s.priority),
    );
    const highestDivision = Math.max(
      ...sites.filter((s) => s.tier === 'division').map((s) => s.priority),
    );
    expect(lowestProvince).toBeGreaterThan(highestDivision);

    const priority = new Map(sites.map((s) => [s.key, s.priority]));
    // Balochistan is the largest province and ICT the smallest; Kalat dwarfs Lahore division.
    expect(priority.get('province:Balochistan')).toBeGreaterThan(
      priority.get('province:Islamabad Capital Territory') as number,
    );
    expect(priority.get('division:Kalat')).toBeGreaterThan(
      priority.get('division:Lahore') as number,
    );
  });
});

describe('baselineLabelSites, with the city dots on the map', () => {
  const sites = baselineLabelSites({ provinces, divisions }, cities);
  const keysOf = (tier: string) => sites.filter((s) => s.tier === tier).map((s) => s.text);

  it('names all seven seats', () => {
    expect(keysOf('city').sort()).toEqual([
      'Gilgit',
      'Islamabad',
      'Karachi',
      'Lahore',
      'Muzaffarabad',
      'Peshawar',
      'Quetta',
    ]);
  });

  it('qualifies a division named after its own seat, rather than dropping either name', () => {
    // Six of the seven collide: Karachi, Lahore, Peshawar, Quetta, Gilgit and Muzaffarabad each
    // name a division as well as a city. Setting the bare word twice inside one division leaves a
    // reader unable to tell which of the two is being named; dropping the division name costs the
    // default view the administrative structure it is there to show. So both are drawn and the
    // division says which it is — its own full official style, not a coinage of ours.
    const collide = ['Gilgit', 'Karachi', 'Lahore', 'Muzaffarabad', 'Peshawar', 'Quetta'];
    for (const name of collide) {
      expect(divisions.features.map((d) => d.properties.name)).toContain(name);
      // Keyed on the division's own name — the renderer looks a shape's width up by this key, so
      // keying it on the drawn text would cost exactly these six their width data.
      const site = sites.find((s) => s.key === `division:${name}`);
      expect(site?.text).toBe(`${name} Division`);
      expect(sites.find((s) => s.key === `city:${name}`)?.text).toBe(name);
    }
    // Every division still has a name, which is the point: none was traded away. Islamabad is the
    // seventh seat and its division is the injected pseudo-division, skipped for its own reason.
    expect(keysOf('division')).toHaveLength(36);
  });

  it('leaves the other divisions unqualified, since they have nothing to be confused with', () => {
    // The suffix is a disambiguation, not a house style. Applied to all 37 it would be shouting a
    // distinction that matters six times, and "Sukkur Division" competes for pixels "Sukkur" wins.
    const qualified = sites.filter((s) => s.tier === 'division' && s.text.endsWith(' Division'));
    expect(qualified).toHaveLength(6);
  });

  it('lets the dot win a crowded frame and the division name return with the room', () => {
    // This is the whole behaviour, and it is the layout's, not a rule of its own: the dot outranks
    // the division, layoutLabels drops what will not fit, and it is recomputed on every zoom. So
    // in a frame too tight for both, "Lahore" survives and "Lahore Division" does not — and the
    // qualified name comes back as soon as zooming makes room for it.
    const lahore = sites.find((s) => s.key === 'division:Lahore');
    const dot = sites.find((s) => s.key === 'city:Lahore');
    expect(dot?.priority).toBeGreaterThan(lahore?.priority ?? Infinity);

    const box = (key: string, x: number, width: number, priority: number) => ({
      key,
      x,
      y: 100,
      width,
      height: 10,
      priority,
    });
    // Both names wanting the same few pixels.
    const tight = layoutLabels(
      [box('city:Lahore', 100, 40, 5), box('division:Lahore', 110, 90, 0.001)],
      { bounds: { width: 300, height: 200 }, gap: 2, nudges: [[0, 0]] },
    );
    expect(tight.map((p) => p.key)).toEqual(['city:Lahore']);

    // The same two with room between them — which is what zooming in produces.
    const roomy = layoutLabels(
      [box('city:Lahore', 60, 40, 5), box('division:Lahore', 220, 90, 0.001)],
      { bounds: { width: 300, height: 200 }, gap: 2, nudges: [[0, 0]] },
    );
    expect(roomy.map((p) => p.key).sort()).toEqual(['city:Lahore', 'division:Lahore']);
  });

  it('ranks the dots under the provinces and over the divisions', () => {
    // A dot is where it says it is and a division name floats at a centroid, so between those two
    // the precise one should win the pixels. Between a dot and a province it should not: a map
    // that has lost "Balochistan" and kept "Quetta" is disorienting in a way the reverse is not.
    const range = (tier: string) => {
      const priorities = sites.filter((s) => s.tier === tier).map((s) => s.priority);
      return { low: Math.min(...priorities), high: Math.max(...priorities) };
    };
    expect(range('province').low).toBeGreaterThan(range('city').high);
    expect(range('city').low).toBeGreaterThan(range('division').high);
  });

  it('sets a city’s name off its own dot rather than on top of it', () => {
    const city = sites.find((s) => s.tier === 'city');
    expect(city?.offset).toBeDefined();
    expect(measureLabel(city as never, [100, 100], Infinity, () => ({ width: 20, height: 10 })).box)
      .toMatchObject({ x: 100, y: 109 });
    // A shape's name goes in the middle of the shape, so it takes no offset at all.
    const province = sites.find((s) => s.tier === 'province');
    expect(province?.offset).toBeUndefined();
  });
});

describe('labelText', () => {
  // Width in "characters" so the test says what it means: 1 unit of width per character.
  const measure = (text: string) => text.length;

  it('spells a name out wherever the ground it names has room for it', () => {
    expect(labelText('Islamabad Capital Territory', 40, measure)).toBe('Islamabad Capital Territory');
  });

  it('falls back to the unit’s own abbreviation where the full name would not fit', () => {
    // ICT is ~906 km², so at any zoom that shows the country its name is wider than it is.
    // Spilling it across Punjab and Azad Kashmir would name ground it does not cover.
    expect(labelText('Islamabad Capital Territory', 8, measure)).toBe('ICT');
    expect(labelText('Azad Jammu & Kashmir', 8, measure)).toBe('AJK');
  });

  it('keeps the full name where no abbreviation is attested, however tight the fit', () => {
    // Made-up short forms would be this app inventing names, which it does not do.
    expect(labelText('Shaheed Benazirabad', 4, measure)).toBe('Shaheed Benazirabad');
  });
});

/**
 * The acceptance criterion itself — division names legible and not overlapping at default zoom —
 * asserted against the real 44 names on a real projection. Text is measured by estimate here
 * rather than by a browser, so the width is generous: a layout that clears at 0.58em per
 * character clears at whatever the serif actually measures.
 */
// No browser here, so widths are estimated — generously, and with the stylesheet's capitals and
// tracking accounted for, because a layout that clears at these widths clears at the real ones.
// Units are set as provinces are — same size, same tracking, told apart by colour and not by
// scale — so they measure the same way here.
const measure = (text: string, tier: LabelTier) => {
  if (tier === 'division') return { width: text.length * 10.5 * 0.5, height: 10.5 };
  // A city name is set roman and smaller than a division's — it names a point, not an area.
  if (tier === 'city') return { width: text.length * 9.5 * 0.5, height: 9.5 };
  return { width: text.length * (13 * 0.68 + 1.5), height: 13 };
};

/**
 * The whole baseline layout, at one frame — the renderer's own pipeline, in order.
 *
 * A function rather than a block, because the layout has to be asked the same questions at more
 * than one size. Everything that goes wrong at 390px goes wrong *only* at 390px: a name that fits
 * a desktop frame and not a phone's is invisible to a suite that only ever measures one viewport,
 * which is how Gilgit-Baltistan came to be drawn and anonymous on the device most readers use.
 */
function baselineAt(viewport: { width: number; height: number; padding: number }) {
  const project = fitProjection(provinces, viewport);
  const path = geoPath(project);
  const width = (f: { geometry: unknown }) => {
    const [[west], [east]] = path.bounds(f as never);
    return east - west;
  };
  // Keyed exactly as the renderer keys it — by `labelKey`, not by the display text. Keying by
  // text here would agree with production by coincidence and stop agreeing the moment a name
  // is abbreviated or a division and a province share one.
  const shapeWidth = new Map([
    ...provinces.features.map(
      (f) => [labelKey('province', f.properties.name), width(f)] as const,
    ),
    ...divisions.features.map(
      (f) => [labelKey('division', f.properties.name), width(f)] as const,
    ),
  ]);

  const measured = baselineLabelSites({ provinces, divisions }, cities).flatMap((site) => {
    const point = project(site.anchor);
    if (point === null) return [];
    return [measureLabel(site, point, shapeWidth.get(site.key) ?? Infinity, measure)];
  });
  const result = layoutLabels(
    measured.map((m) => m.box),
    { bounds: viewport, gap: 3 },
  );
  return {
    project,
    shapeWidth,
    result,
    sized: new Map(measured.map((m) => [m.box.key, m.box])),
    /** What each name is actually *set as* — the full form, or the unit's own abbreviation. */
    drawnText: new Map(measured.map((m) => [m.box.key, m.text])),
  };
}

/**
 * The map's own box on a 390px phone, measured in a real browser rather than guessed, with the
 * renderer's own inset applied by importing it rather than by copying the formula.
 */
const BAR_390 = { width: 369, height: 336 };

const framed = (frame: { width: number; height: number }) => ({
  ...frame,
  padding: frameInset(frame.width),
});

/** The variant layout at one frame: which unit names the page would actually set. */
function variantAt(id: string, frame: { width: number; height: number }) {
  const viewport = framed(frame);
  const project = fitProjection(provinces, viewport);
  const path = geoPath(project);
  const units = readUnitOutlines(bundle as never, outlines as unknown as UnitOutlineBundle, id);
  const width = (f: { geometry: unknown }) => {
    const [[west], [east]] = path.bounds(f as never);
    return east - west;
  };
  const shapeWidth = new Map([
    ...units.features.map((f) => [labelKey('unit', f.properties.name), width(f)] as const),
    ...divisions.features.map((f) => [labelKey('division', f.properties.name), width(f)] as const),
  ]);
  const measured = variantLabelSites({ divisions }, units.features, cities).flatMap((site) => {
    const point = project(site.anchor);
    if (point === null) return [];
    return [measureLabel(site, point, shapeWidth.get(site.key) ?? Infinity, measure)];
  });
  return {
    units: units.features.map((f) => f.properties.name),
    placed: new Set(
      layoutLabels(
        measured.map((m) => m.box),
        { bounds: viewport, gap: 3 },
      ).map((l) => l.key),
    ),
  };
}

describe('the baseline map at default zoom', () => {
  const viewport = { width: 1200, height: 800, padding: 32 };
  const { project, shapeWidth, result, sized } = baselineAt(viewport);

  it('draws no two names on top of one another', () => {
    for (const a of result) {
      const boxA = sized.get(a.key) as LabelBox;
      for (const b of result) {
        if (a.key === b.key) continue;
        const boxB = sized.get(b.key) as LabelBox;
        const apart =
          Math.abs(a.x - b.x) >= (boxA.width + boxB.width) / 2 ||
          Math.abs(a.y - b.y) >= (boxA.height + boxB.height) / 2;
        expect(apart, `${a.key} overlaps ${b.key}`).toBe(true);
      }
    }
  });

  it('names every province, including both territories', () => {
    const drawn = new Set(keys(result));
    // AJK and GB are named here or they are named nowhere: CLAUDE.md requires both drawn *and*
    // named, and unlike a division neither has a second chance further down the tier.
    const unnamed = provinces.features
      .map((p) => p.properties.name)
      .filter((name) => !drawn.has(labelKey('province', name)));
    expect(unnamed).toEqual([]);
  });

  it('drops these divisions at default zoom, and no others', () => {
    // Named rather than counted. A floor of "at least 34" passes while three divisions go
    // silently unnamed and never says which — and which ones matter: a drop is only acceptable
    // because the name returns on zoom, so a change in this list is a change in what the
    // opening view of the country says, and belongs in a diff.
    //
    // A division named after its own seat is not counted as dropped while the dot carries the
    // word: the name is on the map, under `city:` rather than `division:`. So the test asks for
    // the *name*, at either key.
    //
    // **Mardan is the price of qualifying the six rather than dropping them.** Restoring
    // "Peshawar Division" to the map puts a second name into the most crowded corner of KP, and
    // at default zoom Mardan is what gives way. That is the trade taken deliberately — the
    // default view now states the administrative structure it is there to state, and Mardan's
    // name returns on the first zoom step, as Poonch's does. Named here rather than absorbed into
    // a count, because if this list grows the opening view of the country has changed.
    const drawn = new Set(keys(result));
    const dropped = divisions.features
      .filter((d) => d.properties.pseudo !== true)
      .map((d) => d.properties.name)
      .filter(
        (name) =>
          !drawn.has(labelKey('division', name)) && !drawn.has(labelKey('city', name)),
      );
    expect(dropped.sort()).toEqual(['Mardan', 'Poonch']);
  });

  it('brings the qualified names and Mardan back as the map is zoomed', () => {
    // The drop above is only defensible because it is temporary, so that is asserted rather than
    // asserted-about-in-a-comment. At 3× there is room for the six qualified division names *and*
    // for Mardan, so nothing the default view gave up is lost for good.
    const zoomed = { width: viewport.width * 3, height: viewport.height * 3 };
    const scaled = baselineLabelSites({ provinces, divisions }, cities).flatMap((site) => {
      const point = project(site.anchor);
      if (point === null) return [];
      const [x, y] = point;
      return [
        measureLabel(
          site,
          [x * 3, y * 3],
          (shapeWidth.get(site.key) ?? Infinity) * 3,
          measure,
        ),
      ];
    });
    const drawn = new Set(keys(layoutLabels(scaled.map((m) => m.box), { bounds: zoomed, gap: 3 })));

    expect(drawn.has(labelKey('division', 'Mardan'))).toBe(true);
    for (const name of ['Gilgit', 'Karachi', 'Lahore', 'Muzaffarabad', 'Peshawar', 'Quetta']) {
      expect(drawn.has(labelKey('division', name))).toBe(true);
      expect(drawn.has(labelKey('city', name))).toBe(true);
    }
  });

  it('names every seat, since a dot with no name is a landmark a reader cannot use', () => {
    // The dots are drawn whatever happens; it is the names that take part in the layout. Seven of
    // them at default zoom is what the whole point of the tier being sparse buys.
    const drawn = new Set(keys(result));
    const unnamed = cities
      .map((city) => city.name)
      .filter((name) => !drawn.has(labelKey('city', name)));
    expect(unnamed).toEqual([]);
  });
});

/**
 * The 390px bar (#34) — the hard one, and the one the suite could not see until now.
 *
 * The frame is the map's own box on a 390px phone, measured in a real browser rather than guessed:
 * 369 x 336 inside the well, with the renderer's own inset formula applied to it. Everything below
 * fails *only* at this size, which is the whole argument for a second viewport case — a suite that
 * measures one frame reports a country as fully named while the device most of its readers use
 * draws a territory with no name on it.
 */
describe('the baseline map at the 390px bar', () => {
  const { result, sized, drawnText } = baselineAt(framed(BAR_390));

  it('names every province and both territories, Gilgit-Baltistan included', () => {
    /*
     * The finding this ticket exists for, from the owner's own measurement on #34: at this size
     * the layout placed six of seven provinces, and the one it dropped was **Gilgit-Baltistan**.
     *
     * That is not a legibility miss, it is the failure the politically sensitive rendering section
     * is written to prevent — AJK and GB are to be drawn *and named*, and a territory drawn but
     * anonymous says something about Pakistan-administered ground that this app does not get to
     * say by accident. Neither has a second chance further down a tier the way a division does.
     */
    const drawn = new Set(keys(result));
    const unnamed = provinces.features
      .map((p) => p.properties.name)
      .filter((name) => !drawn.has(labelKey('province', name)));
    expect(unnamed).toEqual([]);
  });

  it('shortens Gilgit-Baltistan only because the ground is small, not everywhere', () => {
    // The fix is an abbreviation, and an abbreviation that fired at every size would be this app
    // renaming a territory rather than fitting a name to its ground. Held at both frames at once,
    // which is the only way that distinction can be asserted at all.
    expect(drawnText.get(labelKey('province', 'Gilgit-Baltistan'))).toBe('GB');
    const wide = baselineAt({ width: 1200, height: 800, padding: 32 });
    expect(wide.drawnText.get(labelKey('province', 'Gilgit-Baltistan'))).toBe('Gilgit-Baltistan');
  });

  it('explains the abbreviation it just used, since the colophon carries the expansions', () => {
    // An abbreviation on the map is never unexplained — the same obligation AJK, ICT and KP are
    // already under. Read off the exported table the colophon prints from, so a short form added
    // without an expansion fails here rather than appearing unglossed on the page.
    expect(shortFormExpansions).toContainEqual(['GB', 'Gilgit-Baltistan']);
  });

  it('draws no two names on top of one another, at the size where they least fit', () => {
    for (const a of result) {
      const boxA = sized.get(a.key) as LabelBox;
      for (const b of result) {
        if (a.key === b.key) continue;
        const boxB = sized.get(b.key) as LabelBox;
        const apart =
          Math.abs(a.x - b.x) >= (boxA.width + boxB.width) / 2 ||
          Math.abs(a.y - b.y) >= (boxA.height + boxB.height) / 2;
        expect(apart, `${a.key} overlaps ${b.key} at 390px`).toBe(true);
      }
    }
  });

  it('drops these divisions at the 390px bar, and no others', () => {
    // Named, never counted — the same rule the 1200px case follows and for the same reason. A
    // phone frame is a fifth of a desktop's area, so a great many division names give way here;
    // that is the tier doing what it is ranked to do. What must not happen is the list changing
    // without anyone seeing it, because this list *is* the opening view of the country on the
    // device most readers will meet it on.
    const drawn = new Set(keys(result));
    const dropped = divisions.features
      .filter((d) => d.properties.pseudo !== true)
      .map((d) => d.properties.name)
      .filter(
        (name) => !drawn.has(labelKey('division', name)) && !drawn.has(labelKey('city', name)),
      );
    expect(dropped.sort()).toEqual([
      'Baltistan',
      'Dera Ismail Khan',
      'Diamer-Astore',
      'Faisalabad',
      'Gujranwala',
      'Hazara',
      'Hyderabad',
      'Loralai',
      'Mirpur',
      'Multan',
      'Muzaffarabad',
      'Nasirabad',
      'Peshawar',
      'Poonch',
      'Rawalpindi',
      'Sahiwal',
      'Shaheed Benazirabad',
    ]);
  });

  it('keeps five of the seven seats named, and says which two give way', () => {
    /*
     * The dot is drawn whatever happens; it is the *name* that yields (#8). Two cannot be set
     * clear at this size, and both sit in the crowded north where KP, AJK, GB, ICT and the
     * ceasefire line's own name are all competing for one corner.
     *
     * Peshawar is the one to look at: its division name is dropped in the list above as well, so
     * at 390px the word appears **nowhere** on the map, and only the dot marks the place. That is
     * the documented ranking working as written — provinces outrank cities, because a map that has
     * lost "Khyber Pakhtunkhwa" and kept "Peshawar" is disorienting in a way the reverse is not —
     * and the name returns on the first zoom step. It is asserted by name so that a change to it
     * is a change somebody sees.
     */
    const drawn = new Set(keys(result));
    const unnamed = cities
      .map((city) => city.name)
      .filter((name) => !drawn.has(labelKey('city', name)));
    expect(unnamed.sort()).toEqual(['Muzaffarabad', 'Peshawar']);
  });
});

/**
 * Unit labels persist at the 390px bar (#34) — the criterion that a proposal stays legible.
 *
 * Stratum 3 is what a variant view is *for*: a reader on a phone who cannot see what the proposed
 * provinces are called is looking at coloured shapes.
 *
 * Asked of **every variant**, not of one, for the reason `units.test.ts` gives about the same
 * ground — "those two units are not always called the same thing". Held over L1 alone this passed
 * while H3 left three units unnamed, including the Northern Areas, which is Gilgit-Baltistan under
 * the name that variant gives it: the very territory #34 was raised to stop going anonymous.
 */
describe('a variant at the 390px bar', () => {
  /**
   * The one unit this build cannot name at 390px, and why it is a name rather than a number.
   *
   * H3's *Northern Areas* is thirteen characters set at province size over ground about a fifth
   * that wide on a phone. Every other long name in the app has an attested abbreviation to fall
   * back to — AJK, ICT, KP, GB, and H3's own NWFP and FATA. This one has none, and `SHORT_FORMS`
   * forbids inventing one: a coinage would be a name for Pakistani-administered territory that no
   * source uses, which is a worse thing to put on this map than a missing label.
   *
   * So it keeps its full name, loses the layout, and goes unnamed at this size — stated here
   * rather than smoothed over, and raised as open item 5 because what a proposal's advocates call
   * their own units short is content, and content is the owner's call.
   */
  const UNNAMEABLE_AT_390 = { variant: 'h3', unit: 'Northern Areas' };

  for (const variant of scenarios.variants) {
    it(`names every unit of ${variant.id}, so no proposed province is an unlabelled shape`, () => {
      const drawn = variantAt(variant.id, BAR_390);
      const unnamed = drawn.units.filter((name) => !drawn.placed.has(labelKey('unit', name)));
      const expected =
        variant.id === UNNAMEABLE_AT_390.variant ? [UNNAMEABLE_AT_390.unit] : [];
      expect(unnamed).toEqual(expected);
    });
  }

  it('names the one it cannot name as soon as there is room, so nothing is lost for good', () => {
    // The gap above is only defensible because it is a matter of pixels rather than of policy.
    const drawn = variantAt(UNNAMEABLE_AT_390.variant, { width: 1200, height: 800 });
    expect(drawn.placed.has(labelKey('unit', UNNAMEABLE_AT_390.unit))).toBe(true);
  });
});

describe('districtLabelSites', () => {
  const districts = readDistricts(bundle as never);
  const sites = districtLabelSites(districts.features as never);

  it('names every drawn district exactly once', () => {
    expect(sites).toHaveLength(districts.features.length);
    expect(new Set(sites.map((s) => s.key)).size).toBe(sites.length);
    expect(sites.every((s) => s.tier === 'district')).toBe(true);
  });

  it('ranks every district below every division, so it can never take a division´s frame', () => {
    // The floor is negative and `geoArea` is a fraction of the sphere, so this holds for the
    // largest district against the smallest division rather than merely on average — which is the
    // property that matters, since Chagai is bigger than several divisions.
    const highestDistrict = Math.max(...sites.map((s) => s.priority));
    const lowestDivision = Math.min(
      ...baselineLabelSites({ provinces, divisions }, cities)
        .filter((s) => s.tier === 'division')
        .map((s) => s.priority),
    );
    expect(highestDistrict).toBeLessThan(lowestDivision);
  });

  it('puts every district name inside the district it names', () => {
    const outside = districts.features
      .filter((f) => !geoContains(f as never, labelAnchor(f as never)))
      .map((f) => f.properties.name);
    expect(outside).toEqual([]);
  });

  it('is offered only above a zoom threshold, and the threshold is past the 390px frame', () => {
    /*
     * The criterion is that district names *drop below a zoom threshold and appear on tap
     * instead* (#34). The threshold is what makes both halves true: 156 names over a 369px frame
     * is a word search rather than a map, so below it they are never laid out and the reader gets
     * a district by tapping it (#33) — which answers with the division, the province, the
     * population and the dominant tongue, not a name alone.
     */
    expect(DISTRICT_LABEL_ZOOM).toBeGreaterThan(1);
    // Past the zoom the district *lines* come in at, because a line has only to be seen and a
    // name has to be read.
    expect(DISTRICT_LABEL_ZOOM).toBeGreaterThanOrEqual(4);
  });
});

describe('variantLabelSites', () => {
  const units = readUnitOutlines(bundle as never, outlines as unknown as UnitOutlineBundle, 'l1');
  const sites = variantLabelSites({ divisions }, units.features);

  it('names every unit of the active variant exactly once', () => {
    const named = sites.filter((s) => s.tier === 'unit').map((s) => s.text);
    expect(named).toEqual(units.features.map((f) => f.properties.name));
    expect(new Set(named).size).toBe(named.length);
  });

  it('hands the province names over to the units rather than drawing both', () => {
    // Seven of L1's eight units *are* current provinces carried through unchanged, so drawing
    // both tiers would set "Sindh" twice a few pixels apart, in two colours — and beside South
    // Punjab it would set the proposal's name next to the name of the province it is carved out
    // of, which reads as two claims about one piece of ground.
    expect(sites.filter((s) => s.tier === 'province')).toEqual([]);
    const punjab = sites.filter((s) => s.text === 'Punjab');
    expect(punjab).toHaveLength(1);
    expect(punjab[0]?.tier).toBe('unit');
  });

  it('keeps the divisions, and keeps skipping the injected ICT pseudo-division', () => {
    const divisionKeys = sites.filter((s) => s.tier === 'division').map((s) => s.key);
    expect(divisionKeys).toHaveLength(36);
    expect(divisionKeys).not.toContain('division:Islamabad');
  });

  it('ranks every unit above every division', () => {
    const lowestUnit = Math.min(...sites.filter((s) => s.tier === 'unit').map((s) => s.priority));
    const highest = Math.max(...sites.filter((s) => s.tier === 'division').map((s) => s.priority));
    expect(lowestUnit).toBeGreaterThan(highest);
  });

  it('anchors South Punjab inside South Punjab, not inside the province it leaves', () => {
    const south = units.features.find((f) => f.properties.unit === 'south-punjab');
    const site = sites.find((s) => s.text === 'South Punjab');
    expect(geoContains(south as never, site?.anchor as [number, number])).toBe(true);
    const punjab = units.features.find((f) => f.properties.unit === 'punjab');
    expect(geoContains(punjab as never, site?.anchor as [number, number])).toBe(false);
  });
});

const box = (key: string, x: number, y: number, priority = 0): LabelBox => ({
  key,
  x,
  y,
  width: 40,
  height: 12,
  priority,
});

const frame = { bounds: { width: 400, height: 300 }, gap: 2 };
const keys = (result: readonly { key: string }[]) => result.map((l) => l.key);

describe('layoutLabels', () => {
  it('leaves labels that do not collide on their own anchors', () => {
    expect(layoutLabels([box('a', 50, 50), box('b', 300, 200)], frame)).toEqual([
      { key: 'a', x: 50, y: 50 },
      { key: 'b', x: 300, y: 200 },
    ]);
  });

  it('keeps names out from under ground something else is already standing on', () => {
    /*
     * The docked tooltip (#33). On a phone the box does not follow the pointer — it is a bar
     * across the top of the frame, which is northern Pakistan: Gilgit-Baltistan, Azad Kashmir and
     * the ceasefire line's own name. The layout cannot see a `<div>`, so without seeding it the
     * four-step yielding order would be bypassed by an element outside its scoring and a reader
     * would lose the box *and* the name underneath it — which is the defect that order calls out.
     */
    const bar = { x0: 0, y0: 0, x1: 400, y1: 120 };
    const under = layoutLabels([box('north', 200, 60, 9)], { ...frame, occupied: [bar] });
    // Either moved clear of the bar or given up entirely; never left underneath it.
    const placed = under.find((label) => label.key === 'north');
    if (placed !== undefined) expect(placed.y).toBeGreaterThan(bar.y1 - 20);

    // And with nothing docked it keeps its own anchor, so this costs a desktop nothing.
    expect(layoutLabels([box('north', 200, 60, 9)], frame)).toEqual([
      { key: 'north', x: 200, y: 60 },
    ]);
  });

  it('lets a name keep ground the docked bar does not reach', () => {
    const bar = { x0: 0, y0: 0, x1: 400, y1: 40 };
    expect(layoutLabels([box('south', 200, 260, 9)], { ...frame, occupied: [bar] })).toEqual([
      { key: 'south', x: 200, y: 260 },
    ]);
  });

  it('keeps the higher-priority label on its anchor and moves the other off it', () => {
    const result = layoutLabels([box('small', 100, 100, 1), box('big', 104, 102, 9)], frame);
    expect(result).toContainEqual({ key: 'big', x: 104, y: 102 });
    const moved = result.find((l) => l.key === 'small');
    expect(moved?.y).not.toBe(100);
  });

  it('drops a label that cannot be placed anywhere clear, rather than overlapping', () => {
    // Eight labels stacked on one point: more than the nudge ladder can find room for.
    const crowd = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => box(`l${n}`, 200, 150, n));
    const result = layoutLabels(crowd, frame);
    expect(result.length).toBeLessThan(crowd.length);
    for (const a of result) {
      for (const b of result) {
        if (a.key === b.key) continue;
        expect(Math.abs(a.x - b.x) >= 42 || Math.abs(a.y - b.y) >= 14).toBe(true);
      }
    }
  });

  it('drops labels that have panned outside the frame', () => {
    expect(keys(layoutLabels([box('in', 200, 150), box('out', -400, 150)], frame))).toEqual(['in']);
  });

  it('does not depend on the order labels arrive in', () => {
    const labels = [box('a', 100, 100, 1), box('b', 104, 102, 1), box('c', 108, 104, 1)];
    expect(layoutLabels(labels, frame)).toEqual(layoutLabels([...labels].reverse(), frame));
  });
});
