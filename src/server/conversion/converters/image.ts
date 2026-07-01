import path from "node:path";
import sharp from "sharp";
import type { ConvertInput, ConvertResult, Converter, Format } from "../types.js";
import { ConversionError } from "../types.js";
import { mimeFor } from "../../util/mime.js";

// Formats sharp can decode in the prebuilt libvips bundle.
const INPUTS = new Set<Format>(["jpg", "png", "webp", "avif", "gif", "tiff", "svg", "heic"]);
// Formats sharp can encode.
const OUTPUTS = new Set<Format>(["jpg", "png", "webp", "avif", "gif", "tiff"]);

/** Raster/vector image conversion powered by sharp (libvips). */
export const imageConverter: Converter = {
  name: "image",

  supports(from: Format, to: Format): boolean {
    return INPUTS.has(from) && OUTPUTS.has(to);
  },

  async convert(input: ConvertInput): Promise<ConvertResult> {
    const { inputPath, to, outputDir, baseName } = input;
    const fileName = `${baseName}.${to}`;
    const outputPath = path.join(outputDir, fileName);

    // `animated: true` preserves multi-frame GIF/WebP where supported.
    let pipeline = sharp(inputPath, { animated: true, failOn: "none" });

    switch (to) {
      case "jpg":
        pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true });
        break;
      case "png":
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
      case "webp":
        pipeline = pipeline.webp({ quality: 90 });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality: 60 });
        break;
      case "tiff":
        pipeline = pipeline.tiff({ compression: "lzw" });
        break;
      case "gif":
        pipeline = pipeline.gif();
        break;
      default:
        throw new ConversionError(`Unsupported image target: ${to}`);
    }

    try {
      await pipeline.toFile(outputPath);
    } catch (err) {
      throw new ConversionError(
        `sharp failed: ${(err as Error).message}`,
        "The image could not be converted. It may be corrupt or use an unsupported feature.",
      );
    }

    return { outputPath, fileName, mimeType: mimeFor(to) };
  },
};
