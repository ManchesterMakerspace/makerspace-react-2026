import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import FloorMap from "ui/toolCheckouts/FloorMap";
import { markerHtml } from "ui/toolCheckouts/markerIcons";
import { FULL_FLOOR_BOX } from "ui/toolCheckouts/floorMapGeometry";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const PLAN = '<svg width="1000" height="500" viewBox="0 0 1000 500"></svg>';

// Lets the plan fetch resolve and the component's effects run.
const settle = async (until: () => boolean) => {
  for (let i = 0; i < 40 && !until(); i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
};

describe("FloorMap", () => {
  const realFetch = (global as any).fetch;
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    (global as any).fetch = jest.fn(async () => ({ ok: true, text: async () => PLAN }));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    (global as any).fetch = realFetch;
  });

  it("loads the floor's plan and draws shapes and markers over it", async () => {
    await act(async () => {
      root.render(
        <FloorMap
          floorName="2"
          fitBox={FULL_FLOOR_BOX}
          fitKey="2"
          shapes={[{ id: "area", points: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }], color: "#1976d2", label: "Area" }]}
          markers={[{ id: "bench", x: 30, y: 30, color: "#d32f2f", icon: "saw", label: "Bench" }]}
        />
      );
    });
    await settle(() => !!host.querySelector(".floor-map-marker"));

    expect((global as any).fetch).toHaveBeenCalledWith("/assets/shopFloorPlans/floor-2.svg");
    expect(host.querySelector(".leaflet-image-layer")?.getAttribute("src")).toBe("/assets/shopFloorPlans/floor-2.svg");
    expect(host.querySelector(".leaflet-overlay-pane path")).not.toBeNull();
    expect(host.querySelector(".floor-map-marker")).not.toBeNull();
  });

  it("falls back to the placeholder plan when a floor has none", async () => {
    (global as any).fetch = jest.fn(async (url: string) =>
      url.includes("placeholder") ? { ok: true, text: async () => PLAN } : { ok: false, text: async () => "" });
    await act(async () => {
      root.render(<FloorMap floorName="9" fitBox={FULL_FLOOR_BOX} fitKey="9" shapes={[]} markers={[]} />);
    });
    await settle(() => !!host.querySelector(".leaflet-image-layer"));

    expect(host.querySelector(".leaflet-image-layer")?.getAttribute("src")).toBe("/assets/shopFloorPlans/placeholder.svg");
  });
});

describe("markerHtml", () => {
  it("draws a colored badge with a glyph, and a ring when highlighted", () => {
    const plain = markerHtml("saw", "#123456");
    expect(plain).toContain("background:#123456");
    expect(plain).toContain("<svg");
    expect(plain).not.toContain("floor-map-ring");
    expect(markerHtml("saw", "#123456", true)).toContain("floor-map-ring");
  });

  it("uses the default pin for a missing or unknown icon", () => {
    expect(markerHtml(undefined, "#000")).toBe(markerHtml("pin", "#000"));
    expect(markerHtml("rocket", "#000")).toBe(markerHtml("pin", "#000"));
  });
});
