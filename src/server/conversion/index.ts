import path from "node:path";
import { ConversionError } from "./types.js";
import type { ConvertResult, Format } from "./types.js";
import { findConverter } from "./registry.js";
import { formatFromFilename, normalizeFormat, formatLabel } from "./formats.js";

export interface RunConversionArgs {
  inputPath: string;
  originalName: string;
  /** Explicit source format; falls back to the file extension. */
  from?: string;
  to: string;
  outputDir: string;
}

/** Resolve formats, pick a converter and run it. */
export async function runConversion(args: RunConversionArgs): Promise<ConvertResult> {
  const from: Format | null = args.from
    ? normalizeFormat(args.from)
    : formatFromFilename(args.originalName);
  const to: Format | null = normalizeFormat(args.to);

  if (!from) {
    throw new ConversionError(
      "unknown source format",
      "We couldn't recognise the source file type. Please use a supported file.",
    );
  }
  if (!to) {
    throw new ConversionError("unknown target format", "The requested output format is not supported.");
  }
  if (from === to) {
    throw new ConversionError(
      "source and target are identical",
      "The source and target formats are the same.",
    );
  }

  const converter = findConverter(from, to);
  if (!converter) {
    throw new ConversionError(
      `no converter for ${from} -> ${to}`,
      `Converting ${formatLabel(from)} to ${formatLabel(to)} isn't supported.`,
    );
  }

  const baseName = sanitizeBaseName(args.originalName);
  return converter.convert({
    inputPath: args.inputPath,
    from,
    to,
    outputDir: args.outputDir,
    baseName,
  });
}

/** Strip path/extension and unsafe characters from the user filename. */
function sanitizeBaseName(originalName: string): string {
  const base = path.basename(originalName, path.extname(originalName));
  const cleaned = base.replace(/[^\w.\- ]+/g, "_").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "converted";
}

export { ConversionError };
