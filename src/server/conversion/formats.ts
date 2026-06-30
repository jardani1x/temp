import path from "node:path";
import type { Format, FormatInfo } from "./types.js";

/**
 * Master catalogue of formats AnyConv knows about. The conversion registry
 * decides which pairs are actually convertible; this table only provides
 * metadata (labels, categories, extension aliases).
 */
export const FORMATS: FormatInfo[] = [
  // ---- Images ----
  { id: "jpg", label: "JPEG image", category: "image", aliases: ["jpeg", "jpe"] },
  { id: "png", label: "PNG image", category: "image" },
  { id: "webp", label: "WebP image", category: "image" },
  { id: "avif", label: "AVIF image", category: "image" },
  { id: "gif", label: "GIF image", category: "image" },
  { id: "tiff", label: "TIFF image", category: "image", aliases: ["tif"] },
  { id: "bmp", label: "Bitmap image", category: "image" },
  { id: "heic", label: "HEIC image", category: "image", aliases: ["heif"] },
  { id: "svg", label: "SVG vector image", category: "image" },

  // ---- Audio ----
  { id: "mp3", label: "MP3 audio", category: "audio" },
  { id: "wav", label: "WAV audio", category: "audio" },
  { id: "ogg", label: "OGG Vorbis audio", category: "audio" },
  { id: "opus", label: "Opus audio", category: "audio" },
  { id: "flac", label: "FLAC audio", category: "audio" },
  { id: "aac", label: "AAC audio", category: "audio" },
  { id: "m4a", label: "M4A audio", category: "audio" },
  { id: "wma", label: "WMA audio", category: "audio" },

  // ---- Video ----
  { id: "mp4", label: "MP4 video", category: "video" },
  { id: "webm", label: "WebM video", category: "video" },
  { id: "mkv", label: "Matroska video", category: "video" },
  { id: "mov", label: "QuickTime video", category: "video" },
  { id: "avi", label: "AVI video", category: "video" },
  { id: "flv", label: "Flash video", category: "video" },
  { id: "wmv", label: "Windows Media video", category: "video" },

  // ---- Documents ----
  { id: "pdf", label: "PDF document", category: "pdf" },
  { id: "docx", label: "Word document", category: "document" },
  { id: "doc", label: "Word 97-2003 document", category: "document" },
  { id: "odt", label: "OpenDocument text", category: "document" },
  { id: "rtf", label: "Rich Text Format", category: "document" },
  { id: "txt", label: "Plain text", category: "document", aliases: ["text"] },
  { id: "md", label: "Markdown", category: "document", aliases: ["markdown"] },
  { id: "html", label: "HTML document", category: "document", aliases: ["htm"] },
  { id: "epub", label: "EPUB e-book", category: "document" },
  { id: "rst", label: "reStructuredText", category: "document" },
  { id: "tex", label: "LaTeX document", category: "document", aliases: ["latex"] },

  // ---- Spreadsheets ----
  { id: "xlsx", label: "Excel workbook", category: "spreadsheet" },
  { id: "xls", label: "Excel 97-2003 workbook", category: "spreadsheet" },
  { id: "ods", label: "OpenDocument spreadsheet", category: "spreadsheet" },

  // ---- Presentations ----
  { id: "pptx", label: "PowerPoint presentation", category: "presentation" },
  { id: "ppt", label: "PowerPoint 97-2003 presentation", category: "presentation" },
  { id: "odp", label: "OpenDocument presentation", category: "presentation" },

  // ---- Data ----
  { id: "json", label: "JSON data", category: "data" },
  { id: "yaml", label: "YAML data", category: "data", aliases: ["yml"] },
  { id: "csv", label: "CSV data", category: "data" },
  { id: "tsv", label: "TSV data", category: "data" },
  { id: "xml", label: "XML data", category: "data" },
];

const byId = new Map<Format, FormatInfo>();
const aliasToId = new Map<string, Format>();
for (const f of FORMATS) {
  byId.set(f.id, f);
  aliasToId.set(f.id, f.id);
  for (const a of f.aliases ?? []) aliasToId.set(a, f.id);
}

/** Normalise an arbitrary extension/format string to a canonical format id. */
export function normalizeFormat(input: string): Format | null {
  const cleaned = input.trim().toLowerCase().replace(/^\./, "");
  return aliasToId.get(cleaned) ?? null;
}

/** Detect the canonical format from a filename, or null if unknown. */
export function formatFromFilename(filename: string): Format | null {
  const ext = path.extname(filename);
  if (!ext) return null;
  return normalizeFormat(ext);
}

export function getFormatInfo(id: Format): FormatInfo | undefined {
  return byId.get(id);
}

export function formatLabel(id: Format): string {
  return byId.get(id)?.label ?? id.toUpperCase();
}
