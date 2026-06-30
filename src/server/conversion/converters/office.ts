import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { ConvertInput, ConvertResult, Converter, Format } from "../types.js";
import { ConversionError } from "../types.js";
import { config } from "../../config.js";
import { run } from "../../util/exec.js";
import { mimeFor } from "../../util/mime.js";

// Inputs LibreOffice can open, grouped so we can restrict sensible targets.
const DOC_IN = ["docx", "doc", "odt", "rtf", "txt", "html"] as const;
const SHEET_IN = ["xlsx", "xls", "ods", "csv"] as const;
const PRES_IN = ["pptx", "ppt", "odp"] as const;

const DOC_OUT = new Set<Format>(["pdf", "docx", "odt", "rtf", "txt", "html"]);
const SHEET_OUT = new Set<Format>(["pdf", "xlsx", "ods", "csv", "html"]);
const PRES_OUT = new Set<Format>(["pdf", "pptx", "odp"]);

function targetsFor(from: Format): Set<Format> | null {
  if ((DOC_IN as readonly string[]).includes(from)) return DOC_OUT;
  if ((SHEET_IN as readonly string[]).includes(from)) return SHEET_OUT;
  if ((PRES_IN as readonly string[]).includes(from)) return PRES_OUT;
  return null;
}

// Some targets need an explicit LibreOffice export filter to be unambiguous.
const FILTER: Partial<Record<Format, string>> = {
  csv: "csv:Text - txt - csv (StarCalc)",
  txt: "txt:Text (encoded):UTF8",
  html: "html",
};

/** Office document/spreadsheet/presentation conversion via LibreOffice. */
export const officeConverter: Converter = {
  name: "office",
  requiresTool: "soffice",

  supports(from: Format, to: Format): boolean {
    const targets = targetsFor(from);
    if (!targets) return false;
    if (from === to) return false;
    return targets.has(to);
  },

  async convert(input: ConvertInput): Promise<ConvertResult> {
    const { inputPath, to, outputDir, baseName } = input;

    // A private user-profile dir lets multiple soffice processes run at once.
    const profileDir = path.join(outputDir, ".lo-profile");
    await fs.mkdir(profileDir, { recursive: true });
    const profileUrl = pathToFileURL(profileDir).toString();

    const convertArg = FILTER[to] ?? to;
    const args = [
      "--headless",
      "--norestore",
      "--nolockcheck",
      `-env:UserInstallation=${profileUrl}`,
      "--convert-to",
      convertArg,
      "--outdir",
      outputDir,
      inputPath,
    ];

    const res = await run(config.tools.soffice, args, { timeoutMs: 300_000 });
    if (res.code !== 0) {
      throw new ConversionError(
        `soffice exited ${res.code}: ${res.stderr.slice(-400)}`,
        "The document could not be converted.",
      );
    }

    // LibreOffice names the output <inputBaseName>.<ext> in outdir.
    const producedBase = path.basename(inputPath, path.extname(inputPath));
    const producedPath = path.join(outputDir, `${producedBase}.${to}`);
    try {
      await fs.access(producedPath);
    } catch {
      throw new ConversionError(
        `soffice produced no output (stderr: ${res.stderr.slice(-200)})`,
        "The document could not be converted to the requested format.",
      );
    }

    const fileName = `${baseName}.${to}`;
    const outputPath = path.join(outputDir, fileName);
    if (producedPath !== outputPath) {
      await fs.rename(producedPath, outputPath);
    }

    // The per-conversion profile is only needed during the run; reclaim it now
    // rather than waiting for the job's TTL cleanup.
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {});

    return { outputPath, fileName, mimeType: mimeFor(to) };
  },
};
