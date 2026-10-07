import { describe, expect, it } from "vitest";
import { detectFileType, listZipEntries, sanitiseZipPath, sha256Hex, deliveryKindFor } from "../../src/lib/file-inspect.js";
import { makeZip } from "../helpers/zip.js";

describe("detectFileType", () => {
  it("recognises allowed formats by magic bytes", () => {
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("png");
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectFileType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe("webp");
    expect(detectFileType(Buffer.from("%PDF-1.7\n"))).toBe("pdf");
    expect(detectFileType(makeZip({ "a.txt": "hi" }))).toBe("zip");
    expect(detectFileType(Buffer.from("plain text\nwith lines"))).toBe("text");
  });

  it("rejects binary that isn't an allowed type", () => {
    expect(detectFileType(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]))).toBeNull(); // Windows .exe
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe("listZipEntries", () => {
  it("reads the central directory without extracting", () => {
    const zip = makeZip({ "src/index.js": "x", "README.md": "y", "styles/": "", "styles/app.css": "z" });
    expect(listZipEntries(zip)).toEqual(["README.md", "src/index.js", "styles/app.css"]);
  });

  it("drops path traversal entries and returns null for non-zips", () => {
    expect(listZipEntries(makeZip({ "../evil.sh": "x", "ok.txt": "y" }))).toEqual(["ok.txt"]);
    expect(listZipEntries(Buffer.from("not a zip at all, definitely not"))).toBeNull();
  });
});

describe("sanitiseZipPath", () => {
  it("normalises separators and rejects traversal", () => {
    expect(sanitiseZipPath("a\\b\\c.txt")).toBe("a/b/c.txt");
    expect(sanitiseZipPath("/abs/path.txt")).toBe("abs/path.txt");
    expect(sanitiseZipPath("a/../../etc/passwd")).toBeNull();
    expect(sanitiseZipPath("./x/./y")).toBe("x/y");
  });
});

describe("helpers", () => {
  it("hashes and maps kinds", () => {
    expect(sha256Hex(Buffer.from(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(deliveryKindFor("image/png")).toBe("image");
    expect(deliveryKindFor("application/zip")).toBe("archive");
    expect(deliveryKindFor("application/pdf")).toBe("document");
  });
});
