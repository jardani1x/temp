import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import type { ConvertInput, ConvertResult, Converter, Format } from "../types.js";
import { ConversionError } from "../types.js";
import { mimeFor } from "../../util/mime.js";

const FORMATS = new Set<Format>(["json", "yaml", "csv", "tsv", "xml"]);

/** Structured-data conversion (JSON / YAML / CSV / TSV / XML), pure JS. */
export const dataConverter: Converter = {
  name: "data",

  supports(from: Format, to: Format): boolean {
    return from !== to && FORMATS.has(from) && FORMATS.has(to);
  },

  async convert(input: ConvertInput): Promise<ConvertResult> {
    const { inputPath, from, to, outputDir, baseName } = input;
    const text = await fs.readFile(inputPath, "utf8");

    let value: unknown;
    try {
      value = parseData(from, text);
    } catch (err) {
      throw new ConversionError(
        `parse ${from} failed: ${(err as Error).message}`,
        `The ${from.toUpperCase()} file could not be parsed.`,
      );
    }

    let out: string;
    try {
      out = serializeData(to, value);
    } catch (err) {
      throw new ConversionError(
        `serialize ${to} failed: ${(err as Error).message}`,
        (err as ConversionError).userMessage ??
          `The data could not be written as ${to.toUpperCase()}.`,
      );
    }

    const fileName = `${baseName}.${to}`;
    const outputPath = path.join(outputDir, fileName);
    await fs.writeFile(outputPath, out, "utf8");
    return { outputPath, fileName, mimeType: mimeFor(to) };
  },
};

// ---------------------------------------------------------------------------
// Parsing / serialisation (exported for unit tests)
// ---------------------------------------------------------------------------

export function parseData(format: Format, text: string): unknown {
  switch (format) {
    case "json":
      return JSON.parse(text);
    case "yaml":
      return YAML.parse(text);
    case "csv":
      return parseDelimited(text, ",");
    case "tsv":
      return parseDelimited(text, "\t");
    case "xml":
      return parseXml(text);
    default:
      throw new Error(`Unsupported data format: ${format}`);
  }
}

export function serializeData(format: Format, value: unknown): string {
  switch (format) {
    case "json":
      return JSON.stringify(value, null, 2) + "\n";
    case "yaml":
      return YAML.stringify(value);
    case "csv":
      return serializeDelimited(value, ",");
    case "tsv":
      return serializeDelimited(value, "\t");
    case "xml":
      return serializeXml(value);
    default:
      throw new Error(`Unsupported data format: ${format}`);
  }
}

// ---- CSV / TSV ----

function parseDelimited(text: string, delim: string): Record<string, string>[] {
  const rows = parseDelimitedRows(text, delim);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = row[i] ?? "";
    });
    return obj;
  });
}

