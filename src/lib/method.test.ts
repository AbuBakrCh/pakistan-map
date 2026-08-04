/**
 * The method note (#52) — how the map on screen was built, said on the paper.
 *
 * Held over the committed bundle, like every other surface's words are: this box is prose about a
 * boundary, so the failure it can have is not a layout one. It is a summary describing a map that
 * cannot be selected — a basis or a variant id written here that the bundle does not have, or worse,
 * one it has *withdrawn* (A1 to A5) — and a summary that quietly replaced the rule of the basis it
 * belongs to. Both are asserted against `scenarios.json` rather than against a literal list, so a
 * variant added or retired later breaks this file instead of going unnoticed in it.
 *
 * The absences are asserted as absences, in the suite's own idiom: Historical has no summary written
 * and its box does not draw, which is a decision and has to fail loudly if it is ever half-answered.
 */

import { describe, expect, it } from 'vitest';
import scenarios from '../../data/bundle/scenarios.json';
import type { BasisId, ScenarioBundle } from '../bundle.ts';
import { BASELINE } from './selection.ts';
import { METHODS, methodNote } from './method.ts';

const bundle = scenarios as unknown as ScenarioBundle;
const written = Object.entries(METHODS) as [BasisId, NonNullable<(typeof METHODS)[BasisId]>][];
const variantsOf = (basis: BasisId): string[] =>
  bundle.variants.filter((variant) => variant.basis === basis).map((variant) => variant.id);

/** Every id this app has retired and will never reuse — the Administrative five (CLAUDE.md). */
const RETIRED = ['a1', 'a2', 'a3', 'a4', 'a5'];

describe('what is written, against what the bundle has', () => {
  it('writes a summary only for a basis the bundle publishes', () => {
    for (const [basis] of written) {
      expect(bundle.bases[basis], `${basis} is not a basis in the committed bundle`).toBeDefined();
    }
  });

  it('keys a variant paragraph only to a variant of that same basis', () => {
    for (const [basis, method] of written) {
      const ids = variantsOf(basis);
      for (const id of Object.keys(method.variants ?? {})) {
        expect(ids, `${id} is not a variant of the ${basis} basis`).toContain(id);
      }
    }
  });

  it('attaches no rule to a retired id, which is a rule for a proposal that is gone', () => {
    for (const [basis, method] of written) {
      for (const id of Object.keys(method.variants ?? {})) {
        expect(RETIRED, `${basis}/${id} is retired and must never be described`).not.toContain(id);
      }
    }
  });

  it('says something in every paragraph, and says it as text rather than as markup', () => {
    // Rendered with `textContent` by `main.ts`, so a tag written here would print as itself. The
    // check is not about escaping — it is about nobody writing markup that will never render.
    for (const [basis, method] of written) {
      expect(method.heading.length, basis).toBeGreaterThan(0);
      expect(method.shared.length, `${basis} has a heading and no rule under it`).toBeGreaterThan(0);
      for (const paragraph of [...method.shared, ...Object.values(method.variants ?? {})]) {
        expect(paragraph.trim().length, basis).toBeGreaterThan(0);
        expect(paragraph, basis).not.toMatch(/[<>]/);
        // The app's own punctuation. A straight quote in a box of set prose is the one typographic
        // slip a reader notices, and it sits beside the card, which has none.
        expect(paragraph, basis).not.toMatch(/'/);
      }
    }
  });
});

describe('methodNote — what a selection is given', () => {
  it('says nothing at the baseline, which is not built by a rule of ours', () => {
    expect(methodNote(BASELINE)).toBeNull();
  });

  it('gives a variant the basis’s rule first and its own reading after it', () => {
    const note = methodNote({ basis: 'language', variant: 'l3' });
    const shared = METHODS.language?.shared ?? [];
    expect(note).not.toBeNull();
    // The shared rule is never replaced: a variant that overwrote it would be free to describe a
    // method the map beside it was not drawn by.
    expect(note?.paragraphs.slice(0, shared.length)).toEqual(shared);
    expect(note?.paragraphs).toHaveLength(shared.length + 1);
    expect(note?.paragraphs.at(-1)).toContain('Saraikistan');
  });

  it('gives a variant with nothing of its own exactly the basis’s rule', () => {
    // A6 and D1 are one variant each on their basis, so the basis's rule *is* the map's.
    for (const active of [
      { basis: 'administrative', variant: 'a6' },
      { basis: 'development', variant: 'd1' },
    ] as const) {
      const shared = METHODS[active.basis]?.shared ?? [];
      expect(methodNote(active)?.paragraphs, active.variant).toEqual(shared);
    }
  });

  it('falls back to the basis’s rule for a variant id it has no line for', () => {
    // Unreachable from the URL — a dead id resolves to the baseline before this is asked (#23) — so
    // this is the answer to a variant added without a line, and it must be the rule, never nothing.
    const note = methodNote({ basis: 'language', variant: 'l99' });
    expect(note?.paragraphs).toEqual(METHODS.language?.shared);
  });
});

describe('the coverage, stated rather than left to be discovered', () => {
  it('gives every language variant a reading of its own, so the seven are told apart', () => {
    // Seven proposals on one basis, five of them transcribed and two derived: the shared rule alone
    // would print the same paragraph under seven different maps.
    const lines = METHODS.language?.variants ?? {};
    for (const id of variantsOf('language')) {
      expect(Object.keys(lines), `${id} has no reading of its own`).toContain(id);
    }
  });

  it('has no summary for Historical, and draws no box for it rather than half a one', () => {
    // The one basis still short of a summary — named here so it cannot be forgotten and cannot be
    // filled in by accident. Every one of its four variants is on the map and none of them says how.
    expect(METHODS.historical).toBeUndefined();
    for (const id of variantsOf('historical')) {
      expect(methodNote({ basis: 'historical', variant: id }), id).toBeNull();
    }
  });

  it('has one written for each of the three bases that can be drawn', () => {
    expect(written.map(([basis]) => basis).sort()).toEqual([
      'administrative',
      'development',
      'language',
    ]);
  });
});
