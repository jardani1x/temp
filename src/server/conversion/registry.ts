import type { Converter, Format } from "./types.js";
import { config } from "../config.js";
import { toolAvailable } from "../util/exec.js";
import { FORMATS } from "./formats.js";

import { dataConverter } from "./converters/data.js";
import { imageConverter } from "./converters/image.js";
import { avConverter } from "./converters/av.js";
import { markupConverter } from "./converters/markup.js";
import { pdfConverter } from "./converters/pdf.js";
import { officeConverter } from "./converters/office.js";

/**
 * Converters in priority order. When more than one can handle a pair, the first
 * available wins (e.g. pandoc is preferred for markup, LibreOffice for office
 * binary formats).
 */
const CONVERTERS: Converter[] = [
  dataConverter,
  imageConverter,
  avConverter,
  markupConverter,
  pdfConverter,
  officeConverter,
];

type ToolName = NonNullable<Converter["requiresTool"]>;

const toolStatus: Record<ToolName, boolean> = {
  ffmpeg: false,
  soffice: false,
  gs: false,
  pandoc: false,
};

let initialized = false;

/** Probe external tools once at startup so capability reporting is accurate. */
export async function initRegistry(): Promise<void> {
  const probes: Array<Promise<void>> = [
    toolAvailable(config.tools.ffmpeg, "-version").then((ok) => {
      toolStatus.ffmpeg = ok;
    }),
    toolAvailable(config.tools.soffice, "--version").then((ok) => {
      toolStatus.soffice = ok;
    }),
    toolAvailable(config.tools.gs, "--version").then((ok) => {
      toolStatus.gs = ok;
    }),
    toolAvailable(config.tools.pandoc, "--version").then((ok) => {
      toolStatus.pandoc = ok;
    }),
  ];
  await Promise.all(probes);
  initialized = true;
}

export function toolStatusSnapshot(): Record<ToolName, boolean> {
  return { ...toolStatus };
}

function isAvailable(converter: Converter): boolean {
  if (!converter.requiresTool) return true;
  // Before init we optimistically assume tools exist (dev convenience).
  if (!initialized) return true;
  return toolStatus[converter.requiresTool];
}

/** Find the first available converter that handles from -> to. */
export function findConverter(from: Format, to: Format): Converter | null {
  for (const c of CONVERTERS) {
    if (isAvailable(c) && c.supports(from, to)) return c;
  }
  return null;
}

export function canConvert(from: Format, to: Format): boolean {
  return findConverter(from, to) !== null;
}

/** All target formats reachable from a given source format. */
export function targetsFor(from: Format): Format[] {
  const targets: Format[] = [];
  for (const info of FORMATS) {
    if (info.id === from) continue;
    if (canConvert(from, info.id)) targets.push(info.id);
  }
  return targets;
}

/** Map of every source format to its reachable targets (for the UI/API). */
export function conversionMatrix(): Record<Format, Format[]> {
  const matrix: Record<Format, Format[]> = {};
  for (const info of FORMATS) {
    const t = targetsFor(info.id);
    if (t.length > 0) matrix[info.id] = t;
  }
  return matrix;
}
