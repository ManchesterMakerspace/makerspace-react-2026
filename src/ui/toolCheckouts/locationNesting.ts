import { Location } from "app/entities/toolCheckout";
import { Point, centroid } from "./floorMapGeometry";

// Ray-casting point-in-polygon test (even-odd rule).
export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
};

export const polygonArea = (polygon: Point[]): number => {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return Math.abs(sum) / 2;
};

// Every location nested under `locationId`, at any depth.
export const descendantIds = (locationId: string, locations: Location[]): Set<string> => {
  const found = new Set<string>();
  const walk = (id: string) => {
    locations.forEach(l => {
      if (l.parentId === id && !found.has(l.id)) { found.add(l.id); walk(l.id); }
    });
  };
  walk(locationId);
  return found;
};

// The smallest drawn area that contains the point -- what a new marker or
// area dropped there is nested inside. Only areas (shapes) can contain
// things. `exclude` keeps a location from being nested in itself or in
// anything already inside it.
export const containingParentId = (
  point: Point, locations: Location[], exclude: Set<string> = new Set()
): string | undefined => {
  let best: { id: string; area: number } | undefined;
  locations.forEach(l => {
    if (exclude.has(l.id) || !l.shapePoints || l.shapePoints.length < 3) return;
    if (!pointInPolygon(point, l.shapePoints)) return;
    const area = polygonArea(l.shapePoints);
    if (!best || area < best.area) best = { id: l.id, area };
  });
  return best?.id;
};

// Where a drawn area "is" for nesting purposes: its centre. An area drawn
// inside a room belongs to that room even if a corner pokes out.
export const shapeAnchor = (points: Point[]): Point => centroid(points);
