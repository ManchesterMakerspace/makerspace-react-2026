// A minimal PDF writer for rental spot labels: one page per label, each page exactly the label's size, holding one
// black-and-white (1 bit per pixel) image. Opening the PDF and printing it prints every label in one job, on the
// default printer, with no printer-specific setup. Written by hand so no PDF library is needed.

export interface PdfLabelPage {
  widthIn: number;
  heightIn: number;
  imageWidth: number;
  imageHeight: number;
  /** 1 bit per pixel, rows padded to a whole byte, most significant bit first. 0 = black, 1 = white. */
  bits: Uint8Array;
}

export type Deflate = (bytes: Uint8Array) => Promise<Uint8Array>;

/** Packs RGBA pixels into 1-bit rows. Pixels darker than the threshold become black (0), the rest white (1). */
export const packBilevel = (rgba: ArrayLike<number>, width: number, height: number, threshold = 128): Uint8Array => {
  const rowBytes = Math.ceil(width / 8);
  const out = new Uint8Array(rowBytes * height).fill(0xff);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
      if (gray < threshold) out[y * rowBytes + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }
  return out;
};

/** zlib deflate using the browser's built-in compressor, or null where the browser lacks it (the PDF is then larger). */
export const browserDeflate: Deflate | null =
  typeof CompressionStream === "function"
    ? async bytes => {
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    : null;

const ascii = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

const points = (inches: number): string => (Math.round(inches * 72 * 100) / 100).toString();

/** Builds the PDF file bytes. Pass a deflate function to compress the images (strongly recommended). */
export const buildPdf = async (pages: PdfLabelPage[], deflate?: Deflate | null): Promise<Uint8Array> => {
  if (pages.length === 0) throw new Error("There are no labels to put in the PDF.");

  const parts: Uint8Array[] = [];
  const offsets: number[] = []; // byte offset of object n (index n - 1)
  let length = 0;
  const write = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? ascii(data) : data;
    parts.push(bytes);
    length += bytes.length;
  };
  const startObject = (id: number) => { offsets[id - 1] = length; write(`${id} 0 obj\n`); };

  write("%PDF-1.4\n");
  write(Uint8Array.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment

  const firstPageObject = 3;
  const pageObjectId = (index: number) => firstPageObject + index * 3;
  const kids = pages.map((_, i) => `${pageObjectId(i)} 0 R`).join(" ");

  startObject(1);
  write("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject(2);
  write(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageId = pageObjectId(i);
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const w = points(page.widthIn);
    const h = points(page.heightIn);

    startObject(pageId);
    write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);

    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
    startObject(contentId);
    write(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    const body = deflate ? await deflate(page.bits) : page.bits;
    startObject(imageId);
    write(`<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceGray ` +
      `/BitsPerComponent 1${deflate ? " /Filter /FlateDecode" : ""} /Length ${body.length} >>\nstream\n`);
    write(body);
    write("\nendstream\nendobj\n");
  }

  const objectCount = pageObjectId(pages.length - 1) + 2;
  const xrefAt = length;
  write(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id++) write(`${String(offsets[id - 1]).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const result = new Uint8Array(length);
  let at = 0;
  parts.forEach(part => { result.set(part, at); at += part.length; });
  return result;
};

export const pdfFilename = (presetId: string, count: number) => `rental-spot-labels-${presetId}-${count}.pdf`;
