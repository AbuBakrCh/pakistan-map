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
  interiorRoom,
  labelAnchor,
  labelKey,
  labelLines,
  wrappedLines,
  labelPolygon,
  labelText,
  layoutLabels,
  LABEL_CLEARANCE,
  CALLOUT_SCALE,
  MAX_LEADER_FRACTION,
  MIN_UNIT_LABEL_SCALE,
  shortFormExpansions,
  measureLabel,
  variantLabelSites,
  type LabelBox,
  type LabelTier,
  type Leader,
  type PlacedLabel,
  type Point,
  type Ring,
  type TierOptions,
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

/**
 * The division tier, offered rather than assumed — the map frame's own toggle.
 *
 * Two claims, and the second is the one worth having. The tier goes *whole*: a division name over
 * ground with no division boundary under it names a shape the map is no longer drawing, so the
 * names are withheld here and the lines are withheld by the stylesheet, and neither half may be
 * withheld alone. And what the toggle does **not** buy is asserted beside what it does, because the
 * obvious reading of "fewer names on the map" is that the crowded variants get their unit names
 * back — and they do not, since the unit tier's floor already outranks every division outright.
 */
describe('the division tier, drawn only when it is asked for', () => {
  it('withholds every division name, and nothing else, at the baseline', () => {
    const withDivisions = baselineLabelSites({ provinces, divisions }, cities);
    const without = baselineLabelSites({ provinces, divisions }, cities, { divisions: false });

    expect(without.filter((s) => s.tier === 'division')).toEqual([]);
    // The provinces, both territories and all seven seats survive it: those are what the map is
    // left with, and the answer to "show fewer names" must not be "show fewer places".
    expect(keys(without).sort()).toEqual(
      keys(withDivisions.filter((s) => s.tier !== 'division')).sort(),
    );
    expect(without.filter((s) => s.tier === 'province')).toHaveLength(7);
    expect(without.filter((s) => s.tier === 'city')).toHaveLength(7);
  });

  it('withholds them under a variant too, leaving the units and the seats', () => {
    const units = readUnitOutlines(bundle as never, outlines as unknown as UnitOutlineBundle, 'l1');
    const without = variantLabelSites({ divisions }, units.features, cities, { divisions: false });

    expect(without.filter((s) => s.tier === 'division')).toEqual([]);
    expect(without.filter((s) => s.tier === 'unit')).toHaveLength(units.features.length);
    expect(without.filter((s) => s.tier === 'city')).toHaveLength(7);
  });

  it('offers them to a caller that says nothing, since saying nothing is not asking for less', () => {
    // The default is the full set. The renderer states its own answer explicitly in both
    // directions; this is what a caller that has expressed no opinion gets.
    expect(baselineLabelSites({ provinces, divisions }, cities)).toEqual(
      baselineLabelSites({ provinces, divisions }, cities, { divisions: true }),
    );
  });

  /*
   * The finding, held rather than assumed. Turning the divisions off does not name a single unit
   * that was going unnamed: the unit tier's floor (`UNIT_FLOOR`) is above every division's priority
   * outright, so a division has never been able to evict a unit and removing it frees nothing. The
   * unit A6 cannot name at the bar is crowded out by *other units* (#28), and that is still open
   * item 5's problem rather than something this control answers.
   *
   * One case per variant, because the layout at the bar is the expensive question in this file and
   * five of them in one case is a timeout rather than a failure.
   */
  for (const id of ['a6', 'd1', 'h2', 'l7']) {
    it(
      `rescues not one of ${id}'s unit names at the 390px bar`,
      () => {
        const withDivisions = variantAt(id, BAR_390);
        const without = layOutVariantAt(id, BAR_390, { divisions: false });
        const unnamed = (drawn: { units: readonly string[]; placed: ReadonlySet<string> }) =>
          drawn.units.filter((name) => !drawn.placed.has(labelKey('unit', name)));
        expect(unnamed(without), id).toEqual(unnamed(withDivisions));
      },
      // Two whole layouts of a crowded variant at the bar, and a callout now walks 27 rungs on both
      // sides through five passes where it walked 11 through two. These were landing at 4.0–4.6s
      // against the 5s default and failing intermittently on the clock rather than on the claim,
      // which is the worst kind of red: it points at the assertion and means nothing of the sort.
      20_000,
    );
  }
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
// `scale` is what `measureLabel` uses to set a name down until it clears the ground it names, and
// it is applied here exactly as the renderer applies it: to the size *and* to the tracking, since
// letter-spacing is set in `em` and a width measured with the full tracking under a smaller face is
// a width the browser never draws.
const measure = (text: string, tier: LabelTier, scale = 1) => {
  if (tier === 'division') return { width: text.length * 10.5 * scale * 0.5, height: 10.5 * scale };
  // A city name is set roman and smaller than a division's — it names a point, not an area.
  if (tier === 'city') return { width: text.length * 9.5 * scale * 0.5, height: 9.5 * scale };
  // The tier the floor is set against: a unit's name is never set smaller than a district's.
  if (tier === 'district') return { width: text.length * 8.5 * scale * 0.5, height: 8.5 * scale };
  return { width: text.length * (13 * 0.68 + 1.5) * scale, height: 13 * scale };
};

/**
 * The ground a unit's name has to fit inside, projected exactly as the renderer projects it.
 *
 * Shared with the pipeline below rather than reconstructed per case, because the whole warrant for
 * `measureLabel` being a seam is that the suite competes over the boxes the page draws — and since
 * #50 that includes the *room* the shape leaves at the anchor and the reach that a callout is set
 * clear of. A test that measured the room its own way would assert that its own arithmetic agrees
 * with itself, and the callout branch would go untested on the real map entirely.
 */
const ringsOf = (
  feature: { geometry: unknown; properties: unknown },
  project: (point: [number, number]) => [number, number] | null,
): Ring[] =>
  labelPolygon(feature as never).coordinates.map((ring) =>
    ring.flatMap((coordinate) => {
      const screen = project(coordinate as [number, number]);
      return screen === null ? [] : [screen as Point];
    }),
  );

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

/**
 * The variant layout at one frame: which unit names the page would actually set.
 *
 * Memoised, because the pipeline is asked for the same variant at the same frame by several cases
 * and the interior search behind `labelAnchor` is the expensive part of it. The cache is keyed on
 * exactly the two arguments, so nothing is shared between two questions that differ.
 */
const variantLayouts = new Map<string, ReturnType<typeof layOutVariantAt>>();
const variantAt = (id: string, frame: { width: number; height: number }) => {
  const key = `${id}@${frame.width}x${frame.height}`;
  const cached = variantLayouts.get(key);
  if (cached !== undefined) return cached;
  const computed = layOutVariantAt(id, frame);
  variantLayouts.set(key, computed);
  return computed;
};

function layOutVariantAt(
  id: string,
  frame: { width: number; height: number },
  tiers: TierOptions = {},
) {
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
  // The unit tier alone is fitted to the ground it names rather than to a bounding width (#50), and
  // it is handed the same rings the renderer hands it: the polygon `labelAnchor` anchored in,
  // projected into the frame's own px.
  const rings = new Map(
    units.features.map(
      (f) => [labelKey('unit', f.properties.name), ringsOf(f as never, project as never)] as const,
    ),
  );
  const sites = variantLabelSites({ divisions }, units.features, cities, tiers);
  const measured = sites.flatMap((site) => {
    const point = project(site.anchor);
    if (point === null) return [];
    const ground = rings.get(site.key);
    return [
      measureLabel(
        site,
        point,
        shapeWidth.get(site.key) ?? Infinity,
        measure,
        ground === undefined ? undefined : { rings: ground },
      ),
    ];
  });
  // The country itself, and the leader cap — both of them handed over exactly as `map.ts` hands
  // them over (#51). Without them this harness asserts the *fallback* path: a callout that clears
  // only its own unit rather than the drawn land, and an uncapped leader. The whole warrant for
  // `measureLabel` and `layoutLabels` being the seam is that the suite competes over the boxes the
  // page draws, and a callout placed against different geography is not one of those boxes.
  const land = provinces.features.flatMap((f) => {
    const geometry = f.geometry as { type: string; coordinates: unknown };
    const polygons = (
      geometry.type === 'Polygon'
        ? [geometry.coordinates as number[][][]]
        : (geometry.coordinates as number[][][][])
    ) as number[][][][];
    return polygons.flatMap((rs) =>
      rs.map((ring) =>
        ring.flatMap((coordinate) => {
          const screen = project(coordinate as [number, number]);
          return screen === null ? [] : [screen as Point];
        }),
      ),
    );
  });
  const layout = layoutLabels(
    measured.map((m) => m.box),
    {
      bounds: viewport,
      gap: 3,
      land,
      maxLeader: Math.min(viewport.width, viewport.height) * MAX_LEADER_FRACTION,
    },
  );
  return {
    land,
    units: units.features.map((f) => f.properties.name),
    rings,
    /** The units whose ground is a territory — by the kind the bundle records, never by name. */
    territories: units.features
      .filter((f) => f.properties.kind === 'territory')
      .map((f) => f.properties.name),
    sites,
    viewport,
    sized: new Map(measured.map((m) => [m.box.key, m.box])),
    /** What each name is actually set as: its lines, and the fraction of full size it is set at. */
    drawn: new Map(measured.map((m) => [m.box.key, m])),
    layout,
    placed: new Set(layout.map((l) => l.key)),
    at: new Map(layout.map((l) => [l.key, l])),
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
   * The units this build cannot name at 390px — listed, because a count would hide which.
   *
   * **The 390px bar is now met by twelve of the fourteen variants.** It was twenty-one names
   * across nine variants before #51, and seven across four after it. The four rule-drawn maps whose
   * units in central Punjab were the standing example of the bar going unmet are retired, and the
   * one rule that replaced them leaves a single name unset. Four levers got it this far, and each
   * is a different one:
   *
   *  - A name that does not fit on one line is **broken between its words** (`wrappedLines`), so a
   *    three-word name is as wide as its wider half rather than as wide as the sum.
   *  - The type floor came down from 7.5px to **6.5px** (`MIN_UNIT_LABEL_SCALE`).
   *  - A leader may **cross ground the unit does not own**. It was capped at 26px and then at 80px,
   *    and both were quotas deciding which units got named; the cap is gone.
   *  - A callout concedes down a **five-pass ladder** ending in one that lets leaders cross each
   *    other and pass under a name — the pass that turns "every unit is named" from an aspiration
   *    into a property.
   *
   * What is left is **D1 and A6**. D1 is the harder of the two: 35 units, eleven of them a single
   * district, and at the bar the country is 369px wide, so names are lost in the northern cluster
   * where units the size of a district compete for the same few rows of margin, and around the
   * delta in the south where the same thing happens.
   *
   * A6 loses exactly one, and it is **Islamabad** — a unit of one district, because the capital
   * territory is a province of one district in the census and a rule that partitions inside the
   * provinces has nothing there to divide. It is the smallest ground any unit in that variant
   * stands on, wedged between Rawalpindi's unit and Punjab's northern edge. Every lost name is on
   * the map, in the key beside it, in the card and in the tooltip; what they lack is a name on the
   * ground at this one size.
   *
   * The list is what makes this honest rather than a silent floor, and the test after it is what
   * makes it bearable: not one of them is lost for good.
   */
  const UNNAMEABLE_AT_390: Readonly<Record<string, readonly string[]>> = {
    a6: ['Islamabad'],
    d1: [
      'South Waziristan',
      'Torghar',
      'Lower Chitral',
      'Upper Chitral',
      'Hyderabad',
      // The unit around Karachi East, which is called Karachi: the four quarters are subdivisions
      // of one city and a proposed province named for one of them reads as a claim about a
      // quarter (`unit-names.ts`).
      'Karachi',
    ],
  };

  for (const variant of scenarios.variants) {
    it(`names every unit of ${variant.id}, so no proposed province is an unlabelled shape`, () => {
      const drawn = variantAt(variant.id, BAR_390);
      const unnamed = drawn.units.filter((name) => !drawn.placed.has(labelKey('unit', name)));
      expect(unnamed, variant.id).toEqual(UNNAMEABLE_AT_390[variant.id] ?? []);
    });

    it(`ranks ${variant.id}'s territories above every unit that is not one`, () => {
      /*
       * The rule, asked where it is decided rather than of the picture it produces (#28). Ranking
       * the tier on ground covered puts AJK and GB last of sixteen, which is backwards for the two
       * names this app is least free to drop — a territory drawn and anonymous is a claim, where a
       * proposed unit that gives way is a legibility cost that returns on zoom.
       *
       * Asked of every variant, and keyed on the kind the bundle records: H3 calls
       * Gilgit-Baltistan the *Northern Areas*, so a rule that recognised the territories by name
       * would stop protecting one the moment a variant renamed it.
       */
      const drawn = variantAt(variant.id, BAR_390);
      const units = drawn.sites.filter((s) => s.tier === 'unit');
      const isTerritory = (key: string) =>
        drawn.territories.some((name) => labelKey('unit', name) === key);
      const territories = units.filter((s) => isTerritory(s.key));
      const rest = units.filter((s) => !isTerritory(s.key));
      // A5 is the exception, and it is the one that proves the key is `kind`: its AJK and GB are
      // *promotions*, recorded as `proposed`, argued as provinces and ranked as the proposals they
      // are. It draws seven units and the case above names all seven.
      if (variant.id === 'a5') expect(territories).toEqual([]);
      for (const territory of territories) {
        for (const other of rest) {
          expect(
            territory.priority,
            `${variant.id}: ${territory.key} ranked under ${other.key}`,
          ).toBeGreaterThan(other.priority);
        }
      }
      // And still inside its own tier: a territory outranks the units, not the map.
      const divisionSite = drawn.sites.find((s) => s.tier === 'division');
      for (const territory of territories) {
        expect(territory.priority).toBeGreaterThan(divisionSite?.priority ?? Infinity);
      }
    });
  }

  it('leaves no territory anonymous, at the bar and under every variant', () => {
    /*
     * The obligation the politically sensitive rendering section states — AJK and GB drawn **and
     * named** — carried through into the variant views, where until #28 it was only true by luck:
     * with eight units there was room for everything, and with sixteen there is not.
     *
     * **There is no exception left, and the list is gone rather than shortened.** There was one
     * through #28 and #50 and one after them: H2's *Gilgit Agency and Baltistan*, which at 279px is
     * the longest unit name in the app, anchored in eastern Baltistan because Hunza and Nagar are
     * drawn out of its western end as the states they were. The arithmetic that excused it was
     * honest and is no longer true — every row of the frame either had no room for the name or was
     * too far from it to reach, under a leader cap of 0.6 of the frame's shorter side and a rule
     * that a leader might not cross ground the unit did not own.
     *
     * Two changes closed it and they are worth telling apart. The **leader may now travel**: the
     * transit cap that made this name unreachable was a quota on which units got named, and it is
     * gone. And `mustName` says out loud that a territory's name may not be dropped for want of
     * clear paper — the one carve-out in a layout that otherwise sets a callout outside the drawn
     * country or not at all, made for a constitutional claim rather than for a crowded frame.
     *
     * Asserted as an emptiness over every variant rather than as a shrinking list, because that is
     * the claim: a territory drawn anonymous is a claim this map is not entitled to make, and there
     * is now no size or selection at which it makes one.
     */
    for (const variant of scenarios.variants) {
      const drawn = variantAt(variant.id, BAR_390);
      const anonymous = drawn.territories.filter(
        (name) => !drawn.placed.has(labelKey('unit', name)),
      );
      expect(anonymous, variant.id).toEqual([]);
    }
  });

  it(
    'names every one of them as soon as there is room, so nothing is lost for good',
    () => {
      /*
       * What makes the list above a matter of pixels rather than of policy. A unit that could not
       * be named at *any* size would be a unit this app cannot draw honestly, and would belong in
       * the open items rather than in a layout test. It is the whole warrant for the list.
       *
       * The table is **empty as it stands**, and that is a finding rather than a default: every name
       * on the list above comes back at an ordinary 1200px desktop. It was four entries until the
       * Administrative rule was restated — A3's *Gujranwala* at 1440px and A1's, A2's and A3's
       * *Lahore* at 1920px, all four of them rule-drawn units of two or three districts in central
       * Punjab with rule-drawn units on every side competing for the same paper. Those maps are
       * retired; the rule that replaced them draws inside the existing provinces and puts nothing
       * that tight in Punjab, so nothing now needs a frame wider than the ordinary one.
       *
       * It is kept rather than deleted because the mechanism is the point: a name that wanted a
       * wider desktop is named with the width it wants rather than being allowed to raise the frame
       * for everybody, since a frame raised quietly to 1920 for the whole list would hide which
       * names needed it and how much.
       */
      const RETURNS_AT: Readonly<Record<string, { width: number; height: number }>> = {};
      for (const [id, units] of Object.entries(UNNAMEABLE_AT_390)) {
        for (const unit of units) {
          const frame = RETURNS_AT[`${id}:${unit}`] ?? { width: 1200, height: 800 };
          const drawn = variantAt(id, frame);
          expect(drawn.placed.has(labelKey('unit', unit)), `${id}: ${unit}`).toBe(true);
        }
      }
    },
    // Five whole variant layouts at a second frame, and the interior search behind `labelAnchor`
    // is not cheap. A timeout raised because the work grew, not because anything here is slow.
    30_000,
  );
});

/**
 * A unit name inside the unit it names (#50) — the claim the whole pass exists to make.
 *
 * Before it, a name was measured against the shape's *bounding box*, which on a crescent, a coastal
 * strip or one of #28's rule-drawn slivers is mostly other people's ground: `SOUTH PUNJAB` was set
 * 124px wide over 73px of room, and half of it lay in the Punjab the proposal is carved out of. On
 * a map whose whole subject is which district belongs to whom, that is a claim nobody wrote.
 */
describe('a unit name sits inside the unit it names', () => {
  /** A point on screen, back on the ground — how the map's own hover already asks this question. */
  const groundAt = (
    project: ReturnType<typeof fitProjection>,
    point: readonly [number, number],
  ) => project.invert?.([point[0], point[1]]) ?? null;

  for (const id of ['l1', 'l7', 'a6', 'h2', 'd1']) {
    it(`keeps every one of ${id}'s names off its neighbours' ground`, () => {
      const drawn = variantAt(id, BAR_390);
      const units = readUnitOutlines(bundle as never, outlines as unknown as UnitOutlineBundle, id);
      const project = fitProjection(provinces, drawn.viewport);

      for (const feature of units.features) {
        const key = labelKey('unit', feature.properties.name);
        const placed = drawn.at.get(key);
        // A name on a leader is outside its ground on purpose, and a name that was dropped is not
        // on the map at all. This is about the ones set *on* the unit.
        if (placed === undefined || placed.leader !== undefined) continue;
        const box = drawn.sized.get(key) as LabelBox;
        // All four corners, not the centre: a box whose middle is in Balochistan and whose left
        // end is in Sindh is exactly the failure, and only the corners can see it.
        for (const dx of [-1, 1]) {
          for (const dy of [-1, 1]) {
            const corner = groundAt(project, [
              placed.x + (dx * box.width) / 2,
              placed.y + (dy * box.height) / 2,
            ]);
            expect(corner, `${id}: ${feature.properties.name} corner off the projection`).not.toBe(
              null,
            );
            expect(
              geoContains(feature as never, corner as [number, number]),
              `${id}: ${feature.properties.name} sets outside its own ground`,
            ).toBe(true);
          }
        }
      }
    });
  }

  it('measures the room the shape leaves, not the box it fits in', () => {
    // A right-angled wedge: the bounding box is 100 wide, and at a point near the hypotenuse there
    // is almost nothing. `interiorRoom` is the difference between those two answers.
    const wedge: Ring[] = [
      [
        [0, 0],
        [100, 0],
        [0, 100],
        [0, 0],
      ],
    ];
    // Screen px, so `up` is toward the top of the frame and the wedge's two straight sides are the
    // ones the point is near.
    const middle = interiorRoom(wedge, [20, 20]);
    expect(middle.reach).toMatchObject({ left: 20, up: 20 });
    // Right and down run to the hypotenuse, which at (20,20) is 60 away in each direction.
    expect(middle.reach.right).toBeCloseTo(60);
    expect(middle.reach.down).toBeCloseTo(60);
    // Twice the *shorter* reach, less the clearance each side — the box is centred on the point.
    expect(middle.width).toBeCloseTo(2 * (20 - LABEL_CLEARANCE));

    // Hard against the hypotenuse there is no room at all, though the bounding box has not moved.
    const corner = interiorRoom(wedge, [96, 2]);
    expect(corner.width).toBe(0);
  });

  it('stops at a hole rather than reading through it', () => {
    // Muzaffarabad wraps around Poonch; the room inside the wrap is the room to the *inner* edge.
    const ringed: Ring[] = [
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [0, 0],
      ],
      [
        [40, 40],
        [60, 40],
        [60, 60],
        [40, 60],
        [40, 40],
      ],
    ];
    expect(interiorRoom(ringed, [20, 50]).reach).toMatchObject({ left: 20, right: 20 });
  });

  it('reports no room at all for a point that is not in the shape', () => {
    const square: Ring[] = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ];
    const outside = interiorRoom(square, [50, 50]);
    expect([outside.width, outside.height]).toEqual([0, 0]);
  });
});

