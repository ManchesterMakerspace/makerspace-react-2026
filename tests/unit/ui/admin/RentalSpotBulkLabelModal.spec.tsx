import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const createShortLink = jest.fn();
jest.mock("api/shortcodes", () => ({ createShortLink: (...args: any[]) => createShortLink(...args) }));
jest.mock("ui/common/FormModal", () => (props: any) => <div data-testid="modal"><h2>{props.title}</h2>{props.children}</div>);
jest.mock("ui/admin/rentals/shortLinkRetry", () => ({ ...jest.requireActual("ui/admin/rentals/shortLinkRetry"), LINK_SPACING_MS: 0 }));
jest.mock("ui/admin/rentals/rentalLabel", () => ({
  ...jest.requireActual("ui/admin/rentals/rentalLabel"),
  loadLogo: async () => null,
  loadFonts: async () => undefined,
  drawLabel: (canvas: HTMLCanvasElement) => { canvas.width = 8; canvas.height = 2; },
}));
jest.mock("ui/admin/rentals/labelPdf", () => ({
  ...jest.requireActual("ui/admin/rentals/labelPdf"),
  browserDeflate: null,
  buildPdf: async (pages: any[]) => new Uint8Array(pages.length),
}));
import RentalSpotBulkLabelModal from "ui/admin/rentals/RentalSpotBulkLabelModal";

const spot = (n: number, active?: boolean) => ({ id: `id${n}`, number: `Tote-${n}`, active });
const flush = async () => { for (let i = 0; i < 20; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); };

describe("RentalSpotBulkLabelModal", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (URL as any).createObjectURL = jest.fn(() => "blob:fake-pdf");
    (URL as any).revokeObjectURL = jest.fn();
    HTMLCanvasElement.prototype.getContext = (() => ({ getImageData: () => ({ data: new Uint8ClampedArray(8 * 2 * 4) }) })) as any;
  });
  beforeEach(() => {
    createShortLink.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const render = (spots: any[]) => act(async () => root.render(<RentalSpotBulkLabelModal spots={spots} onClose={() => undefined} />));
  const text = () => container.textContent || "";
  const button = (label: string) => Array.from(container.querySelectorAll("button, a")).find(el => (el.textContent || "").includes(label)) as HTMLElement | undefined;

  it("gets a link for every spot, then offers the PDF", async () => {
    createShortLink.mockImplementation(async (target: string) => ({ code: "x", short_url: `HTTPS://X.ORG/L${target.slice(-3)}` }));
    await render([spot(1), spot(2), spot(3)]);
    await flush();
    expect(createShortLink).toHaveBeenCalledTimes(3);
    expect(createShortLink).toHaveBeenCalledWith("/rentals/spots/id1");
    expect(text()).toContain("3 labels ready");
    const download = button("Download PDF") as HTMLAnchorElement;
    expect(download.getAttribute("href")).toBe("blob:fake-pdf");
    expect(download.getAttribute("download")).toBe("rental-spot-labels-4x6-3.pdf");
  });

  it("never has more than two link requests in flight", async () => {
    let inFlight = 0; let peak = 0;
    createShortLink.mockImplementation(async () => {
      inFlight += 1; peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight -= 1;
      return { code: "x", short_url: "HTTPS://X.ORG/LABC" };
    });
    await render(Array.from({ length: 10 }, (_, i) => spot(i + 1)));
    await flush();
    expect(peak).toBeLessThanOrEqual(2);
    expect(createShortLink).toHaveBeenCalledTimes(10);
  });

  it("names the failed spots and the server's answer, makes no PDF, and Try again asks only for the missing ones", async () => {
    createShortLink.mockImplementation(async (target: string) => {
      if (target.endsWith("id3")) throw Object.assign(new Error("nope"), { status: 404 });
      return { code: "x", short_url: "HTTPS://X.ORG/LABC" };
    });
    await render([spot(1), spot(2), spot(3), spot(4)]);
    await flush();
    expect(text()).toContain("Could not get a short link for 1 spot: Tote-3");
    expect(text()).toContain("spot not found (404)");
    expect(text()).toContain("No PDF was made");
    expect(button("Download PDF")).toBeUndefined();

    createShortLink.mockClear();
    createShortLink.mockImplementation(async () => ({ code: "x", short_url: "HTTPS://X.ORG/LABC" }));
    await act(async () => { button("Try again")!.click(); });
    await flush();
    expect(createShortLink).toHaveBeenCalledTimes(1);               // only the one that failed
    expect(createShortLink).toHaveBeenCalledWith("/rentals/spots/id3");
    expect(text()).toContain("4 labels ready");
  });

  it("stops early when the first requests all fail, instead of working through the whole list", async () => {
    createShortLink.mockImplementation(async () => { throw Object.assign(new Error("nope"), { status: 404 }); });
    await render(Array.from({ length: 30 }, (_, i) => spot(i + 1)));
    await flush();
    expect(createShortLink.mock.calls.length).toBeLessThan(10);
    expect(text()).toContain("Stopped after the first");
    expect(button("Download PDF")).toBeUndefined();
  });

  it("skips inactive spots without asking for their links, and says so", async () => {
    createShortLink.mockImplementation(async () => ({ code: "x", short_url: "HTTPS://X.ORG/LABC" }));
    await render([spot(1), spot(2, false), spot(3)]);
    await flush();
    expect(createShortLink).toHaveBeenCalledTimes(2);
    expect(createShortLink).not.toHaveBeenCalledWith("/rentals/spots/id2");
    expect(text()).toContain("Skipped 1 inactive spot");
    expect(text()).toContain("Tote-2");
    expect(text()).toContain("2 labels ready");
  });

  it("refuses more than 200 labels and makes no requests", async () => {
    await render(Array.from({ length: 201 }, (_, i) => spot(i + 1)));
    await flush();
    expect(createShortLink).not.toHaveBeenCalled();
    expect(text()).toContain("select 200 or fewer");
  });

  it("puts pages in natural spot-number order", async () => {
    const seen: string[] = [];
    createShortLink.mockImplementation(async (target: string) => { seen.push(target.replace("/rentals/spots/", "")); return { code: "x", short_url: "HTTPS://X.ORG/LABC" }; });
    await render([spot(10), spot(2), spot(1)]);
    await flush();
    expect(seen.sort()).toEqual(["id1", "id10", "id2"]);
    expect(text()).toContain("3 labels ready");
  });
});
