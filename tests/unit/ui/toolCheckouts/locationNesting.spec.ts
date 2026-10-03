import { Location } from "app/entities/toolCheckout";
import {
  pointInPolygon, polygonArea, descendantIds, containingParentId, shapeAnchor,
} from "ui/toolCheckouts/locationNesting";

const square = (x: number, y: number, size: number) => [
  { x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size },
];
const area = (id: string, points: { x: number; y: number }[], parentId?: string): Location =>
  ({ id, name: id, shopId: "s", shapePoints: points, parentId } as Location);
const pin = (id: string, parentId?: string): Location => ({ id, name: id, shopId: "s", xPct: 1, yPct: 1, parentId } as Location);

describe("locationNesting", () => {
  it("tests whether a point is inside a polygon", () => {
    const poly = square(10, 10, 20);
    expect(pointInPolygon({ x: 20, y: 20 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 20 }, poly)).toBe(false);
    expect(pointInPolygon({ x: 20, y: 35 }, poly)).toBe(false);
    // a concave L shape: the notch is outside
    const ell = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 20 }, { x: 0, y: 20 }];
    expect(pointInPolygon({ x: 5, y: 15 }, ell)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 15 }, ell)).toBe(false);
  });

  it("computes area regardless of winding", () => {
    expect(polygonArea(square(0, 0, 10))).toBe(100);
    expect(polygonArea([...square(0, 0, 10)].reverse())).toBe(100);
  });

  it("nests in the smallest containing area, not the first or the biggest", () => {
    const room = area("room", square(0, 0, 80));
    const bench = area("bench", square(10, 10, 20), "room");
    const drawer = area("drawer", square(12, 12, 5), "bench");
    const locations = [room, bench, drawer];
    expect(containingParentId({ x: 14, y: 14 }, locations)).toBe("drawer");
    expect(containingParentId({ x: 25, y: 25 }, locations)).toBe("bench");
    expect(containingParentId({ x: 60, y: 60 }, locations)).toBe("room");
    expect(containingParentId({ x: 95, y: 95 }, locations)).toBeUndefined();
  });

  it("ignores pins, and anything in the exclusion set", () => {
    const room = area("room", square(0, 0, 80));
    const bench = area("bench", square(10, 10, 20), "room");
    expect(containingParentId({ x: 20, y: 20 }, [room, pin("p"), bench], new Set(["bench"]))).toBe("room");
  });

  it("finds every descendant at any depth", () => {
    const tree = [area("a", square(0, 0, 50)), area("b", square(1, 1, 10), "a"), pin("c", "b"), pin("other")];
    expect(Array.from(descendantIds("a", tree)).sort()).toEqual(["b", "c"]);
    expect(descendantIds("other", tree).size).toBe(0);
  });

  it("anchors a drawn area at its centre", () => {
    expect(shapeAnchor(square(0, 0, 10))).toEqual({ x: 5, y: 5 });
  });
});
