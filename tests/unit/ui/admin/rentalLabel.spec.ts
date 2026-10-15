import {
  LABEL_DPI, LABEL_PRESETS, LOGO_ASPECT, containRect, crc32, fitFontSize, labelFilename, layoutFor, linkText, qrMatrix, qrScale, splitLink, withPngDpi,
} from "ui/admin/rentals/rentalLabel";

// jsdom lacks TextEncoder (browsers have it); the QR library and the CRC test both need it.
import { TextEncoder as NodeTextEncoder } from "util";
if (typeof (global as any).TextEncoder === "undefined") (global as any).TextEncoder = NodeTextEncoder;

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// A valid 1x1 PNG (IHDR, IDAT, IEND) to exercise the header rewrite.
const ONE_PIXEL_PNG = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
), c => c.charCodeAt(0));

const chunkTypes = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const types: string[] = [];
  for (let offset = 8; offset < png.length; ) {
    types.push(String.fromCharCode(...Array.from(png.subarray(offset + 4, offset + 8))));
    offset += 12 + view.getUint32(offset);
  }
  return types;
};

describe("rental label layout", () => {
  LABEL_PRESETS.forEach(preset => {
    describe(preset.name, () => {
      const layout = layoutFor(preset);

      it("is exactly the label size at 300 dpi", () => {
        expect(layout.width).toBe(Math.round(preset.widthIn * LABEL_DPI));
        expect(layout.height).toBe(Math.round(preset.heightIn * LABEL_DPI));
      });

      it("keeps every element inside the label", () => {
        [layout.logo, layout.caption, layout.number, layout.qr, layout.link].filter(Boolean).forEach(rect => {
          expect(rect!.x).toBeGreaterThanOrEqual(0);
          expect(rect!.y).toBeGreaterThanOrEqual(0);
          expect(rect!.x + rect!.w).toBeLessThanOrEqual(layout.width);
          expect(rect!.y + rect!.h).toBeLessThanOrEqual(layout.height);
        });
      });

      it("does not let the number, QR and link overlap", () => {
        expect(overlaps(layout.number, layout.qr)).toBe(false);
        expect(overlaps(layout.number, layout.link)).toBe(false);
        expect(overlaps(layout.qr, layout.link)).toBe(false);
      });

      it("has a square QR area", () => {
        expect(layout.qr.w).toBe(layout.qr.h);
      });
    });
  });

  it("keeps the 4x6 QR large enough to scan from a distance", () => {
    expect(layoutFor(LABEL_PRESETS[0]).qr.w).toBeGreaterThan(Math.round(3 * LABEL_DPI));
  });

  it("keeps the small QR at least 0.8 inch", () => {
    expect(layoutFor(LABEL_PRESETS[1]).qr.w).toBeGreaterThanOrEqual(Math.round(0.8 * LABEL_DPI));
  });
});

describe("logo placement", () => {
  it("fits the logo inside its box without distorting it", () => {
    const box = { x: 100, y: 50, w: 400, h: 200 };
    const fit = containRect(box, LOGO_ASPECT);
    expect(fit.w / fit.h).toBeCloseTo(LOGO_ASPECT, 5);
    expect(fit.x).toBeGreaterThanOrEqual(box.x);
    expect(fit.y).toBeGreaterThanOrEqual(box.y);
    expect(fit.x + fit.w).toBeLessThanOrEqual(box.x + box.w + 0.001);
    expect(fit.y + fit.h).toBeLessThanOrEqual(box.y + box.h + 0.001);
    const tall = containRect({ x: 0, y: 0, w: 100, h: 400 }, LOGO_ASPECT);
    expect(tall.w).toBe(100);
  });

  it("leaves the 4x6 logo a sensible size and keeps it clear of the caption", () => {
    const layout = layoutFor(LABEL_PRESETS[0]);
    expect(layout.logo!.w).toBeGreaterThanOrEqual(Math.round(1.2 * LABEL_DPI));
    expect(overlaps(layout.logo!, layout.caption!)).toBe(false);
  });
});

