import { NextResponse } from 'next/server';
import zlib from 'node:zlib';

/**
 * Dependency-free .xlsx → rows parser. An .xlsx is a ZIP of XML parts; we read
 * the ZIP central directory, inflate xl/sharedStrings.xml + each worksheet, and
 * return the densest sheet's cells as a string grid. No SheetJS dependency (keeps
 * install light on the iCloud-throttled FS). CSV is parsed client-side already.
 *
 * Not handled (fine for QuickBooks/Excel exports; user can edit in the grid):
 * date cells return their serial number; heavily-styled number formats aren't
 * re-formatted.
 */

export const runtime = 'nodejs';
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 20000;

function colIndex(ref: string): number | null {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return null;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

/** Read a ZIP buffer → map of filename → inflated content (utf8). */
function unzip(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  // Locate End Of Central Directory (scan back for signature 0x06054b50).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return out;
  const cdCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset
  for (let e = 0; e < cdCount; e++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    // Only the parts we care about.
    if (name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      // Local header: 30 bytes + name + extra, then data.
      const lnameLen = buf.readUInt16LE(localOff + 26);
      const lextraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lnameLen + lextraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      try {
        const content = method === 0 ? raw : zlib.inflateRawSync(raw);
        out.set(name, content.toString('utf8'));
      } catch {
        /* skip a part that won't inflate */
      }
    }
  }
  return out;
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = '';
    while ((t = tRe.exec(m[1]))) s += t[1];
    out.push(decodeEntities(s));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) && rows.length < MAX_ROWS) {
    const cells: Record<number, string> = {};
    let maxc = -1;
    let seq = 0;
    // Match both <c ...>...</c> and self-closing <c ... />.
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1];
      const inner = cm[2] ?? '';
      const refM = /r="([A-Z]+\d+)"/.exec(attrs);
      const ci = refM ? colIndex(refM[1]) : seq;
      if (ci == null) continue;
      seq = ci + 1;
      if (ci > maxc) maxc = ci;
      const typeM = /t="([^"]+)"/.exec(attrs);
      const type = typeM ? typeM[1] : '';
      let val = '';
      if (type === 's') {
        const vM = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        if (vM) val = shared[parseInt(vM[1], 10)] ?? '';
      } else if (type === 'inlineStr') {
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let t: RegExpExecArray | null;
        while ((t = tRe.exec(inner))) val += decodeEntities(t[1]);
      } else {
        const vM = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        if (vM) val = decodeEntities(vM[1]);
      }
      cells[ci] = val;
    }
    const arr: string[] = [];
    for (let i = 0; i <= maxc; i++) arr.push(cells[i] ?? '');
    rows.push(arr);
  }
  return rows;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 15 MB).' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const parts = unzip(buf);
    if (parts.size === 0) return NextResponse.json({ error: "Couldn't read that .xlsx — try saving it as CSV." }, { status: 400 });

    const shared = parseSharedStrings(parts.get('xl/sharedStrings.xml'));

    // Parse every worksheet; return the densest (most non-empty cells) — QuickBooks
    // exports put a cover page on sheet 1 and the data on sheet 2.
    let best: { rows: string[][]; score: number } | null = null;
    for (const [name, xml] of parts) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
      const rows = parseSheet(xml, shared);
      const score = rows.reduce((s, r) => s + r.filter((c) => c.trim() !== '').length, 0);
      if (!best || score > best.score) best = { rows, score };
    }
    const rows = best?.rows ?? [];
    if (rows.length === 0) return NextResponse.json({ error: 'That sheet looks empty.' }, { status: 400 });

    return NextResponse.json({ rows });
  } catch (err) {
    console.error('parse-xlsx error:', err);
    return NextResponse.json({ error: "Couldn't parse that file — try saving it as CSV." }, { status: 500 });
  }
}