describe('wrappedLines — the same name over two lines', () => {
  it('breaks between words at the split that leaves the halves closest in length', () => {
    // The atlas answer to a long name on a compact ground, and the reason `Rahim Yar Khan` can be
    // written inside Rahim Yar Khan: on one line the box is as wide as the sum of three words, on
    // two it is as wide as the wider half.
    expect(wrappedLines('Rahim Yar Khan')).toEqual(['Rahim', 'Yar Khan']);
    expect(wrappedLines('Kambar Shahdadkot')).toEqual(['Kambar', 'Shahdadkot']);
    expect(wrappedLines('Gilgit Agency and Baltistan')).toEqual(['Gilgit Agency', 'and Baltistan']);
  });

  it('decides the break from the text and never from the measurement', () => {
    // The objection `labelLines` records, and it is a real one: a name broken wherever the type ran
    // out breaks somewhere different at every zoom, and a reader watching a proposal's name reflow
    // as they lean in is reading the layout rather than the map. The split is a property of the
    // string, so it is the same at every size and on every frame.
    const once = wrappedLines('Dera Ismail Khan');
    expect(wrappedLines('Dera Ismail Khan')).toEqual(once);
    expect(once).toEqual(['Dera', 'Ismail Khan']);
  });

  it('leaves alone what it cannot help', () => {
    // One word has nowhere to break, and a bracketed name breaks already — wrapping that again
    // would put its own qualifier on a third line.
    expect(wrappedLines('Torghar')).toEqual(['Torghar']);
    expect(wrappedLines('Gilgit-Baltistan')).toEqual(['Gilgit-Baltistan']);
    expect(wrappedLines('Balochi (Kech)')).toEqual(['Balochi (Kech)']);
  });

  it('is offered after the whole name and before the abbreviation, on a ground that needs it', () => {
    /*
     * The order is the argument: keeping the name a reader is looking for is worth more than
     * keeping it on one line, and worth less than nothing invented. Asserted through `measureLabel`
     * rather than by reading the ladder, because the order only matters where it decides something.
     */
    const site = {
      key: labelKey('unit', 'Rahim Yar Khan'),
      text: 'Rahim Yar Khan',
      tier: 'unit' as const,
      anchor: [0, 0] as [number, number],
      priority: 20,
    };
    const whole = measure('Rahim Yar Khan', 'unit').width;
    const wider = measure('Yar Khan', 'unit').width;
    // A ground that takes the wrapped name at full size and could never take the whole one: wider
    // than its wider line and its clearance, and narrower than the name set on one.
    const half = wider / 2 + LABEL_CLEARANCE + 1;
    const ground: Ring[] = [
      [
        [-half, -40],
        [half, -40],
        [half, 40],
        [-half, 40],
        [-half, -40],
      ],
    ];
    expect(2 * half).toBeLessThan(whole);
    const fitted = measureLabel(site, [0, 0], Infinity, measure, { rings: ground });
    expect(fitted.lines).toEqual(['Rahim', 'Yar Khan']);
    expect(fitted.scale).toBe(1);
    expect(fitted.box.width).toBeCloseTo(wider);
    expect(fitted.box.callout).toBeUndefined();
  });
});

