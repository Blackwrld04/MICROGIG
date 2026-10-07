import { createHash } from "node:crypto";

export type DetectedType = "zip" | "png" | "jpeg" | "webp" | "pdf" | "text";

/** What the bytes actually are, from their magic numbers; null if not an allowed type. */
export function detectFileType(buf: Buffer): DetectedType | null {
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && (buf[3] === 0x04 || buf[3] === 0x06)) return "zip";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 5 && buf.toString("latin1", 0, 5) === "%PDF-") return "pdf";
  if (looksLikeText(buf)) return "text";
  return null;
}

function looksLikeText(buf: Buffer) {
  if (buf.length === 0) return false;
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return false;
  // Valid UTF-8 decodes without replacement characters (the sample may cut the last character).
  const text = sample.toString("utf8");
  const bad = text.indexOf("�");
  return bad === -1 || (sample.length < buf.length && bad >= text.length - 1);
}

/** Declared upload MIME type → the content its bytes must have. */
export const EXPECTED_TYPE: Record<string, DetectedType> = {
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "zip", // DOCX is a ZIP
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "text",
};

export function deliveryKindFor(contentType: string): "image" | "archive" | "document" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/zip" || contentType === "application/x-zip-compressed") return "archive";
  return "document";
}

export function sha256Hex(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

const MAX_TREE_ENTRIES = 500;

/**
 * Lists the file paths inside a ZIP by reading its central directory (DEL-07), without
 * extracting anything. Paths are sanitised: no absolute paths, no "..", no control characters.
 * Returns null if the archive's directory can't be read.
 */
export function listZipEntries(buf: Buffer): string[] | null {
  // End of central directory record: signature 0x06054b50, within the last 64 KB + 22 bytes.
  const minEocd = Math.max(0, buf.length - 0xffff - 22);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minEocd; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const total = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff || offset >= buf.length) return null; // ZIP64 or corrupt

  const paths: string[] = [];
  for (let n = 0; n < total && paths.length < MAX_TREE_ENTRIES; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) return null;
    const flags = buf.readUInt16LE(offset + 8);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const raw = buf.subarray(offset + 46, offset + 46 + nameLen);
    const name = raw.toString(flags & 0x800 ? "utf8" : "latin1");
    const clean = sanitiseZipPath(name);
    if (clean && !clean.endsWith("/")) paths.push(clean);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return paths.sort();
}

export function sanitiseZipPath(name: string): string | null {
  // eslint-disable-next-line no-control-regex
  const stripped = name.replace(/\\/g, "/").replace(/[\u0000-\u001f\u007f]/g, "");
  const parts = stripped.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.length === 0 || parts.includes("..")) return null;
  return parts.join("/") + (stripped.endsWith("/") ? "/" : "");
}
