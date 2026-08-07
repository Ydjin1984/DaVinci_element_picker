import * as zlib from "zlib";

export interface ZipEntry {
  /** Path inside the archive, using forward slashes. */
  name: string;
  data: Uint8Array;
}

// Precomputed once per module — bitwise CRC is too slow on megabyte packs
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n >>> 0, 0);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * Minimal ZIP (DEFLATE) writer — no external deps.
 * Suitable for clone packs (images + text).
 */
export function createZipBuffer(entries: ZipEntry[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  const now = new Date();
  // DOS time/date
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((Math.floor(now.getSeconds() / 2) || 0) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0xf) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name || name.endsWith("/")) continue;
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(
      entry.data.buffer,
      entry.data.byteOffset,
      entry.data.byteLength
    );
    const crc = crc32(entry.data);
    let compressed: Buffer;
    let method = 8; // deflate
    try {
      compressed = zlib.deflateRawSync(raw, { level: 6 });
      // If deflate is larger, store raw
      if (compressed.length >= raw.length) {
        compressed = raw;
        method = 0;
      }
    } catch {
      compressed = raw;
      method = 0;
    }

    const localHeader = Buffer.concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0), // general purpose
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBuf.length),
      u16(0), // extra length
      nameBuf,
      compressed,
    ]);

    const central = Buffer.concat([
      u32(0x02014b50), // central directory
      u16(20), // version made by
      u16(20), // version needed
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBuf.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk start
      u16(0), // int attrs
      u32(0), // ext attrs
      u32(offset),
      nameBuf,
    ]);

    locals.push(localHeader);
    centrals.push(central);
    offset += localHeader.length;
  }

  const centralDir = Buffer.concat(centrals);
  const localBlob = Buffer.concat(locals);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0), // disk
    u16(0), // central disk
    u16(centrals.length),
    u16(centrals.length),
    u32(centralDir.length),
    u32(localBlob.length),
    u16(0), // comment
  ]);

  return new Uint8Array(Buffer.concat([localBlob, centralDir, end]));
}
