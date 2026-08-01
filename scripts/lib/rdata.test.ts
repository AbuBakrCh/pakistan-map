import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readDataFrames } from './rdata.ts';

/**
 * A byte-level builder for R's XDR serialization, used to hand-build fixtures.
 *
 * Writing the format out by hand is the point: it pins the reader against the spec rather than
 * against whatever the one real file happens to contain, and it is the only way to exercise the
 * cases the census tables do not have — NA, an empty frame, an unsupported node.
 */
class Writer {
  private readonly bytes: number[] = [];

  int32(value: number): this {
    this.bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
    return this;
  }

  float64(value: number): this {
    const buffer = new DataView(new ArrayBuffer(8));
    buffer.setFloat64(0, value);
    for (let i = 0; i < 8; i += 1) this.bytes.push(buffer.getUint8(i));
    return this;
  }

  ascii(text: string): this {
    for (const character of text) this.bytes.push(character.charCodeAt(0));
    return this;
  }

  /**
   * A CHARSXP: the string payload every R name and character element is made of.
   *
   * `levels` are R's encoding flags, packed from bit 12 up — LATIN1 is `1 << 2`, UTF8 `1 << 3`,
   * ASCII `1 << 6`. Default 0 is "native", which is what the census tables carry.
   */
  char(text: string, levels = 0): this {
    return this.int32(9 | (levels << 12)).int32(text.length).ascii(text);
  }

  symbol(name: string): this {
    return this.int32(1).char(name);
  }

  strings(values: readonly string[], levels = 0): this {
    this.int32(16).int32(values.length);
    for (const value of values) this.char(value, levels);
    return this;
  }

  /** An integer vector wearing a `levels` attribute — R's representation of a factor. */
  factor(codes: readonly number[], labels: readonly string[]): this {
    this.int32(13 | (1 << 9)).int32(codes.length);
    for (const code of codes) this.int32(code);
    this.int32(2 | (1 << 10)).symbol('levels').strings(labels).nil();
    return this;
  }

  doubles(values: readonly (number | 'NA')[]): this {
    this.int32(14).int32(values.length);
    for (const value of values) this.float64(value === 'NA' ? Number.NaN : value);
    return this;
  }

  ints(values: readonly (number | 'NA')[]): this {
    this.int32(13).int32(values.length);
    for (const value of values) this.int32(value === 'NA' ? -2147483648 : value);
    return this;
  }

