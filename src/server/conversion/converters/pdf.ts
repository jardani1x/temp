import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import type { ConvertInput, ConvertResult, Converter, Format } from "../types.js";
import { ConversionError } from "../types.js";
import { config } from "../../config.js";
import { run } from "../../util/exec.js";
import { mimeFor } from "../../util/mime.js";
import { createZip } from "../../util/zip.js";
import { imagesToPdf } from "../../util/pdf.js";

const IMAGE_IN = new Set<Format>(["jpg", "png", "webp", "avif", "gif", "tiff", "svg", "heic"]);
const RASTER_OUT = new Set<Format>(["png", "jpg"]);

/**
 * PDF rasterisation (PDF -> images, via Ghostscript) and image collation
 * (images -> PDF, dependency-free). Multi-page PDFs export to a ZIP of images.
 */
export const pdfConverter: Converter = {
  name: "pdf",
  requiresTool: "gs",

  supports(from: Format, to: Format): boolean {
    if (from === "pdf" && RASTER_OUT.has(to)) return true;
    if (IMAGE_IN.has(from) && to === "pdf") return true;
    return false;
  },

  async convert(input: ConvertInput): Promise<ConvertResult> {
    if (input.from === "pdf") return pdfToImages(input);
    return imageToPdf(input);
  },
};

async function pdfToImages(input: ConvertInput): Promise<ConvertResult> {
  const { inputPath, to, outputDir, baseName } = input;
  const device = to === "png" ? "png16m" : "jpeg";
  const pattern = path.join(outputDir, `${baseName}-%03d.${to}`);

  const args = [
    "-q",
    "-dNOPAUSE",
    "-dBATCH",
    "-dSAFER",
    `-sDEVICE=${device}`,
    "-r150",
    `-sOutputFile=${pattern}`,
    inputPath,
  ];
  const res = await run(config.tools.gs, args, { timeoutMs: 300_000 });
  if (res.code !== 0) {
    throw new ConversionError(
      `ghostscript exited ${res.code}: ${res.stderr.slice(-300)}`,
      "The PDF could not be rasterised.",
    );
  }

  const produced = (await fs.readdir(outputDir))
    .filter((f) => f.startsWith(`${baseName}-`) && f.endsWith(`.${to}`))
    .sort();
  if (produced.length === 0) {
    throw new ConversionError("ghostscript produced no images", "The PDF could not be converted.");
  }

  // Single page -> a single image; multiple pages -> a ZIP archive.
  if (produced.length === 1) {
    const only = produced[0];
    const fileName = `${baseName}.${to}`;
    const outputPath = path.join(outputDir, fileName);
    await fs.rename(path.join(outputDir, only), outputPath);
    return { outputPath, fileName, mimeType: mimeFor(to) };
  }

  const entries = await Promise.all(
    produced.map(async (name, i) => ({
      name: `${baseName}-page-${String(i + 1).padStart(3, "0")}.${to}`,
      data: await fs.readFile(path.join(outputDir, name)),
    })),
  );
  const zip = createZip(entries);
  const fileName = `${baseName}.zip`;
  const outputPath = path.join(outputDir, fileName);
  await fs.writeFile(outputPath, zip);
  return { outputPath, fileName, mimeType: mimeFor("zip") };
}

async function imageToPdf(input: ConvertInput): Promise<ConvertResult> {
  const { inputPath, outputDir, baseName } = input;
  try {
    const image = sharp(inputPath, { failOn: "none" });
    const meta = await image.metadata();
    const jpeg = await image.flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    const pdf = imagesToPdf([
      { jpeg, width: meta.width ?? 800, height: meta.height ?? 1000 },
    ]);
    const fileName = `${baseName}.pdf`;
    const outputPath = path.join(outputDir, fileName);
    await fs.writeFile(outputPath, pdf);
    return { outputPath, fileName, mimeType: mimeFor("pdf") };
  } catch (err) {
    throw new ConversionError(
      `image->pdf failed: ${(err as Error).message}`,
      "The image could not be converted to PDF.",
    );
  }
}