describe("link text", () => {
  const url = "HTTPS://PORTAL.EXAMPLE.ORG/L7K3M9XQ2P";
  it("keeps the scheme when asked and drops only the scheme otherwise", () => {
    expect(linkText(url, true)).toBe(url);
    expect(linkText(url, false)).toBe("PORTAL.EXAMPLE.ORG/L7K3M9XQ2P");
  });
  it("splits at the last slash so the code is never cut", () => {
    expect(splitLink("PORTAL.EXAMPLE.ORG/L7K3M9XQ2P")).toEqual(["PORTAL.EXAMPLE.ORG/", "L7K3M9XQ2P"]);
    expect(splitLink("NOSLASH")).toEqual(["NOSLASH"]);
  });
});

describe("fitFontSize", () => {
  const measure = (size: number) => size * 10;
  it("returns the largest size that fits", () => {
    expect(fitFontSize(measure, 505, 100, 10)).toBe(50);
  });
  it("returns the maximum when it already fits and the minimum when nothing does", () => {
    expect(fitFontSize(measure, 5000, 100, 10)).toBe(100);
    expect(fitFontSize(measure, 5, 100, 10)).toBe(10);
  });
});

describe("QR code", () => {
  it("builds a square matrix with the three finder patterns", () => {
    const matrix = qrMatrix("HTTPS://PORTAL.EXAMPLE.ORG/L7K3M9XQ2P");
    const n = matrix.length;
    expect(matrix.every(row => row.length === n)).toBe(true);
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
      expect(matrix[r][c]).toBe(true);
      expect(matrix[r + 3][c + 3]).toBe(true); // centre of the finder
      expect(matrix[r + 1][c + 1]).toBe(false); // ring inside the outer square
    });
  });

  it("uses the compact encoding for the uppercase short link (smaller than the same text in lowercase)", () => {
    const upper = qrMatrix("HTTPS://PORTAL.EXAMPLE.ORG/L7K3M9XQ2P").length;
    const lower = qrMatrix("https://portal.example.org/L7K3M9XQ2P").length;
    expect(upper).toBeLessThan(lower);
  });

  it("uses a whole number of pixels per module and centres the code", () => {
    const { module, drawn, offset } = qrScale(29, 900);
    expect(Number.isInteger(module)).toBe(true);
    expect(drawn).toBe(module * 29);
    expect(offset * 2 + drawn).toBeLessThanOrEqual(900);
    expect(offset).toBeGreaterThanOrEqual(module * 2 - 1); // quiet zone of at least two modules
  });
});

describe("PNG physical size", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("adds a pHYs chunk right after IHDR with 300 dpi and a valid checksum", () => {
    const result = withPngDpi(ONE_PIXEL_PNG, 300);
    expect(chunkTypes(result)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);
    expect(result.length).toBe(ONE_PIXEL_PNG.length + 21);

    const view = new DataView(result.buffer, result.byteOffset, result.byteLength);
    const at = 8 + 12 + 13; // signature + IHDR chunk
    expect(view.getUint32(at)).toBe(9);
    expect(view.getUint32(at + 8)).toBe(11811); // 300 dpi in pixels per metre
    expect(view.getUint32(at + 12)).toBe(11811);
    expect(result[at + 16]).toBe(1);
    expect(view.getUint32(at + 17)).toBe(crc32(result.subarray(at + 4, at + 17)));
  });

  it("replaces an existing pHYs chunk instead of duplicating it", () => {
    const once = withPngDpi(ONE_PIXEL_PNG, 72);
    const twice = withPngDpi(once, 300);
    expect(chunkTypes(twice).filter(type => type === "pHYs")).toHaveLength(1);
    expect(twice.length).toBe(once.length);
  });

  it("rejects data that is not a PNG", () => {
    expect(() => withPngDpi(new Uint8Array(40), 300)).toThrow("Not a PNG");
  });
});

describe("label filename", () => {
  it("is safe for any spot number and names the size", () => {
    expect(labelFilename("LR-Tote-1", LABEL_PRESETS[0])).toBe("rental-spot-LR-Tote-1-label-4x6.png");
    expect(labelFilename("Odd Name/1", LABEL_PRESETS[1])).toBe("rental-spot-Odd-Name-1-label-small.png");
  });
});