  nil(): this {
    return this.int32(254);
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** Wrap one named object in the file header and the top-level `name -> object` pairlist. */
function file(name: string, body: (w: Writer) => void): Uint8Array {
  const writer = new Writer();
  writer.ascii('RDX2\nX\n').int32(2).int32(0x040301).int32(0x020300);
  writer.int32(2 | (1 << 10)).symbol(name); // a tagged pairlist entry
  body(writer);
  return writer.nil().build();
}

/** A `data.frame` is a VECSXP of columns carrying a `names` attribute. */
function frame(writer: Writer, columns: readonly string[], write: (w: Writer) => void): void {
  writer.int32(19 | (1 << 9)).int32(columns.length);
  write(writer);
  writer.int32(2 | (1 << 10)).symbol('names').strings(columns).nil();
}

describe('readDataFrames', () => {
  it('reads a data.frame back as rows keyed by column name', () => {
    const bytes = file('Census', (w) =>
      frame(w, ['District', 'Pop2023'], (inner) => {
        inner.strings(['Lahore', 'Multan']);
        inner.doubles([13_004_135, 5_362_305]);
      }),
    );

    const frames = readDataFrames(bytes);
    expect([...frames.keys()]).toEqual(['Census']);
    expect(frames.get('Census')).toEqual({
      columns: ['District', 'Pop2023'],
      rows: [
        { District: 'Lahore', Pop2023: 13_004_135 },
        { District: 'Multan', Pop2023: 5_362_305 },
      ],
    });
  });

  it('accepts the file gzipped, which is how R saves it', () => {
    const bytes = file('Census', (w) =>
      frame(w, ['District'], (inner) => inner.strings(['Quetta'])),
    );
    expect(readDataFrames(new Uint8Array(gzipSync(bytes)))).toEqual(readDataFrames(bytes));
  });

  it('keeps missing values missing, in every vector type', () => {
    // NA is not zero and not the empty string. A population that silently became 0 would still
    // sum, still render, and still be wrong.
    const bytes = file('Census', (w) =>
      frame(w, ['Name', 'Pop', 'Households'], (inner) => {
        inner.strings(['Quetta']).doubles(['NA']).ints(['NA']);
      }),
    );
    expect(readDataFrames(bytes).get('Census')?.rows[0]).toEqual({
      Name: 'Quetta',
      Pop: null,
      Households: null,
    });
  });

  it('reads an empty table without inventing a row', () => {
    const bytes = file('Census', (w) => frame(w, ['District'], (inner) => inner.strings([])));
    expect(readDataFrames(bytes).get('Census')?.rows).toEqual([]);
  });

  it('refuses a table whose columns are ragged', () => {
    const bytes = file('Census', (w) =>
      frame(w, ['District', 'Pop2023'], (inner) => {
        inner.strings(['Lahore', 'Multan']).doubles([1]);
      }),
    );
    expect(() => readDataFrames(bytes)).toThrow(/unequal length/);
  });

  it('reads a string the writer flagged UTF-8, and one it flagged ASCII', () => {
    const bytes = file('Census', (w) =>
      frame(w, ['Utf8', 'Ascii'], (inner) =>
        inner.strings(['Quetta'], 1 << 3).strings(['Lahore'], 1 << 6),
      ),
    );
    expect(readDataFrames(bytes).get('Census')?.rows[0]).toEqual({
      Utf8: 'Quetta',
      Ascii: 'Lahore',
    });
  });

  it('refuses a latin1 string rather than decoding it as UTF-8', () => {
    // District names are what the join matches on. A latin1 name decoded as UTF-8 is mojibake
    // that matches no roster entry — and one that happens to be pure ASCII would pass while its
    // neighbour failed, which is the worst of the two outcomes.
    const bytes = file('Census', (w) =>
      frame(w, ['District'], (inner) => inner.strings(['Quetta'], 1 << 2)),
    );
    expect(() => readDataFrames(bytes)).toThrow(/latin1/);
  });

  it('refuses a column count that disagrees with the name count', () => {
    // `?? null` would fill an unnamed column's cells with nulls indistinguishable from real NAs.
    const bytes = file('Census', (w) => {
      w.int32(19 | (1 << 9)).int32(2);
      w.strings(['Lahore']).doubles([1]);
      w.int32(2 | (1 << 10)).symbol('names').strings(['District']).nil();
    });
    expect(() => readDataFrames(bytes)).toThrow(/2 column\(s\) but 1 name\(s\)/);
  });

  it('refuses a factor column rather than emitting its level codes as data', () => {
    // A factor is integer codes plus a `levels` attribute. Read as-is, a factor District column
    // is the numbers 1..n and a factor Pop2023 column is ranks — both plausible integers.
    const bytes = file('Census', (w) =>
      frame(w, ['District'], (inner) => inner.factor([1, 2], ['Lahore', 'Multan'])),
    );
    expect(() => readDataFrames(bytes)).toThrow(/is a factor/);
  });

  it('throws on a node type it does not understand rather than guessing', () => {
    // The reader covers what the census tables use. Anything else is a payload it would have to
    // guess at, and a mis-parsed vector reads as real data until someone checks a total.
    const writer = new Writer();
    writer.ascii('RDX2\nX\n').int32(2).int32(0x040301).int32(0x020300);
    writer.int32(2 | (1 << 10)).symbol('Census').int32(6); // 6 = LANGSXP, unsupported
    expect(() => readDataFrames(writer.build())).toThrow(/node type 6 is not supported/);
  });

  it('rejects a file that is not XDR-serialized R data', () => {
    expect(() => readDataFrames(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/XDR/);
  });
});
