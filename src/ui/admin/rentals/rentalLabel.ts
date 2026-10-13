import QRCode from "qrcode";

// Printable rental spot labels, drawn as a pure black-and-white PNG at the exact physical size so any printer
// can print the file at true size (the PNG carries its dpi). Layout maths and the PNG header are plain functions
// so they can be tested without a canvas.

export const LABEL_DPI = 300;

// The full Manchester Makerspace logo (ring, M and name), served at /assets/FilledLaserableLogo.svg.
export const LOGO_URL = "/assets/FilledLaserableLogo.svg";
export const LOGO_ASPECT = 960.20905 / 579.42291; // width / height

export type LabelPresetId = "4x6" | "small";

export interface LabelPreset {
  id: LabelPresetId;
  name: string;
  widthIn: number;
  heightIn: number;
}

export const LABEL_PRESETS: LabelPreset[] = [
  { id: "4x6",   name: "4″ × 6″ (portrait)",              widthIn: 4,   heightIn: 6 },
  { id: "small", name: "3½″ × 1⅛″ (address label)", widthIn: 3.5, heightIn: 1.125 },
];

export interface Rect { x: number; y: number; w: number; h: number; }

export interface LabelLayout {
  width: number;
  height: number;
  logo?: Rect;
  caption?: Rect;        // "Rental Spot" next to the logo
  number: Rect;          // spot number, fitted into this box
  qr: Rect;              // square box the QR (including its quiet zone) is drawn into
  link: Rect;            // short link text, fitted into this box
  linkMaxLines: number;
  showScheme: boolean;   // print "HTTPS://" in the link text
}

const px = (inches: number) => Math.round(inches * LABEL_DPI);

/** Geometry for a preset, in pixels at LABEL_DPI. Everything stays inside the label with a safe margin. */
export const layoutFor = (preset: LabelPreset): LabelLayout => {
  const width = px(preset.widthIn);
  const height = px(preset.heightIn);

  if (preset.id === "4x6") {
    // Vertical budget (inches): margin 0.2, header 0.8, number 0.72, QR 3.3, link 0.55, margin 0.2.
    const m = px(0.2);
    const qrSize = px(3.3);
    const logoW = px(1.35);
    return {
      width, height,
      logo:    { x: m,                  y: m,         w: logoW,                          h: px(0.8) },
      caption: { x: m + logoW + px(0.15), y: m,       w: width - 2 * m - logoW - px(0.15), h: px(0.8) },
      number:  { x: m,                  y: px(1.05),  w: width - 2 * m,                  h: px(0.72) },
      qr:      { x: Math.round((width - qrSize) / 2), y: px(1.9), w: qrSize,             h: qrSize },
      link:    { x: m,                  y: px(5.25),  w: width - 2 * m,                  h: px(0.55) },
      linkMaxLines: 1,
      showScheme: true,
    };
  }

  // Small landscape label: text on the left, QR on the right.
  const m = px(0.06);
  const qrSize = height - 2 * m;
  const textW = width - 3 * m - qrSize;
  return {
    width, height,
    number: { x: m, y: m,                    w: textW, h: Math.round(height * 0.46) },
    qr:     { x: width - m - qrSize, y: m,   w: qrSize, h: qrSize },
    link:   { x: m, y: m + Math.round(height * 0.5), w: textW, h: height - 2 * m - Math.round(height * 0.5) },
    linkMaxLines: 2,
    showScheme: false,
  };
};

/** Largest rectangle of the given width/height ratio that fits inside the box, centred in it. */
export const containRect = (box: Rect, aspect: number): Rect => {
  const w = Math.min(box.w, box.h * aspect);
  const h = w / aspect;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
};

/** The short link as printed. Keeps the exact characters; only the scheme may be dropped to fit. */
export const linkText = (shortUrl: string, showScheme: boolean): string =>
  showScheme ? shortUrl : shortUrl.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");

/** Largest font size (px) between min and max for which measure(size) fits maxWidth, or min if none do. */
export const fitFontSize = (measure: (size: number) => number, maxWidth: number, maxSize: number, minSize: number): number => {
  for (let size = maxSize; size > minSize; size -= 2) {
    if (measure(size) <= maxWidth) return size;
  }
  return minSize;
};

/** Split a link at its last "/" so it can wrap onto two lines without cutting the code. */
export const splitLink = (text: string): string[] => {
  const slash = text.lastIndexOf("/");
  if (slash <= 0 || slash === text.length - 1) return [text];
  return [text.slice(0, slash + 1), text.slice(slash + 1)];
};

/** The QR as a boolean grid (true = dark module). Uses the library's automatic mode, which picks the compact
 *  alphanumeric encoding for the uppercase short URL. */
export const qrMatrix = (text: string): boolean[][] => {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const rows: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(!!qr.modules.get(r, c));
    rows.push(row);
  }
  return rows;
};

/** Pixels per module and the drawn size, using a whole number of pixels so edges stay crisp when printed. */
export const qrScale = (modules: number, boxSize: number, quiet = 2): { module: number; drawn: number; offset: number } => {
  const module = Math.max(1, Math.floor(boxSize / (modules + 2 * quiet)));
  const drawn = module * modules;
  return { module, drawn, offset: Math.floor((boxSize - drawn) / 2) };
};

