import { deflateSync, inflateSync } from "zlib";
import { buildPdf, packBilevel, pdfFilename, PdfLabelPage } from "ui/admin/rentals/labelPdf";

const deflate = async (bytes: Uint8Array) => new Uint8Array(deflateSync(Buffer.from(bytes)));
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

// A 10x2 image: top row black, bottom row white.
const sample = (width: number, height: number, dark: (x: number, y: number) => boolean) => {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = dark(x, y) ? 0 : 255;
      const i = (y * width + x) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
};

const page = (overrides: Partial<PdfLabelPage> = {}): PdfLabelPage => {
  const imageWidth = 16, imageHeight = 8;
  return {
    widthIn: 4, heightIn: 6, imageWidth, imageHeight,
    bits: packBilevel(sample(imageWidth, imageHeight, (x, y) => (x + y) % 3 === 0), imageWidth, imageHeight),
    ...overrides,
  };
};

describe("packBilevel", () => {
  it("packs rows most significant bit first, 0 for black and 1 for white, padding rows to whole bytes", () => {
    const bits = packBilevel(sample(10, 2, (_x, y) => y === 0), 10, 2);
    // 10 pixels per row => 2 bytes per row. Row 0 is all black (padding bits stay white), row 1 is all white.
    expect(Array.from(bits)).toEqual([0x00, 0x3f, 0xff, 0xff]);
  });

  it("maps individual pixels to the right bit", () => {
    const bits = packBilevel(sample(8, 1, x => x === 0 || x === 7), 8, 1);
    expect(bits[0]).toBe(0b01111110);
  });

  it("treats mid-gray by the threshold", () => {
    const rgba = Uint8Array.from([100, 100, 100, 255, 200, 200, 200, 255]);
    expect(packBilevel(rgba, 2, 1)[0]).toBe(0b01111111);
  });
});

describe("buildPdf", () => {
  it("rejects an empty list", async () => {
    await expect(buildPdf([], deflate)).rejects.toThrow("no labels");
  });

  it("writes a PDF whose cross-reference table points at every object", async () => {
    const pdf = latin1(await buildPdf([page(), page({ widthIn: 3.5, heightIn: 1.125 })], deflate));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);

    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");

    const entries = pdf.slice(startxref).split("\n").filter(line => /^\d{10} \d{5} n $/.test(line));
    expect(entries.length).toBe(2 + 2 * 3); // catalog + page tree + (page, content, image) per page
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
    expect(pdf).toContain(`/Size ${entries.length + 1}`);
  });

  it("makes one page per label at exactly the label's size in points", async () => {
    const pdf = latin1(await buildPdf([page(), page({ widthIn: 3.5, heightIn: 1.125 })], deflate));
    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("/MediaBox [0 0 288 432]");  // 4in x 6in
    expect(pdf).toContain("/MediaBox [0 0 252 81]");    // 3.5in x 1.125in
    expect((pdf.match(/\/Type \/Page /g) || []).length).toBe(2);
    // The image fills the whole page.
    expect(pdf).toContain("q 288 0 0 432 0 0 cm /Im0 Do Q");
    expect(pdf).toContain("q 252 0 0 81 0 0 cm /Im0 Do Q");
  });

  it("stores the image so that it decodes back to the original bits", async () => {
    const source = page();
    const bytes = await buildPdf([source], deflate);
    const pdf = latin1(bytes);
    const dictAt = pdf.indexOf("/Subtype /Image");
    const length = Number(/\/Length (\d+) >>\nstream\n/.exec(pdf.slice(dictAt))![1]);
    const streamAt = pdf.indexOf("stream\n", dictAt) + "stream\n".length;
    const decoded = inflateSync(Buffer.from(bytes.subarray(streamAt, streamAt + length)));
    expect(Array.from(decoded)).toEqual(Array.from(source.bits));
    expect(pdf).toContain("/Filter /FlateDecode");
    expect(pdf).toContain("/BitsPerComponent 1");
    expect(pdf).toContain("/ColorSpace /DeviceGray");
  });

  it("still works without a compressor, storing the bits as they are", async () => {
    const source = page();
    const bytes = await buildPdf([source]);
    const pdf = latin1(bytes);
    expect(pdf).not.toContain("FlateDecode");
    const dictAt = pdf.indexOf("/Subtype /Image");
    const length = Number(/\/Length (\d+) >>\nstream\n/.exec(pdf.slice(dictAt))![1]);
    expect(length).toBe(source.bits.length);
  });

  it("names the file from the size and count", () => {
    expect(pdfFilename("4x6", 40)).toBe("rental-spot-labels-4x6-40.pdf");
  });
});
