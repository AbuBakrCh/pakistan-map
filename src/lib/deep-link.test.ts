/**
 * What a shared link draws (#23).
 *
 * Run against the committed scenario bundle, like the selector tests beside it: the set of
 * variants a URL may name is a property of the artifact, and a test that stubbed it would assert
 * only that the parser agrees with a fixture nobody ships.
 *
 * This is the whole of the testable half. The history calls themselves live in `main.ts`, which
 * carries no tests and has no DOM seam to carry them in — so what is held here is the decision
 * every one of those calls is made on: what the hash resolves to, and whether the reader chose it.
 */

import { describe, expect, it } from 'vitest';
import scenarios from '../../data/bundle/scenarios.json';
import type { BasisId, ScenarioBundle } from '../bundle.ts';
import { BASELINE_HASH, hashFor, readRoute } from './deep-link.ts';
import { BASELINE, basisChoices } from './selection.ts';

const bundle = scenarios as unknown as ScenarioBundle;
/** What this build can actually shade. `main.ts` derives the same set from its fill table. */
const SHADEABLE = new Set<BasisId>(['language', 'administrative', 'development']);
const choices = basisChoices(bundle, SHADEABLE);

const route = (hash: string) => readRoute(hash, bundle, choices);

describe('hashFor', () => {
  it('gives the baseline a URL of its own, rather than the absence of one', () => {
    // The baseline is a view — it is what every variant is argued against (D17) — so it is
    // linkable like any other. An empty hash would make leaving a variant a deletion of the URL
    // rather than a change to it, and would leave "the current map" with nothing to send.
    expect(hashFor(BASELINE)).toBe(BASELINE_HASH);
    expect(BASELINE_HASH).toBe('#/');
  });

  it('names the basis and the variant, in the form the spec writes them', () => {
    expect(hashFor({ basis: 'language', variant: 'l1' })).toBe('#/language/l1');
  });

  it('round-trips every selection this build can reach, the baseline included', () => {
    // Both directions, over the real set: a hash that reads back as a different variant would be
    // a link that draws a proposal its sender never had on screen. Restricted to the variants
    // this build can *reach*, which is not the same as the variants it ships — the Historical
    // basis has four written and is withheld from the menu, and a link to one of those is answered
    // with the baseline on purpose, asserted by name below. `#/development/d1` is on this list rather
    // than that one as of #31, which is the whole of what that ticket changed about linking.
    const selections = [
      BASELINE,
      ...bundle.variants
        .filter((variant) => SHADEABLE.has(variant.basis))
        .map((variant) => ({ basis: variant.basis, variant: variant.id })),
    ];
    expect(selections.length).toBeGreaterThan(1);
    for (const selection of selections) {
      const read = route(hashFor(selection));
      expect(read.selection, hashFor(selection)).toEqual(selection);
      expect(read.asWritten, hashFor(selection)).toBe(true);
    }
  });

  it('uses the variant ids the bundle already guarantees are unique', () => {
    // No parallel id scheme: `bundle.test.ts` holds these unique, and a second set of link ids
    // would be a second thing to keep in step with the first.
    const ids = bundle.variants.map((variant) => variant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('readRoute', () => {
  it('restores the exact basis and variant a link names', () => {
    expect(route('#/language/l1')).toEqual({
      selection: { basis: 'language', variant: 'l1' },
      asWritten: true,
    });
  });

  it('enters a basis named alone on its first variant, and says the URL was corrected', () => {
    // D13: a basis is never active on its own. `#/language` is therefore a link to `l1`, and the
    // only substitution this module makes — but the reader did not choose `l1`, so `asWritten` is
    // false and the caller rewrites the address bar without spending a history entry on it.
    expect(route('#/language')).toEqual({
      selection: { basis: 'language', variant: 'l1' },
      asWritten: false,
    });
  });

  it('answers an unknown variant with the country, not with the basis’s first variant', () => {
    // The substitution that is *not* made. A reader arriving from a stranger's link has no way to
    // tell a proposal they were sent from one this app picked, so a dead variant id draws the
    // baseline rather than putting a claim on screen that the link never made.
    expect(route('#/language/l99').selection).toBeNull();
    expect(route('#/language/l99').asWritten).toBe(false);
  });

  it('falls back for a basis this build cannot draw, rather than fading the map for nothing', () => {
    // The URL is not a way in through the back of a control that already refuses it out loud: the
    // one unshaded basis is unreachable by link for exactly as long as it is unreachable by chip,
    // and the two cannot drift because both read the same `choices`.
    expect(route('#/historical').selection).toBeNull();
    expect(route('#/historical/x1').selection).toBeNull();
  });

  it('reaches the administrative basis by link, and enters it on its first variant', () => {
    // The two URLs whose answer changed when the population fill landed: a reader sent either of
    // these before it did came out on the country instead.
    expect(route('#/administrative/a6')).toEqual({
      selection: { basis: 'administrative', variant: 'a6' },
      asWritten: true,
    });
    expect(route('#/administrative')).toEqual({
      selection: { basis: 'administrative', variant: 'a6' },
      asWritten: false,
    });
    // And every id this basis has retired resolves to the baseline, not to the map that is still
    // here. A link carries a claim; answering it with a different proposal under the same address
    // is the substitution this parser refuses by design — which matters most for **a5**, the
    // constitutional-regularisation map, since a reader who bookmarked the proposal that moves no
    // district must not be handed the rule-drawn one that moves 135.
    for (const dead of ['a1', 'a2', 'a3', 'a4', 'a5']) {
      expect(route(`#/administrative/${dead}`).selection, dead).toBeNull();
    }
  });

  it('reaches the development basis by link, and enters it on its one variant', () => {
    // #31 closed both halves of what Development was short of, so `#/development/d1` is now a URL
    // that draws something — and `#/development` alone is a link to it, which is D13 rather than a
    // guess. Named here because these are the two URLs whose *answer changed*: a reader sent one
    // before this ticket landed on the country instead.
    expect(route('#/development/d1')).toEqual({
      selection: { basis: 'development', variant: 'd1' },
      asWritten: true,
    });
    expect(route('#/development')).toEqual({
      selection: { basis: 'development', variant: 'd1' },
      asWritten: false,
    });
  });

  it('refuses a link to a variant whose basis this build does not offer', () => {
    // H1, H3 and H4 are written, complete and drawable, and Historical is withheld from the menu.
    // A link to one must land on the baseline: the URL is not a way in through the back of a
    // control that does not offer the basis at all — named rather than counted, since these are
    // the URLs a reader is most likely to have been sent while the basis was still on the strip.
    for (const id of ['h1', 'h3', 'h4']) {
      expect(route(`#/historical/${id}`).selection, id).toBeNull();
      expect(route(`#/historical/${id}`).asWritten, id).toBe(false);
    }
    // And the same, held against a build that can shade nothing at all.
    const unshaded = basisChoices(bundle, new Set<BasisId>());
    expect(readRoute('#/language/l1', bundle, unshaded).selection).toBeNull();
  });

  it('lets the variant settle a hash whose two halves disagree', () => {
    // The basis is the variant's own, exactly as it is when a control switches variants — a
    // variant shaded against evidence it was not argued from would be a different claim. So the
    // variant wins and the URL is corrected under the reader rather than refused.
    expect(route('#/historical/l1')).toEqual({
      selection: { basis: 'language', variant: 'l1' },
      asWritten: false,
    });
  });

  it('refuses a real variant under a basis that is not one, rather than drawing half a URL', () => {
    // A disagreement between two segments that each name something real is settled above. This is
    // the different case: the first segment names nothing at all, so the hash is not a link with a
    // disagreement in it but a link this app did not write. Drawing L1 here would put a proposal on
    // screen on the strength of the half of the URL that happened to parse — and #23 asks for the
    // baseline, which is the one view that claims nothing.
    for (const hash of ['#/nonsense/l1', '#/langauge/l1', '#/l1/l1']) {
      expect(route(hash).selection, hash).toBeNull();
    }
  });

  it('reads an empty hash as the baseline, and asks to be given the baseline’s URL', () => {
    // A first visit. The view is right and the address bar is not, so the caller replaces it —
    // which is what gives the baseline its stable URL without putting an entry behind the page
    // the reader arrived on.
    for (const hash of ['', '#', '#/', '#//']) {
      expect(route(hash).selection, hash).toBeNull();
    }
    expect(route('#/').asWritten).toBe(true);
    expect(route('').asWritten).toBe(false);
  });

  it('treats case, whitespace and stray slashes as the same link, not as different ones', () => {
    // None of these is a different thing to ask for, and a link that has been through a chat
    // client has been through something.
    for (const hash of [
      '#/language/l1',
      '#/Language/L1',
      '#/LANGUAGE/L1/',
      '#//language//l1//',
      '  #/language/l1  ',
      '#/language/l1/',
      '#%2Flanguage%2Fl1',
    ]) {
      expect(route(hash).selection, hash).toEqual({ basis: 'language', variant: 'l1' });
    }
    // Right view, wrong URL: every one of them is rewritten to the canonical form.
    expect(route('#/Language/L1').asWritten).toBe(false);
  });

  it('answers garbage with the baseline and never with an exception', () => {
    // A hash is typed by strangers, mangled by mailers and truncated by everything. Refusing to
    // render the page over one would answer a bad link with a blank screen.
    for (const hash of [
      '#/%',
      '#/%E0%A4',
      '#nonsense',
      '#/language/l1/extra',
      '#/../../etc/passwd',
      '#/language?variant=l1',
      '#/l1',
      '#/language/l1#/language/l1',
      '#/{}[]<>',
      `#/${'l'.repeat(4096)}`,
    ]) {
      expect(() => route(hash), hash).not.toThrow();
      expect(route(hash).selection, hash).toBeNull();
    }
  });

  it('reads a variant id alone as nothing, because a URL this app wrote has two segments', () => {
    // `#/l1` is not a shorter spelling of `#/language/l1`; it is a hash naming a basis called
    // "l1". Accepting it would make the first segment mean two things and the form unreadable.
    expect(route('#/l1').selection).toBeNull();
  });
});
