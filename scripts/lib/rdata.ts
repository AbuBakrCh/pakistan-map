/**
 * A reader for R's serialized data format (`.RData`), narrow enough to be reviewable.
 *
 * PBS publishes the 2023 Digital Census primarily as PDF. The one structured, licensed
 * republication of it is the CRAN package `PakPC2023` (GPL-2), which ships its tables as
 * `.RData` — gzip around R's XDR serialization. Reading that format here is what lets the
 * census cache be committed as the *upstream bytes* rather than as a hand transcription:
 * nobody has to trust that a human copied 136 populations out of a PDF correctly, because the
 * build parses the published file itself.
 *
 * Deliberately partial. It understands exactly the node types the census tables use and
 * **throws on anything else** rather than guessing — a silently mis-parsed vector is
 * indistinguishable from a real population until someone checks a total.
 *
 * Format reference: R Internals, "Serialization Formats".
 */

import { gunzipSync } from 'node:zlib';
import xz from 'xz-decompress';

export type Cell = string | number | null;

/** The containers an `.RData` arrives in. `save()` writes gzip; `compress = "xz"` writes xz. */
const GZIP_MAGIC = [0x1f, 0x8b];
const XZ_MAGIC = [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00];

const wrappedIn = (file: Uint8Array, magic: readonly number[]): boolean =>
  magic.every((byte, index) => file[index] === byte);

/**
 * Unwrap an xz-compressed `.RData`, leaving anything else exactly as it arrived.
 *
 * `PakPC2023` ships its three summary tables gzip — which `readDataFrames` unwraps itself,
 * because `gunzipSync` is synchronous — and its numbered tables, Table 11 among them, xz. Node's
 * `zlib` has no xz and the decoder is streaming, so that one container has to be unwrapped ahead
 * of the read rather than inside it. Kept here beside the gzip sniff all the same: which
 * containers an `.RData` can arrive in is one fact, and a build script that had to know half of
 * it would be the second place to update when the package changes how it compresses.
 *
 * `Response` below is a stream adapter over bytes already in memory, not a request — the decoder
 * takes a `ReadableStream` and this is the standard-library way to make one. Nothing here opens a
 * socket, and `seam.test.ts` re-checks that from the outside.
 */
export async function decompressRData(file: Uint8Array): Promise<Uint8Array> {
  if (!wrappedIn(file, XZ_MAGIC)) return file;
  const compressed = new Response(file as unknown as BodyInit).body;
  if (compressed === null) throw new Error('could not stream the .RData file for decompression');
  return new Uint8Array(await new Response(new xz.XzReadableStream(compressed)).arrayBuffer());
}

export interface DataFrame {
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, Cell>>[];
}

// SEXP type tags, R Internals.
const NIL = 254;
const REF = 255;
const SYM = 1;
const LIST = 2;
const CHAR = 9;
const LGL = 10;
const INT = 13;
const REAL = 14;
const STR = 16;
const VEC = 19;
const EXTPTR = 22;

/** R's integer NA is INT_MIN, not a flag alongside the value. */
const NA_INTEGER = -2147483648;

/**
 * A CHARSXP carries its encoding in the serialized "levels", which start at bit 12 of the flags
 * word (R's `PackFlags`: `val |= levs << 12`). Within the levels, R uses `LATIN1_MASK (1<<2)`,
 * `UTF8_MASK (1<<3)` and `ASCII_MASK (1<<6)`.
 */
const LEVELS_SHIFT = 12;
const LATIN1_MASK = 1 << 2;
const ASCII_MASK = 1 << 6;

type Attrs = ReadonlyMap<string, Node>;

/** An atomic vector: logical, integer, double or character. */
interface AtomicNode {
  readonly kind: 'atomic';
  readonly values: readonly Cell[];
  readonly attrs: Attrs;
}
/** A generic vector (`VECSXP`). A `data.frame` is one of these, holding its columns. */
interface ListNode {
  readonly kind: 'list';
  readonly elements: readonly Node[];
  readonly attrs: Attrs;
}
interface PairlistNode {
  readonly kind: 'pairlist';
  readonly entries: ReadonlyMap<string, Node>;
}

type Node = null | string | AtomicNode | ListNode | PairlistNode;

const DECODER = new TextDecoder('utf-8');

class Cursor {
  private offset = 0;
  /** R's reference table, for back-references to symbols already read. */
  private readonly refs: Node[] = [];

  constructor(private readonly view: DataView) {}

  uint32(): number {
    const value = this.view.getUint32(this.offset);
    this.offset += 4;
    return value;
  }

  int32(): number {
    const value = this.view.getInt32(this.offset);
    this.offset += 4;
    return value;
  }

