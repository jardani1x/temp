/**
 * Minimal PDF writer that embeds one JPEG per page. JPEG bytes can be placed
 * directly into a PDF stream using the DCTDecode filter, so no image re-encoding
 * library is required. Enough to turn images into a clean PDF document.
 */
export interface JpegPage {
  jpeg: Buffer;
  width: number;
  height: number;
}

export function imagesToPdf(pages: JpegPage[]): Buffer {
  if (pages.length === 0) throw new Error("imagesToPdf: no pages");

  const objects: Buffer[] = [];
  // Object numbering: 1 = catalog, 2 = pages tree, then per page two objects
  // (page + content) and one image xobject.
  const pageObjNums: number[] = [];
  let nextObj = 3;

  const perPage = pages.map((p) => {
    const pageObj = nextObj++;
    const contentObj = nextObj++;
    const imageObj = nextObj++;
    pageObjNums.push(pageObj);
    return { ...p, pageObj, contentObj, imageObj };
  });

  // 1: Catalog
  objects[1] = Buffer.from(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  // 2: Pages tree
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  objects[2] = Buffer.from(
    `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>\nendobj\n`,
  );

  for (const p of perPage) {
    const w = p.width;
    const h = p.height;
    const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
    objects[p.pageObj] = Buffer.from(
      `${p.pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${p.imageObj} 0 R >> >> ` +
        `/Contents ${p.contentObj} 0 R >>\nendobj\n`,
    );
    objects[p.contentObj] = Buffer.from(
      `${p.contentObj} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`,
    );
    const imgHeader = Buffer.from(
      `${p.imageObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    objects[p.imageObj] = Buffer.concat([imgHeader, p.jpeg, Buffer.from(`\nendstream\nendobj\n`)]);
  }

  // Assemble with a cross-reference table.
  const header = Buffer.from("%PDF-1.7\n%\xff\xff\xff\xff\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets: number[] = [];
  let pos = header.length;

  const total = nextObj - 1;
  for (let i = 1; i <= total; i++) {
    const obj = objects[i];
    offsets[i] = pos;
    chunks.push(obj);
    pos += obj.length;
  }

  const xrefStart = pos;
  let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= total; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, "latin1"));

  return Buffer.concat(chunks);
}
