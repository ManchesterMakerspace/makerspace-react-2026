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

  it("lets a click on a hover-only shape reach the map, but keeps it for a clickable shape", async () => {
    const onMapClick = jest.fn();
    const onShapeClick = jest.fn();
    const triangle = (x: number) => [{ x, y: 10 }, { x: x + 20, y: 10 }, { x: x + 20, y: 40 }];
    await act(async () => {
      root.render(
        <FloorMap
          floorName="1"
          fitBox={FULL_FLOOR_BOX}
          fitKey="1"
          onMapClick={onMapClick}
          shapes={[
            { id: "hover-only", points: triangle(10), color: "#1976d2", label: "Hover only" },
            { id: "clickable", points: triangle(60), color: "#1976d2", label: "Clickable", onClick: onShapeClick },
          ]}
          markers={[]}
        />
      );
    });
    await settle(() => host.querySelectorAll(".leaflet-overlay-pane path").length === 2);
    const [hoverOnly, clickable] = Array.from(host.querySelectorAll<SVGPathElement>(".leaflet-overlay-pane path"));

    await act(async () => { hoverOnly.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 })); });
    expect(onMapClick).toHaveBeenCalledTimes(1);
    expect(onShapeClick).not.toHaveBeenCalled();

    await act(async () => { clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 })); });
    expect(onShapeClick).toHaveBeenCalledTimes(1);
    expect(onMapClick).toHaveBeenCalledTimes(1); // the shape kept its click
  });

  describe("editing an outline", () => {
    const square = [{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 60 }, { x: 20, y: 60 }];
    const renderEditor = async (extra: Record<string, unknown> = {}) => {
      await act(async () => {
        root.render(
          <FloorMap floorName="1" fitBox={FULL_FLOOR_BOX} fitKey="1" shapes={[]} markers={[]}
            adjustPoints={square} adjustKey="shape:4" {...extra} />
        );
      });
      await settle(() => host.querySelectorAll(".floor-map-handle").length === 4);
    };

    it("shows a corner handle for every corner and a midpoint dot for every edge", async () => {
      await renderEditor();
      expect(host.querySelectorAll(".floor-map-handle").length).toBe(4);
      expect(host.querySelectorAll(".floor-map-midpoint").length).toBe(4);
    });

    it("shows nothing to edit when no shape is selected", async () => {
      await act(async () => {
        root.render(<FloorMap floorName="1" fitBox={FULL_FLOOR_BOX} fitKey="1" shapes={[]} markers={[]} />);
      });
      await settle(() => !!host.querySelector(".leaflet-image-layer"));
      expect(host.querySelectorAll(".floor-map-handle, .floor-map-midpoint").length).toBe(0);
    });

    it("keeps a click on a corner or edge dot from reaching the map (which would deselect the shape)", async () => {
      const onMapClick = jest.fn();
      await renderEditor({ onMapClick });
      const targets = [...Array.from(host.querySelectorAll(".floor-map-handle")), ...Array.from(host.querySelectorAll(".floor-map-midpoint"))];
      expect(targets.length).toBe(8);

      for (const target of targets) {
        await act(async () => { target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); });
      }
      expect(onMapClick).not.toHaveBeenCalled();

      // ...while a click on empty map still does.
      await act(async () => {
        host.querySelector(".leaflet-container")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      expect(onMapClick).toHaveBeenCalledTimes(1);
    });

    it("removes a corner on double-click, and on right-click", async () => {
      const onRemovePoint = jest.fn();
      await renderEditor({ onRemovePoint });
      const corners = Array.from(host.querySelectorAll(".floor-map-handle"));

      await act(async () => { corners[2].dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true })); });
      expect(onRemovePoint).toHaveBeenLastCalledWith(2);

      await act(async () => { corners[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
      expect(onRemovePoint).toHaveBeenLastCalledWith(0);
      expect(onRemovePoint).toHaveBeenCalledTimes(2);
    });

    it("adds a corner when an edge's midpoint dot is dragged: live while moving, saved on release", async () => {
      const onInsertPoint = jest.fn();
      window.scrollTo = jest.fn(); // Leaflet's keyboard handler calls it on mouse-down; jsdom does not implement it
      await renderEditor({ onInsertPoint });
      const dot = host.querySelectorAll(".floor-map-midpoint")[1]; // the edge from corner 1 to corner 2

      // Leaflet only starts a drag for the primary button, which it reads from the legacy
      // `which` flag that real browsers set and jsdom does not. The events go to the dot
      // (and bubble to the document, where Leaflet listens): Leaflet tags the element under
      // the cursor during a drag, so a bare `document` target would throw.
      const mouse = (type: string, x: number, y: number) =>
        new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, which: 1 } as MouseEventInit);
      await act(async () => { dot.dispatchEvent(mouse("mousedown", 100, 100)); });
      for (const [x, y] of [[110, 100], [130, 105], [150, 110]]) {
        await act(async () => {
          dot.dispatchEvent(mouse("mousemove", x, y));
          await new Promise(resolve => setTimeout(resolve, 20));
        });
      }
      const liveCalls = onInsertPoint.mock.calls.length;
      expect(liveCalls).toBeGreaterThan(0);
      expect(onInsertPoint.mock.calls.every(call => call[0] === 1 && call[2] === false)).toBe(true);

      await act(async () => { dot.dispatchEvent(mouse("mouseup", 150, 110)); });

      // Always the edge that was grabbed; the last report is the release, which saves.
      const calls = onInsertPoint.mock.calls;
      expect(calls.every(call => call[0] === 1)).toBe(true);
      expect(calls[calls.length - 1][2]).toBe(true);
      expect(calls.filter(call => call[2] === true).length).toBe(1);
      const ys = calls.map(call => call[1].y);
      expect(ys[ys.length - 1]).toBeGreaterThan(ys[0]); // the new corner followed the cursor
    });
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