describe('labelLines', () => {
  it('breaks a bracketed name on the bracket, so the box is its widest line', () => {
    // L7's regions are a language and, in brackets, which of its two regions this is. Set on one
    // line the box is as wide as the sum of both; on two it is as wide as the wider.
    expect(labelLines('Balochi (Kech)')).toEqual(['Balochi', '(Kech)']);
    expect(labelLines('Pushto (Keamari)')).toEqual(['Pushto', '(Keamari)']);
  });

  it('breaks nowhere else — never on measurement, never on a hyphen', () => {
    // A name wrapped where it happened to run out of room breaks in different places at different
    // zooms, so a reader zooming in watches a proposal's name reflow; a hyphenation would coin a
    // spelling no source uses.
    expect(labelLines('Khyber Pakhtunkhwa')).toEqual(['Khyber Pakhtunkhwa']);
    expect(labelLines('Gilgit-Baltistan')).toEqual(['Gilgit-Baltistan']);
    expect(labelLines('Gilgit Agency and Baltistan')).toEqual(['Gilgit Agency and Baltistan']);
  });

  it('measures the broken name as its widest line and its two lines tall', () => {
    const site = {
      key: labelKey('unit', 'Balochi (Kech)'),
      text: 'Balochi (Kech)',
      tier: 'unit' as const,
      anchor: [0, 0] as [number, number],
      priority: 20,
    };
    const one = measureLabel(site, [0, 0], Infinity, measure);
    expect(one.lines).toEqual(['Balochi', '(Kech)']);
    // As wide as its widest line — seven characters, not the fourteen of the whole name — and
    // taller than one line by the leading.
    expect(one.box.width).toBeCloseTo(measure('Balochi', 'unit').width);
    expect(one.box.width).toBeLessThan(measure('Balochi (Kech)', 'unit').width);
    expect(one.box.height).toBeGreaterThan(measure('x', 'unit').height);
  });
});