// ---- PNG physical size (pHYs) -------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Returns a copy of the PNG with a pHYs chunk (pixels per metre) so viewers print it at its true physical size.
 *  The browser's canvas export omits it, and without it many viewers scale the image to fit the page. */
export const withPngDpi = (png: Uint8Array, dpi: number): Uint8Array => {
  if (png.length < 33 || PNG_SIGNATURE.some((b, i) => png[i] !== b)) throw new Error("Not a PNG image.");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  // Walk the chunks, drop any existing pHYs, and insert ours right after IHDR (it must precede IDAT).
  const chunks: Uint8Array[] = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("Truncated PNG image.");
    if (type !== "pHYs") chunks.push(png.subarray(offset, end));
    offset = end;
  }

  const perMetre = Math.round(dpi / 0.0254);
  const body = new Uint8Array(13);
  body.set([0x70, 0x48, 0x59, 0x73], 0); // "pHYs"
  const bodyView = new DataView(body.buffer);
  bodyView.setUint32(4, perMetre);
  bodyView.setUint32(8, perMetre);
  body[12] = 1; // unit: metre
  const chunk = new Uint8Array(21);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9);
  chunk.set(body, 4);
  chunkView.setUint32(17, crc32(body));

  const out: Uint8Array[] = [Uint8Array.from(PNG_SIGNATURE), chunks[0], chunk, ...chunks.slice(1)];
  const total = out.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let at = 0;
  out.forEach(part => { result.set(part, at); at += part.length; });
  return result;
};

// ---- Drawing --------------------------------------------------------------------------------------------------------

const FONT_FAMILY = "Roboto, Arial, Helvetica, sans-serif";
const MONO_FAMILY = "'Roboto Mono', Consolas, 'Courier New', monospace";

export interface LabelContent {
  number: string;
  shortUrl: string;
}

const fontOf = (size: number, weight: number, family = FONT_FAMILY) => `${weight} ${size}px ${family}`;

const drawFitted = (ctx: CanvasRenderingContext2D, text: string, box: Rect, maxSize: number, minSize: number,
                    weight: number, family: string, align: CanvasTextAlign) => {
  const size = fitFontSize(s => { ctx.font = fontOf(s, weight, family); return ctx.measureText(text).width; },
    box.w, maxSize, minSize);
  ctx.font = fontOf(size, weight, family);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const x = align === "center" ? box.x + box.w / 2 : align === "right" ? box.x + box.w : box.x;
  ctx.fillText(text, x, box.y + box.h / 2);
};

/** Draws the label onto the canvas (sized here) in black on white, with no gray so thermal printers stay sharp. */
export const drawLabel = (canvas: HTMLCanvasElement, preset: LabelPreset, content: LabelContent, logo?: CanvasImageSource | null) => {
  const layout = layoutFor(preset);
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the label in this browser.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = "#000000";

  if (layout.logo && logo) {
    const fit = containRect(layout.logo, LOGO_ASPECT);
    ctx.drawImage(logo, fit.x, fit.y, fit.w, fit.h);
  }
  if (layout.caption) drawFitted(ctx, "Rental Spot", layout.caption, px(0.5), px(0.2), 700, FONT_FAMILY, "right");

  const bigNumber = preset.id === "4x6" ? px(0.7) : Math.round(layout.height * 0.42);
  drawFitted(ctx, content.number, layout.number, bigNumber, px(0.2), 900, FONT_FAMILY, preset.id === "4x6" ? "center" : "left");

  // QR: whole-pixel modules, so the edges are crisp on any printer.
  const matrix = qrMatrix(content.shortUrl);
  const { module, offset } = qrScale(matrix.length, layout.qr.w);
  const originX = layout.qr.x + offset;
  const originY = layout.qr.y + offset;
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) ctx.fillRect(originX + c * module, originY + r * module, module, module);
  }));

  // Link text under (4x6) or beside (small) the QR.
  const text = linkText(content.shortUrl, layout.showScheme);
  const lines = layout.linkMaxLines > 1 ? splitLink(text) : [text];
  const align: CanvasTextAlign = preset.id === "4x6" ? "center" : "left";
  const lineHeight = layout.link.h / lines.length;
  const maxLine = preset.id === "4x6" ? px(0.36) : Math.round(lineHeight * 0.85);
  lines.forEach((line, i) => {
    drawFitted(ctx, line, { x: layout.link.x, y: layout.link.y + i * lineHeight, w: layout.link.w, h: lineHeight },
      maxLine, px(0.1), 700, MONO_FAMILY, align);
  });

  // Anything drawn with anti-aliasing is pushed to pure black or white.
  const image = ctx.getImageData(0, 0, layout.width, layout.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const value = gray < 150 ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
};

/** The canvas as a PNG blob that carries the label's physical size. */
export const labelPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(async blob => {
    if (!blob) return reject(new Error("Could not generate the image."));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    resolve(new Blob([withPngDpi(bytes, LABEL_DPI) as BlobPart], { type: "image/png" }));
  }, "image/png");
});

export const labelFilename = (number: string, preset: LabelPreset) =>
  `rental-spot-${number.replace(/[^A-Za-z0-9_-]+/g, "-")}-label-${preset.id}.png`;
