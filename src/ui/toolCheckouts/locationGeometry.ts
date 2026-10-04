import { Location } from "app/entities/toolCheckout";
import { Box } from "./floorMapGeometry";

// Every location's own xPct/yPct/shapePoints are stored in absolute,
// floor-relative percent (0-100 of the whole floor plan) regardless of how
// deeply it's nested under other locations -- parentId is purely tree
// structure (the hierarchy list, zoom breadcrumbs), never geometry. All
// conversion between those percents and positions on screen lives in
// floorMapGeometry.ts.
export const boundingBoxOf = (loc: Location): Box => {
  if (loc.shapePoints?.length) {
    const xs = loc.shapePoints.map(p => p.x), ys = loc.shapePoints.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  const x = loc.xPct ?? 50, y = loc.yPct ?? 50;
  return { minX: x - 5, maxX: x + 5, minY: y - 5, maxY: y + 5 };
};
