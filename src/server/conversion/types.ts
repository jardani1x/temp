/** A normalised file-format key, always lower-case and without a leading dot. */
export type Format = string;

export type Category =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "pdf"
  | "data"
  | "archive";

export interface FormatInfo {
  /** Canonical format key, e.g. "jpg". */
  id: Format;
  /** Human friendly label, e.g. "JPEG image". */
  label: string;
  category: Category;
  /** Alternative extensions that map to this format, e.g. "jpeg" -> "jpg". */
  aliases?: string[];
}

export interface ConvertInput {
  /** Absolute path to the source file on disk. */
  inputPath: string;
  /** Source format key. */
  from: Format;
  /** Target format key. */
  to: Format;
  /** Directory the converter may write its output into. */
  outputDir: string;
  /** Suggested output base filename (without extension). */
  baseName: string;
}

export interface ConvertResult {
  /** Absolute path to the produced file. */
  outputPath: string;
  /** MIME type of the produced file. */
  mimeType: string;
  /** Final filename presented to the user. */
  fileName: string;
}

export interface Converter {
  /** Stable identifier, e.g. "image", used in logs and diagnostics. */
  name: string;
  /** External binary this converter relies on, if any (for availability checks). */
  requiresTool?: "ffmpeg" | "soffice" | "gs" | "pandoc";
  /** Returns true if this converter can handle the given (from -> to) pair. */
  supports(from: Format, to: Format): boolean;
  /** Perform the conversion. Should throw on failure. */
  convert(input: ConvertInput): Promise<ConvertResult>;
}

export class ConversionError extends Error {
  constructor(message: string, readonly userMessage = message) {
    super(message);
    this.name = "ConversionError";
  }
}
