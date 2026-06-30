import path from "node:path";
import type { ConvertInput, ConvertResult, Converter, Format } from "../types.js";
import { ConversionError } from "../types.js";
import { config } from "../../config.js";
import { run } from "../../util/exec.js";
import { mimeFor } from "../../util/mime.js";

// Pandoc reader names keyed by our format id.
const READER: Partial<Record<Format, string>> = {
  md: "markdown",
  html: "html",
  rst: "rst",
  tex: "latex",
  epub: "epub",
  docx: "docx",
  odt: "odt",
  txt: "markdown", // plain text is valid markdown input
};

// Pandoc writer names keyed by our format id.
const WRITER: Partial<Record<Format, string>> = {
  md: "markdown",
  html: "html",
  rst: "rst",
  tex: "latex",
  epub: "epub",
  docx: "docx",
  odt: "odt",
  rtf: "rtf",
  txt: "plain",
};

// Lightweight markup formats where pandoc is the right tool (LibreOffice
// either can't read/write them or does so poorly).
const MARKUP = new Set<Format>(["md", "html", "rst", "tex", "epub"]);

/** Markup/e-book conversion powered by pandoc. */
export const markupConverter: Converter = {
  name: "markup",
  requiresTool: "pandoc",

  supports(from: Format, to: Format): boolean {
    if (from === to) return false;
    if (!READER[from] || !WRITER[to]) return false;
    // Only claim pairs that involve a lightweight markup format.
    return MARKUP.has(from) || MARKUP.has(to);
  },

  async convert(input: ConvertInput): Promise<ConvertResult> {
    const { inputPath, from, to, outputDir, baseName } = input;
    const fileName = `${baseName}.${to}`;
    const outputPath = path.join(outputDir, fileName);

    const reader = READER[from]!;
    const writer = WRITER[to]!;
    const args = ["-f", reader, "-t", writer, "-o", outputPath];
    if (to === "html" || to === "tex") args.push("-s"); // standalone document
    if (to === "html") args.push("--embed-resources");
    args.push(inputPath);

    const res = await run(config.tools.pandoc, args, { timeoutMs: 120_000 });
    if (res.code !== 0) {
      throw new ConversionError(
        `pandoc exited ${res.code}: ${res.stderr.slice(-300)}`,
        "The document could not be converted.",
      );
    }

    return { outputPath, fileName, mimeType: mimeFor(to) };
  },
};