describe('shrinking a unit name to fit its ground', () => {
  const site = (name: string) => ({
    key: labelKey('unit', name),
    text: name,
    tier: 'unit' as const,
    anchor: [0, 0] as [number, number],
    priority: 20,
  });
  /** A square of the given half-width, centred on the origin, in screen px. */
  const square = (half: number): Ring[] => [
    [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
      [-half, -half],
    ],
  ];

  it('sets a name at full size wherever its ground has room for it', () => {
    const fitted = measureLabel(site('Sindh'), [0, 0], Infinity, measure, { rings: square(200) });
    expect(fitted.scale).toBe(1);
    expect(fitted.box.callout).toBeUndefined();
  });

  it('sets it down rather than letting it overflow', () => {
    // Wide enough for the name at four-fifths of its size and not at full size.
    const full = measure('Sindh', 'unit').width;
    const room = full * 0.8 + 2 * LABEL_CLEARANCE;
    const fitted = measureLabel(site('Sindh'), [0, 0], Infinity, measure, {
      rings: square(room / 2),
    });
    expect(fitted.scale).toBeLessThan(1);
    expect(fitted.box.width).toBeLessThanOrEqual(room - 2 * LABEL_CLEARANCE);
    expect(fitted.box.callout).toBeUndefined();
  });

  it('never sets one larger than a province, and never below the legibility floor', () => {
    /*
     * Both ends are decisions rather than limits of the arithmetic. A unit is set as a province is
     * — told apart by colour and not by scale, because setting a proposal larger than the country
     * would be this app putting the two in an order. And 7.5px is the smallest type this map sets
     * at all: below it a name stops being read and becomes a mark, which is not an improvement on
     * a leader.
     *
     * **The floor was the district tier's 8.5px until #51.** That bound was defending a collision
     * that cannot happen: district names are not laid out below `DISTRICT_LABEL_ZOOM`, and at 6× a
     * unit has room to spare and is nowhere near the floor, so the two tiers never co-occur at a
     * size where a reader could compare them. What is asserted now is the half of the rule that was
     * ever load-bearing — an absolute floor, said in the renderer's own sizes rather than as a
     * number typed twice.
     */
    for (const half of [400, 60, 30, 12, 4, 1]) {
      const fitted = measureLabel(site('Balochistan'), [0, 0], Infinity, measure, {
        rings: square(half),
      });
      expect(fitted.scale, `at ${half}`).toBeLessThanOrEqual(1);
      expect(fitted.scale, `at ${half}`).toBeGreaterThanOrEqual(MIN_UNIT_LABEL_SCALE);
    }
    expect(measure('x', 'unit', MIN_UNIT_LABEL_SCALE).height).toBeCloseTo(6.5, 1);
    // Still smaller than a unit set at full size, which is what makes the ladder a ladder.
    expect(measure('x', 'unit', MIN_UNIT_LABEL_SCALE).height).toBeLessThan(
      measure('x', 'unit').height,
    );
  });

  it('goes to a leader rather than below the floor', () => {
    const tiny = measureLabel(site('Balochistan'), [0, 0], Infinity, measure, {
      rings: square(8),
    });
    expect(tiny.box.callout).toBeDefined();
    /*
     * Out on the paper at `CALLOUT_SCALE` — one step down, and the same step for every callout
     * (#51). It goes back to its full *form*, having been shortened to fit a room it is no longer
     * in, but not to full size: an in-ground name may now be set as small as 7.5px, so a full-size
     * callout would make the loudest type on the map belong to the units that fit worst.
     */
    expect(tiny.scale).toBe(CALLOUT_SCALE);
    expect(tiny.box.callout?.reach).toMatchObject({ left: 8, right: 8 });
  });

  it('tries the unit’s own abbreviation before any of this', () => {
    // The order #50 leaves alone: an attested short form first, and nothing is ever invented.
    const short = measureLabel(site('Khyber Pakhtunkhwa'), [0, 0], 10, measure, {
      rings: square(200),
    });
    expect(short.lines).toEqual(['KP']);
    expect(short.scale).toBe(1);
  });
});

