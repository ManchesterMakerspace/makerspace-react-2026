import {
  MAP_WIDTH, pctToLatLng, latLngToPct, boxToBounds, paddedBox, centroid, aspectFromSvgText, sortFloors, floorLabel,
  FULL_FLOOR_BOX, withMinSpan, insertPoint, removePoint, MIN_SHAPE_POINTS,
} from "ui/toolCheckouts/floorMapGeometry";

describe("floorMapGeometry", () => {
  const aspect = 0.75; // a plan three-quarters as tall as it is wide

  it("converts stored percent to Leaflet positions with y flipped", () => {
    // top-left of the plan is the highest latitude, lowest longitude
    expect(pctToLatLng(aspect, 0, 0)).toEqual([MAP_WIDTH * aspect, 0]);
    expect(pctToLatLng(aspect, 100, 100)).toEqual([0, MAP_WIDTH]);
    expect(pctToLatLng(aspect, 50, 50)).toEqual([MAP_WIDTH * aspect * 0.5, MAP_WIDTH * 0.5]);
  });

  it("round-trips a point through Leaflet space to one decimal", () => {
    for (const [x, y] of [[0, 0], [12.3, 87.6], [50, 50], [99.9, 0.1], [100, 100]]) {
      const [lat, lng] = pctToLatLng(aspect, x, y);
      expect(latLngToPct(aspect, lat, lng)).toEqual({ x, y });
    }
  });

  it("clamps clicks outside the plan into the 0-100 range the server accepts", () => {
    expect(latLngToPct(aspect, -50, -50)).toEqual({ x: 0, y: 100 });
    expect(latLngToPct(aspect, 5000, 5000)).toEqual({ x: 100, y: 0 });
  });

  it("converts a percent box to [south-west, north-east] bounds", () => {
    expect(boxToBounds(aspect, { minX: 10, maxX: 60, minY: 20, maxY: 80 })).toEqual([
      pctToLatLng(aspect, 10, 80),
      pctToLatLng(aspect, 60, 20),
    ]);
    expect(boxToBounds(aspect, FULL_FLOOR_BOX)).toEqual([[0, 0], [MAP_WIDTH * aspect, MAP_WIDTH]]);
  });

  it("pads a box without leaving the plan", () => {
    expect(paddedBox({ minX: 2, maxX: 50, minY: 40, maxY: 98 })).toEqual({ minX: 0, maxX: 55, minY: 35, maxY: 100 });
  });

  describe("insertPoint and removePoint", () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

    it("puts a new corner between the two ends of an edge", () => {
      expect(insertPoint(tri, 0, { x: 5, y: -2 })).toEqual([{ x: 0, y: 0 }, { x: 5, y: -2 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
      expect(insertPoint(tri, 1, { x: 12, y: 5 })).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 5 }, { x: 10, y: 10 }]);
    });

    it("puts a corner on the closing edge at the end of the list", () => {
      expect(insertPoint(tri, 2, { x: 4, y: 6 })).toEqual([...tri, { x: 4, y: 6 }]);
    });

    it("does not change the original or accept a bad edge", () => {
      const copy = JSON.parse(JSON.stringify(tri));
      insertPoint(tri, 0, { x: 1, y: 1 });
      expect(tri).toEqual(copy);
      expect(insertPoint(tri, 3, { x: 1, y: 1 })).toBe(tri);
      expect(insertPoint(tri, -1, { x: 1, y: 1 })).toBe(tri);
    });

    it("removes a corner, but never below three", () => {
      const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
      expect(removePoint(square, 1)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
      expect(removePoint(tri, 0)).toBe(tri); // same array back: nothing changed
      expect(removePoint(square, 9)).toBe(square);
      expect(MIN_SHAPE_POINTS).toBe(3);
    });
  });

  describe("withMinSpan", () => {
    it("widens a tiny box around its centre", () => {
      expect(withMinSpan({ minX: 48, maxX: 52, minY: 48, maxY: 52 }, 30)).toEqual({ minX: 35, maxX: 65, minY: 35, maxY: 65 });
    });

    it("leaves a box that is already wide enough alone", () => {
      const box = { minX: 10, maxX: 70, minY: 5, maxY: 60 };
      expect(withMinSpan(box, 30)).toEqual(box);
    });

    it("widens each axis independently and slides back inside the plan edge", () => {
      expect(withMinSpan({ minX: 0, maxX: 2, minY: 10, maxY: 90 }, 30)).toEqual({ minX: 0, maxX: 30, minY: 10, maxY: 90 });
      expect(withMinSpan({ minX: 98, maxX: 100, minY: 99, maxY: 100 }, 30)).toEqual({ minX: 70, maxX: 100, minY: 70, maxY: 100 });
    });
  });

  it("finds the centre of a shape", () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toEqual({ x: 5, y: 5 });
  });

  describe("aspectFromSvgText", () => {
    it("uses the viewBox", () => {
      expect(aspectFromSvgText('<svg width="1440" height="1054" viewBox="0 0 1440 1054"></svg>')).toBeCloseTo(1054 / 1440);
      expect(aspectFromSvgText('<svg viewBox="10 20 200 100"></svg>')).toBe(0.5);
    });

    it("falls back to width and height, then to null", () => {
      expect(aspectFromSvgText('<svg width="200" height="100"></svg>')).toBe(0.5);
      expect(aspectFromSvgText("<svg></svg>")).toBeNull();
    });
  });

  it("orders floors basement, 1st, 2nd and labels them", () => {
    expect(sortFloors(["2", "B", "1"])).toEqual(["B", "1", "2"]);
    expect(floorLabel("B")).toBe("Basement");
    expect(floorLabel("1")).toBe("1st floor");
    expect(floorLabel("3")).toBe("Floor 3");
  });
});
