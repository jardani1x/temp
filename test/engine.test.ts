import { describe, it, expect, beforeAll } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { initRegistry, toolStatusSnapshot } from "../src/server/conversion/registry.js";
import { runConversion } from "../src/server/conversion/index.js";

// Probe tools at module load so `skipIf` (evaluated during collection) is accurate.
await initRegistry();
const tools = toolStatusSnapshot();

let work: string;

async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "anyconv-test-"));
}

async function magic(file: string, bytes: number): Promise<Buffer> {
  const fh = await fs.open(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    await fh.read(buf, 0, bytes, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

async function size(file: string): Promise<number> {
  return (await fs.stat(file)).size;
}

beforeAll(async () => {
  work = await tmpDir();
});

describe("image converter (sharp)", () => {
  it("converts PNG -> JPEG", async () => {
    const src = path.join(work, "src.png");
    await sharp({ create: { width: 32, height: 32, channels: 3, background: "#3366cc" } })
      .png()
      .toFile(src);
    const out = await runConversion({ inputPath: src, originalName: "src.png", to: "jpg", outputDir: work });
    const head = await magic(out.outputPath, 2);
    expect(head[0]).toBe(0xff); // JPEG SOI
    expect(head[1]).toBe(0xd8);
    expect(out.mimeType).toBe("image/jpeg");
  });

  it("converts PNG -> WebP", async () => {
    const src = path.join(work, "src2.png");
    await sharp({ create: { width: 16, height: 16, channels: 4, background: "#ff0000" } })
      .png()
      .toFile(src);
    const out = await runConversion({ inputPath: src, originalName: "src2.png", to: "webp", outputDir: work });
    expect(await size(out.outputPath)).toBeGreaterThan(0);
    expect((await magic(out.outputPath, 12)).toString("latin1")).toContain("WEBP");
  });
});

describe("audio/video converter (ffmpeg)", () => {
  it.skipIf(!tools.ffmpeg)("converts WAV -> MP3", async () => {
    const { run } = await import("../src/server/util/exec.js");
    const src = path.join(work, "tone.wav");
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", src]);
    const out = await runConversion({ inputPath: src, originalName: "tone.wav", to: "mp3", outputDir: work });
    expect(await size(out.outputPath)).toBeGreaterThan(200);
    expect(out.mimeType).toBe("audio/mpeg");
  });
});

describe("markup converter (pandoc)", () => {
  it.skipIf(!tools.pandoc)("converts Markdown -> HTML", async () => {
    const src = path.join(work, "doc.md");
    await fs.writeFile(src, "# Title\n\nHello **world** with a [link](https://example.com).\n");
    const out = await runConversion({ inputPath: src, originalName: "doc.md", to: "html", outputDir: work });
    const html = await fs.readFile(out.outputPath, "utf8");
    expect(html).toContain("<h1");
    expect(html.toLowerCase()).toContain("world");
  });
});

describe("office converter (libreoffice)", () => {
  it.skipIf(!tools.soffice)("converts TXT -> PDF", async () => {
    const src = path.join(work, "note.txt");
    await fs.writeFile(src, "Hello from AnyConv.\nThis becomes a PDF.\n");
    const out = await runConversion({ inputPath: src, originalName: "note.txt", to: "pdf", outputDir: work });
    expect((await magic(out.outputPath, 5)).toString("latin1")).toBe("%PDF-");
  }, 120_000);

  it.skipIf(!tools.soffice)("converts CSV -> XLSX", async () => {
    const src = path.join(work, "table.csv");
    await fs.writeFile(src, "name,score\nAda,99\nLinus,88\n");
    const out = await runConversion({ inputPath: src, originalName: "table.csv", to: "xlsx", outputDir: work });
    // XLSX is a ZIP container -> starts with "PK".
    expect((await magic(out.outputPath, 2)).toString("latin1")).toBe("PK");
  }, 120_000);
});

describe("pdf converter (ghostscript + image->pdf)", () => {
  it("converts an image -> PDF", async () => {
    const src = path.join(work, "pic.png");
    await sharp({ create: { width: 64, height: 48, channels: 3, background: "#11aa55" } })
      .png()
      .toFile(src);
    const out = await runConversion({ inputPath: src, originalName: "pic.png", to: "pdf", outputDir: work });
    expect((await magic(out.outputPath, 5)).toString("latin1")).toBe("%PDF-");
  });

  it.skipIf(!tools.gs)("rasterises a PDF -> PNG", async () => {
    // First make a one-page PDF from an image, then rasterise it back.
    const img = path.join(work, "page.png");
    await sharp({ create: { width: 80, height: 100, channels: 3, background: "#cccccc" } })
      .png()
      .toFile(img);
    const pdf = await runConversion({ inputPath: img, originalName: "page.png", to: "pdf", outputDir: work });
    const out = await runConversion({
      inputPath: pdf.outputPath,
      originalName: "page.pdf",
      to: "png",
      outputDir: work,
    });
    const head = await magic(out.outputPath, 8);
    // PNG signature
    expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }, 60_000);
});

it("exposes a broad conversion matrix", async () => {
  const { conversionMatrix } = await import("../src/server/conversion/registry.js");
  const matrix = conversionMatrix();
  expect(Object.keys(matrix).length).toBeGreaterThan(20);
  expect(matrix.png).toContain("jpg");
});