describe('a name taken outside its ground, on a leader', () => {
  const callout = (
    name: string,
    from: Point,
    reach: { left: number; right: number },
    width = 60,
  ): LabelBox => ({
    key: labelKey('unit', name),
    x: from[0],
    y: from[1],
    width,
    height: 13,
    priority: 20,
    callout: { from, reach },
  });
  const bounds = { width: 400, height: 300 };

  it('sets the name outside the shape, with the dot before its first character', () => {
    const [placed] = layoutLabels([callout('Nagar', [100, 150], { left: 20, right: 20 })], {
      bounds,
      gap: 3,
    });
    const leader = placed?.leader;
    expect(leader).toBeDefined();
    if (leader === undefined || placed === undefined) return;
    // The dot is clear of the shape's own right edge…
    expect(leader.to[0]).toBeGreaterThan(100 + 20);
    // …and immediately before the first character, which is half the box to the left of centre.
    expect(placed.x - 60 / 2).toBeGreaterThan(leader.to[0]);
    expect(placed.x - 60 / 2 - leader.to[0]).toBeLessThan(10);
    // One elbow, and it is square: along the anchor's own line, then into the dot.
    expect(leader.from).toEqual([100, 150]);
    expect(leader.elbow).toEqual([leader.to[0], leader.from[1]]);
  });

  it('takes it to the other side where the frame will not take it on this one', () => {
    // Hard against the right edge: there is no paper to the right, so the whole assembly goes left
    // and still reads dot-then-name.
    const [placed] = layoutLabels([callout('Nagar', [380, 150], { left: 20, right: 20 })], {
      bounds,
      gap: 3,
    });
    expect(placed?.leader).toBeDefined();
    expect(placed?.x).toBeLessThan(380 - 20);
    expect((placed?.leader as Leader).to[0]).toBeLessThan((placed as PlacedLabel).x);
  });

  it('never crosses another label, and never another leader', () => {
    /*
     * The rule that makes a leader worth drawing, asked **where there is paper to obey it in**. A
     * line that crosses a name points at a word rather than at a piece of ground, and two that
     * cross each other swap the two units they name.
     *
     * It is no longer absolute, and the case below is written so that it is not being asked to be.
     * The concession ladder in `placeCallout` ends in a pass that lets a leader cross another and
     * pass beneath a name, because **every unit is named** outranks it: a crossed leader is a poor
     * annotation and a recoverable one, where a unit drawn on the map and named nowhere on it is a
     * shape the reader cannot ask about. So the claim held here is the first four rungs of that
     * ladder — given room, nothing crosses — and the case after it holds the fifth.
     */
    const labels: LabelBox[] = [
      callout('one', [100, 110], { left: 15, right: 15 }),
      callout('two', [110, 160], { left: 15, right: 15 }),
      callout('three', [120, 210], { left: 15, right: 15 }),
      { key: 'unit:settled', x: 300, y: 40, width: 60, height: 13, priority: 99 },
    ];
    const placed = layoutLabels(labels, { bounds, gap: 3 });
    const boxes = new Map(labels.map((l) => [l.key, l]));
    const rects = placed.map((p) => {
      const box = boxes.get(p.key) as LabelBox;
      return {
        x0: p.x - box.width / 2,
        y0: p.y - box.height / 2,
        x1: p.x + box.width / 2,
        y1: p.y + box.height / 2,
      };
    });
    // Kept per leader rather than as one flat list: a leader's own two segments meet at its elbow,
    // which is a join and not a crossing, and flattening them would report every elbow as a defect.
    const drawn = placed.flatMap((p) =>
      p.leader === undefined
        ? []
        : [
            [
              [p.leader.from, p.leader.elbow] as const,
              [p.leader.elbow, p.leader.to] as const,
            ],
          ],
    );
    expect(drawn.length, 'no leader was drawn, so nothing was tested').toBeGreaterThan(1);
    for (const [i, leader] of drawn.entries()) {
      for (const segment of leader) {
        for (const rect of rects) expect(touches(segment, rect)).toBe(false);
        for (const [j, other] of drawn.entries()) {
          if (i === j) continue;
          for (const part of other) expect(crosses(segment, part)).toBe(false);
        }
      }
    }
  });

  it('crosses rather than gives up the name, where the paper leaves it no third answer', () => {
    /*
     * The fifth rung, and the property the whole ladder exists for: **a unit is named**.
     *
     * Six callouts hung off the same few rows, which is D1's northern cluster in miniature — eight
     * units the size of a district competing for one margin. There is not room for six leaders that
     * never meet, and the honest answer is six names with some of the lines crossing rather than
     * four names and two shapes a reader cannot ask about. Asserted as the conjunction, since either
     * half alone would pass while the other was broken: every name is placed, and no two *names*
     * overlap — the concession is always to the lines.
     */
    const crowded: LabelBox[] = Array.from({ length: 6 }, (_, i) =>
      callout(`unit ${i}`, [190 + i * 4, 120 + i * 6], { left: 12, right: 12 }, 80),
    );
    const placed = layoutLabels(crowded, { bounds, gap: 3 });
    expect(placed.map((p) => p.key).sort()).toEqual(crowded.map((l) => l.key).sort());
    const boxes = new Map(crowded.map((l) => [l.key, l]));
    const rects = placed.map((p) => {
      const box = boxes.get(p.key) as LabelBox;
      return {
        x0: p.x - box.width / 2,
        y0: p.y - box.height / 2,
        x1: p.x + box.width / 2,
        y1: p.y + box.height / 2,
      };
    });
    for (const [i, a] of rects.entries()) {
      for (const [j, b] of rects.entries()) {
        if (i >= j) continue;
        const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
        expect(apart, `${crowded[i]?.key} overlaps ${crowded[j]?.key}`).toBe(true);
      }
    }
  });

  it('takes the name out toward its own unit’s nearest margin, not the far one', () => {
    /*
     * The orientation rule: a Khyber Pakhtunkhwa unit's name belongs in the north-western margin
     * and a Sindh unit's in the southern one, so that a reader looking at a province finds that
     * province's names beside it. Asked of the *unit* rather than of the country's middle, which is
     * the correction that made it right — a unit a few px the wrong side of the midline was being
     * pushed "outward" across the country, past the paper a short run from its own ground.
     *
     * Land occupying the right of the frame, and a unit at its western edge: the near margin is the
     * western one, and the name goes there even though the eastern paper is emptier.
     */
    const land: Ring[] = [
      [
        [140, 0],
        [400, 0],
        [400, 300],
        [140, 300],
        [140, 0],
      ],
    ];
    const placed = layoutLabels([callout('west', [150, 150], { left: 10, right: 10 }, 60)], {
      bounds,
      gap: 3,
      land,
    });
    const leader = placed[0]?.leader as Leader;
    expect(leader.to[0]).toBeLessThan(140);
  });

  it('prefers the flat leader over the bent one that is barely shorter', () => {
    /*
     * Ranked on raw length, a leader that drops two rungs to save three pixels of run beats the
     * plain horizontal one, and a column of names each bent a different amount is what the reader
     * gets. A bend is charged against the straight run it replaces, so rung zero — no elbow at all
     * — is what an uncontested name reaches for.
     *
     * Asked of an *eastward* callout, which is the side where rung zero is available at all: the
     * assembly reads dot-then-name, so a westward name sits between its own dot and its ground and
     * a leader on that row would run through it. That asymmetry is the routing's, not the
     * ranking's, and it is asserted rather than worked around.
     */
    const land: Ring[] = [
      [
        [0, 0],
        [300, 0],
        [300, 300],
        [0, 300],
        [0, 0],
      ],
    ];
    const placed = layoutLabels([callout('flat', [250, 150], { left: 10, right: 10 }, 60)], {
      bounds,
      gap: 3,
      land,
    });
    const leader = placed[0]?.leader as Leader;
    expect(leader.to[0]).toBeGreaterThan(300);
    expect(leader.to[1]).toBe(leader.from[1]);
    // Rung zero: the elbow is the dot, so the whole leader is one straight run.
    expect(leader.elbow).toEqual(leader.to);
  });

  it('drops the name where the frame itself has no room for it', () => {
    // A name wider than the frame, with nowhere either side of its anchor to put it. No pass of the
    // ladder can help: the concessions are about clearance, and this one does not fit at all.
    const impossible = callout('vast', [200, 150], { left: 100, right: 100 }, 380);
    expect(layoutLabels([impossible], { bounds, gap: 3 })).toEqual([]);
  });

  it('keeps leaders off ground something else is already standing on', () => {
    // The unit key and the docked tooltip are opaque boxes (#33). A leader that ran under one
    // would be a line disappearing into a panel, which explains nothing — so unlike a *name*, which
    // the last rung of the ladder will pass a leader beneath, these are refused at every pass. A
    // leader under a name is still followable; a leader under a panel is gone.
    const bar = { x0: 0, y0: 0, x1: 400, y1: 160 };
    const placed = layoutLabels([callout('Nagar', [100, 150], { left: 20, right: 20 })], {
      bounds,
      gap: 3,
      occupied: [bar],
    });
    for (const label of placed) {
      const leader = label.leader as Leader;
      for (const segment of [
        [leader.from, leader.elbow] as const,
        [leader.elbow, leader.to] as const,
      ]) {
        expect(touches(segment, bar)).toBe(false);
      }
    }
  });

  it('is what names the Northern Areas at the bar, which no ranking could', () => {
    // H3 calls Gilgit-Baltistan the *Northern Areas*, and until #50 that name ran off the right
    // edge of a 369px frame and the territory was drawn anonymous — the failure the politically
    // sensitive rendering section exists to prevent, and one a priority cannot reach because the
    // name was never competing with anything. A callout does not have to be over its own ground.
    const drawn = variantAt('h3', BAR_390);
    const placed = drawn.at.get(labelKey('unit', 'Northern Areas'));
    expect(placed).toBeDefined();
    expect(placed?.leader).toBeDefined();
  });
});

/** Whether a segment meets a rectangle at all, asked independently of the module under test. */
function touches(segment: readonly [Point, Point], rect: Rect): boolean {
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = segment[0][0] + (segment[1][0] - segment[0][0]) * t;
    const y = segment[0][1] + (segment[1][1] - segment[0][1]) * t;
    if (x > rect.x0 && x < rect.x1 && y > rect.y0 && y < rect.y1) return true;
  }
  return false;
}

/** Whether two segments properly cross, by the sign of the four orientations. */
function crosses(a: readonly [Point, Point], b: readonly [Point, Point]): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const [s1, s2, s3, s4] = [
    side(a[0], a[1], b[0]),
    side(a[0], a[1], b[1]),
    side(b[0], b[1], a[0]),
    side(b[0], b[1], a[1]),
  ];
  return s1 > 0 !== s2 > 0 && s3 > 0 !== s4 > 0;
}

interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

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