  float64(): number {
    const value = this.view.getFloat64(this.offset);
    this.offset += 8;
    return value;
  }

  text(length: number): string {
    const slice = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return DECODER.decode(slice);
  }

  skip(length: number): void {
    this.offset += length;
  }

  addRef(node: Node): void {
    this.refs.push(node);
  }

  ref(index: number): Node {
    if (index < 1 || index > this.refs.length) {
      throw new Error(`RData reference ${index} is out of range`);
    }
    return this.refs[index - 1] as Node;
  }
}

function readNode(cursor: Cursor): Node {
  const flags = cursor.uint32();
  const type = flags & 0xff;
  const hasAttributes = ((flags >> 9) & 1) === 1;
  const hasTag = ((flags >> 10) & 1) === 1;

  switch (type) {
    case NIL:
      return null;

    case REF: {
      // The index is packed into the flags when it fits, and follows the flags when it does not.
      const packed = flags >> 8;
      return cursor.ref(packed === 0 ? cursor.uint32() : packed);
    }

    case SYM: {
      const name = readNode(cursor);
      cursor.addRef(name);
      return name;
    }

    case CHAR: {
      const length = cursor.int32();
      // -1 is NA_character_, which is not the empty string and must not become one.
      if (length === -1) return null;
      // Everything below decodes as UTF-8, which is right for UTF8, ASCII and a UTF-8 native
      // encoding — but wrong for latin1, where the high bytes are a different alphabet. A
      // latin1 "Kachhi (Bolan)" would decode to mojibake and match no roster name; worse, a
      // latin1 name that happens to be pure ASCII would pass while its neighbour did not.
      // District names are exactly where this bites, so refuse rather than guess.
      const levels = flags >> LEVELS_SHIFT;
      if ((levels & LATIN1_MASK) !== 0) {
        throw new Error(
          'RData string is latin1-encoded. This reader decodes UTF-8 only; decoding latin1 as ' +
            'UTF-8 corrupts exactly the district names the join matches on.',
        );
      }
      const text = cursor.text(length);
      if ((levels & ASCII_MASK) !== 0 && /[^\x00-\x7f]/.test(text)) {
        throw new Error('RData string is flagged ASCII but holds bytes above 0x7f');
      }
      // UTF8_MASK and a UTF-8 native encoding both decode the same way, so neither is checked.
      return text;
    }

    case LIST:
      return readPairlist(cursor, hasAttributes, hasTag);

    case EXTPTR: {
      // `data.table` carries a self-reference pointer, meaningless across a save/load boundary.
      // It is read only to keep the reference table and the byte stream aligned.
      cursor.addRef(null);
      readNode(cursor);
      readNode(cursor);
      if (hasAttributes) readNode(cursor);
      return null;
    }

    case LGL:
    case INT: {
      const length = cursor.int32();
      const values: Cell[] = [];
      for (let i = 0; i < length; i += 1) {
        const value = cursor.int32();
        values.push(value === NA_INTEGER ? null : value);
      }
      return { kind: 'atomic', values, attrs: readOptionalAttributes(cursor, hasAttributes) };
    }

    case REAL: {
      const length = cursor.int32();
      const values: Cell[] = [];
      for (let i = 0; i < length; i += 1) {
        const value = cursor.float64();
        // NA_real_ is a tagged NaN; anything NaN reaching here is missing data either way.
        values.push(Number.isNaN(value) ? null : value);
      }
      return { kind: 'atomic', values, attrs: readOptionalAttributes(cursor, hasAttributes) };
    }

    case STR: {
      const length = cursor.int32();
      const values: Cell[] = [];
      for (let i = 0; i < length; i += 1) {
        const value = readNode(cursor);
        if (value !== null && typeof value !== 'string') {
          throw new Error('RData character vector holds a non-string element');
        }
        values.push(value);
      }
      return { kind: 'atomic', values, attrs: readOptionalAttributes(cursor, hasAttributes) };
    }

    case VEC: {
      const length = cursor.int32();
      const elements: Node[] = [];
      for (let i = 0; i < length; i += 1) elements.push(readNode(cursor));
      return { kind: 'list', elements, attrs: readOptionalAttributes(cursor, hasAttributes) };
    }

    default:
      throw new Error(
        `RData node type ${type} is not supported. This reader covers exactly what the census ` +
          `tables use; extend it deliberately rather than letting it guess at the payload.`,
      );
  }
}

function readOptionalAttributes(cursor: Cursor, present: boolean): Attrs {
  if (!present) return new Map();
  const node = readNode(cursor);
  if (node === null) return new Map();
  if (typeof node === 'string' || node.kind !== 'pairlist') {
    throw new Error('RData attributes were not a pairlist');
  }
  return node.entries;
}