/** RFC 4180-style parser supporting quoted fields, embedded delimiters/newlines. */
function parseDelimitedRows(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === delim) {
      pushField();
      i++;
    } else if (ch === "\r") {
      i++; // handled by following \n
    } else if (ch === "\n") {
      pushRow();
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  // Flush trailing field/row unless the input ended on a clean newline.
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

function serializeDelimited(value: unknown, delim: string): string {
  if (!Array.isArray(value)) {
    throw new ConversionError(
      "CSV/TSV output requires an array of rows",
      "This data can only be exported to CSV/TSV if it is a list (array) of records.",
    );
  }
  const arr = value as unknown[];
  if (arr.length === 0) return "";

  const allObjects = arr.every((r) => r !== null && typeof r === "object" && !Array.isArray(r));
  const quote = (s: string) =>
    /[\n\r"]/.test(s) || s.includes(delim) ? `"${s.replace(/"/g, '""')}"` : s;
  const cell = (v: unknown) =>
    v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);

  if (allObjects) {
    const headerSet = new Set<string>();
    for (const r of arr) for (const k of Object.keys(r as object)) headerSet.add(k);
    const headers = [...headerSet];
    const lines = [headers.map(quote).join(delim)];
    for (const r of arr as Record<string, unknown>[]) {
      lines.push(headers.map((h) => quote(cell(r[h]))).join(delim));
    }
    return lines.join("\n") + "\n";
  }

  // Array of primitives/arrays.
  const lines = arr.map((r) =>
    Array.isArray(r) ? r.map((v) => quote(cell(v))).join(delim) : quote(cell(r)),
  );
  return lines.join("\n") + "\n";
}

// ---- XML (lightweight, convention-based) ----

const XML_TEXT = "#text";

function parseXml(text: string): unknown {
  let i = 0;
  const len = text.length;

  const skipDecl = () => {
    // Skip prolog/declarations/comments.
    while (i < len) {
      if (text.startsWith("<?", i)) i = text.indexOf("?>", i) + 2;
      else if (text.startsWith("<!--", i)) i = text.indexOf("-->", i) + 3;
      else if (text.startsWith("<!", i)) i = text.indexOf(">", i) + 1;
      else if (/\s/.test(text[i])) i++;
      else break;
    }
  };

  const parseNode = (): { name: string; value: unknown } => {
    if (text[i] !== "<") throw new Error("expected '<'");
    i++; // consume '<'
    let name = "";
    while (i < len && !/[\s/>]/.test(text[i])) name += text[i++];

    const node: Record<string, unknown> = {};
    // Attributes
    while (i < len && text[i] !== ">" && text[i] !== "/") {
      while (/\s/.test(text[i])) i++;
      if (text[i] === ">" || text[i] === "/") break;
      let attr = "";
      while (i < len && !/[\s=]/.test(text[i]) && text[i] !== ">") attr += text[i++];
      while (/\s/.test(text[i])) i++;
      if (text[i] === "=") {
        i++;
        while (/\s/.test(text[i])) i++;
        const q = text[i++];
        let val = "";
        while (i < len && text[i] !== q) val += text[i++];
        i++; // closing quote
        node[`@${attr}`] = decodeEntities(val);
      }
    }

    if (text[i] === "/") {
      i += 2; // '/>'
      return { name, value: Object.keys(node).length ? node : "" };
    }
    i++; // consume '>'

    const children: { name: string; value: unknown }[] = [];
    let textContent = "";
    while (i < len) {
      if (text.startsWith("</", i)) {
        i = text.indexOf(">", i) + 1;
        break;
      }
      if (text.startsWith("<!--", i)) {
        i = text.indexOf("-->", i) + 3;
        continue;
      }
      if (text[i] === "<") {
        children.push(parseNode());
      } else {
        let chunk = "";
        while (i < len && text[i] !== "<") chunk += text[i++];
        textContent += chunk;
      }
    }

    const trimmed = decodeEntities(textContent).trim();
    if (children.length === 0) {
      if (Object.keys(node).length === 0) return { name, value: trimmed };
      if (trimmed) node[XML_TEXT] = trimmed;
      return { name, value: node };
    }
    for (const child of children) {
      if (child.name in node) {
        const existing = node[child.name];
        if (Array.isArray(existing)) existing.push(child.value);
        else node[child.name] = [existing, child.value];
      } else {
        node[child.name] = child.value;
      }
    }
    if (trimmed) node[XML_TEXT] = trimmed;
    return { name, value: node };
  };

  skipDecl();
  if (i >= len) return {};
  const root = parseNode();
  return { [root.name]: root.value };
}

function serializeXml(value: unknown): string {
  const root =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { root: value };
  const keys = Object.keys(root);
  const body =
    keys.length === 1
      ? renderXmlElement(keys[0], root[keys[0]], 0)
      : renderXmlElement("root", root, 0);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

function renderXmlElement(name: string, value: unknown, depth: number): string {
  const pad = "  ".repeat(depth);
  const safeName = /^[A-Za-z_][\w.-]*$/.test(name) ? name : "item";

  if (Array.isArray(value)) {
    return value.map((v) => renderXmlElement(safeName, v, depth)).join("\n");
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const attrs: string[] = [];
    const childKeys: string[] = [];
    for (const k of Object.keys(obj)) {
      if (k.startsWith("@")) attrs.push(` ${k.slice(1)}="${escapeAttr(String(obj[k]))}"`);
      else childKeys.push(k);
    }
    const attrStr = attrs.join("");
    const textVal = obj[XML_TEXT];
    const elementChildren = childKeys.filter((k) => k !== XML_TEXT);
    if (elementChildren.length === 0) {
      const inner = textVal === undefined ? "" : escapeText(String(textVal));
      return inner === ""
        ? `${pad}<${safeName}${attrStr}/>`
        : `${pad}<${safeName}${attrStr}>${inner}</${safeName}>`;
    }
    const childXml = elementChildren
      .map((k) => renderXmlElement(k, obj[k], depth + 1))
      .join("\n");
    const textXml =
      textVal === undefined ? "" : `\n${"  ".repeat(depth + 1)}${escapeText(String(textVal))}`;
    return `${pad}<${safeName}${attrStr}>${textXml}\n${childXml}\n${pad}</${safeName}>`;
  }
  const inner = value === null || value === undefined ? "" : escapeText(String(value));
  return inner === ""
    ? `${pad}<${safeName}/>`
    : `${pad}<${safeName}>${inner}</${safeName}>`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
