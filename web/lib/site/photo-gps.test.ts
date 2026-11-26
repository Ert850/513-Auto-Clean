/**
 * No photo in the repo carries GPS coordinates (November 26). The repo is
 * public, and a phone photo of a job holds the customer's driveway: seven
 * source photos had them on main from June until the SEO pass found them. The
 * site's own images were clean (the build re-encodes them); the sources were
 * not. A new photo is stripped before it's committed (CLAUDE.md, "Pages").
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
const GPS_IFD = 0x8825;

/** True when a TIFF (EXIF) block's first directory points to GPS data. */
function tiffHasGps(t: Buffer): boolean {
  if (t.length < 8) return false;
  const le = t.toString("latin1", 0, 2) === "II";
  const u16 = (o: number) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o: number) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  const ifd = u32(4);
  if (ifd + 2 > t.length) return false;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 2 > t.length) break;
    if (u16(e) === GPS_IFD) return true;
  }
  return false;
}

const exifBody = (b: Buffer) => (b.toString("latin1", 0, 6) === "Exif\0\0" ? b.subarray(6) : b);

/** The EXIF blocks in a JPEG, PNG or WebP file. */
function exifBlocks(b: Buffer): Buffer[] {
  const out: Buffer[] = [];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= b.length && b[i] === 0xff) {
      const m = b[i + 1]!;
      if (m === 0xda) break;
      const len = b.readUInt16BE(i + 2);
      if (m === 0xe1 && b.toString("latin1", i + 4, i + 10) === "Exif\0\0") out.push(b.subarray(i + 10, i + 2 + len));
      i += 2 + len;
    }
  } else if (b.toString("latin1", 1, 4) === "PNG") {
    let i = 8;
    while (i + 8 <= b.length) {
      const len = b.readUInt32BE(i);
      if (b.toString("latin1", i + 4, i + 8) === "eXIf") out.push(b.subarray(i + 8, i + 8 + len));
      i += 12 + len;
    }
  } else if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
    let i = 12;
    while (i + 8 <= b.length) {
      const len = b.readUInt32LE(i + 4);
      if (b.toString("latin1", i, i + 4) === "EXIF") out.push(exifBody(b.subarray(i + 8, i + 8 + len)));
      i += 8 + len + (len % 2);
    }
  }
  return out;
}

const hasGps = (b: Buffer) => exifBlocks(b).some(tiffHasGps) || /exif:GPSL(?:atitude|ongitude)/.test(b.toString("latin1"));

describe("photos carry no GPS location", () => {
  const images = execSync("git ls-files -z", { cwd: root })
    .toString()
    .split("\0")
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  it("finds the photos it checks", () => {
    expect(images.length).toBeGreaterThan(50);
  });

  it("no tracked photo has GPS coordinates", () => {
    const found = images.filter((f) => fs.existsSync(path.join(root, f)) && hasGps(fs.readFileSync(path.join(root, f))));
    expect(found, "strip GPS before committing a photo").toEqual([]);
  });

  it("the check itself sees GPS in a photo that has it", () => {
    // A minimal big-endian EXIF block whose first directory holds one entry: the GPS pointer.
    const tiff = Buffer.from([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0]);
    const app1 = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), Buffer.from([0, app1.length + 2]), app1, Buffer.from([0xff, 0xda])]);
    expect(hasGps(jpeg)).toBe(true);
    expect(hasGps(Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xda])]))).toBe(false);
  });
});