function readPairlist(cursor: Cursor, hasAttributes: boolean, hasTag: boolean): Node {
  const entries = new Map<string, Node>();
  let attributed = hasAttributes;
  let tagged = hasTag;

  for (;;) {
    if (attributed) readNode(cursor);
    const tag = tagged ? readNode(cursor) : null;
    entries.set(typeof tag === 'string' ? tag : '', readNode(cursor));

    const flags = cursor.uint32();
    const type = flags & 0xff;
    if (type === NIL) break;
    if (type !== LIST) throw new Error(`RData pairlist tail was type ${type}, expected a pairlist`);
    attributed = ((flags >> 9) & 1) === 1;
    tagged = ((flags >> 10) & 1) === 1;
  }
  return { kind: 'pairlist', entries };
}

/**
 * Read every `data.frame` in an `.RData` file, keyed by the name it was saved under.
 *
 * Accepts the file exactly as published — gzip-compressed, which is how `save()` writes it.
 */
export function readDataFrames(file: Uint8Array): Map<string, DataFrame> {
  if (wrappedIn(file, XZ_MAGIC)) {
    throw new Error(
      'this .RData is xz-compressed, which cannot be unwrapped synchronously. Await ' +
        '`decompressRData` first — reading the container as a serialization stream would fail ' +
        'somewhere less obvious than here.',
    );
  }
  const raw = wrappedIn(file, GZIP_MAGIC) ? new Uint8Array(gunzipSync(file)) : file;

  // "RDX2"/"RDX3" then "X\n", where X means XDR — big-endian binary. ASCII saves are not
  // supported; no published R package ships them.
  const body = DECODER.decode(raw.subarray(0, 4)).startsWith('RDX') ? raw.subarray(5) : raw;
  if (DECODER.decode(body.subarray(0, 2)) !== 'X\n') {
    throw new Error('not an XDR-serialized RData file');
  }

  const cursor = new Cursor(new DataView(body.buffer, body.byteOffset + 2, body.byteLength - 2));
  const version = cursor.uint32();
  cursor.uint32(); // writer R version
  cursor.uint32(); // minimum reader R version
  if (version >= 3) cursor.skip(cursor.int32()); // native encoding name

  const top = readNode(cursor);
  if (top === null || typeof top === 'string' || top.kind !== 'pairlist') {
    throw new Error('RData file did not hold a name -> object pairlist');
  }

  const frames = new Map<string, DataFrame>();
  for (const [name, node] of top.entries) {
    const frame = toDataFrame(node);
    if (frame !== null) frames.set(name, frame);
  }
  return frames;
}

function toDataFrame(node: Node): DataFrame | null {
  if (node === null || typeof node === 'string' || node.kind !== 'list') return null;

  const names = node.attrs.get('names');
  if (names === null || names === undefined || typeof names === 'string') return null;
  if (names.kind !== 'atomic') return null;
  const columns = names.values.map(String);

  // A `names` attribute shorter than the column list would leave real columns unnamed and
  // unreachable; longer would name columns that do not exist, and `?? null` below would fill
  // them with nulls that look exactly like published NAs. Neither is a table anyone should read.
  if (columns.length !== node.elements.length) {
    throw new Error(
      `data.frame has ${node.elements.length} column(s) but ${columns.length} name(s)`,
    );
  }

  const columnValues = node.elements.map((element, index) => {
    if (element === null || typeof element === 'string' || element.kind !== 'atomic') {
      throw new Error(`data.frame column ${columns[index]} was not an atomic vector`);
    }
    // A factor is an integer vector wearing a `levels` attribute: its values are 1-based codes
    // into that attribute, not data. Read as-is, a factor District column yields the numbers
    // 1..136 and a factor Pop2023 column yields ranks — both perfectly plausible integers.
    if (element.attrs.has('levels')) {
      throw new Error(
        `data.frame column ${columns[index]} is a factor. Its values are level codes, not the ` +
          `labels; this reader does not decode them, and reading the codes as data would put ` +
          `integers where names or populations belong.`,
      );
    }
    return element.values;
  });

  const height = columnValues[0]?.length ?? 0;
  for (const column of columnValues) {
    if (column.length !== height) throw new Error('data.frame columns have unequal length');
  }

  const rows: Record<string, Cell>[] = [];
  for (let i = 0; i < height; i += 1) {
    const row: Record<string, Cell> = {};
    columns.forEach((column, index) => {
      row[column] = columnValues[index]?.[i] ?? null;
    });
    rows.push(row);
  }
  return { columns, rows };
}
