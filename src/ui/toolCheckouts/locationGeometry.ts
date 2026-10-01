import { Location } from "app/entities/toolCheckout";

export interface Box { minX: number; maxX: number; minY: number; maxY: number; }

export const FULL_FLOOR_BOX: Box = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

// Every location's own xPct/yPct/shapePoints are stored in absolute,
// floor-relative percent (0-100 of the whole floor plan) regardless of how
// deeply it's nested under other locations -- parentId is purely tree
// structure (the hierarchy list, zoom breadcrumbs), never geometry. A
// location's stored position means the same thing everywhere it's read, by
// construction, with no recursive composition through ancestors required to
// find out where it "really" is -- and nothing for a future crop/padding
// tweak to silently reinterpret (the previous percent-of-parent scheme
// broke exactly this way: a formula change for new placements quietly
// changed what every already-stored point meant).
export const boundingBoxOf = (loc: Location): Box => {
  if (loc.shapePoints?.length) {
    const xs = loc.shapePoints.map(p => p.x), ys = loc.shapePoints.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  const x = loc.xPct ?? 50, y = loc.yPct ?? 50;
  return { minX: x - 5, maxX: x + 5, minY: y - 5, maxY: y + 5 };
};

// Visual-only margin around a bounding box when it's used as a zoom crop --
// gives a little breathing room/context beyond the exact shape's edges.
// Never affects how a stored coordinate is interpreted (see above).
export const ZOOM_PADDING_PCT = 5;

export const paddedBox = (box: Box): Box => ({
  minX: Math.max(0, box.minX - ZOOM_PADDING_PCT),
  maxX: Math.min(100, box.maxX + ZOOM_PADDING_PCT),
  minY: Math.max(0, box.minY - ZOOM_PADDING_PCT),
  maxY: Math.min(100, box.maxY + ZOOM_PADDING_PCT),
});

// An SVG viewBox, in the SVG's own user-unit coordinate system (not
// percent).
export interface ViewBox { x: number; y: number; width: number; height: number; }

// Maps a percent-space Box onto a real SVG viewBox's coordinate system.
export const cropViewBoxToBox = (original: ViewBox, box: Box): ViewBox => ({
  x: original.x + (box.minX / 100) * original.width,
  y: original.y + (box.minY / 100) * original.height,
  width: ((box.maxX - box.minX) / 100) * original.width,
  height: ((box.maxY - box.minY) / 100) * original.height,
});

// Converts a point given as percent-of-`box` into absolute floor-relative
// percent -- used to turn a raw click (percent of whatever crop is
// currently displayed) into the absolute coordinate that actually gets
// saved.
export const composePoint = (box: Box, x: number, y: number) => ({
  x: box.minX + (x / 100) * (box.maxX - box.minX),
  y: box.minY + (y / 100) * (box.maxY - box.minY),
});

// Inverse of composePoint: converts an absolute floor-relative point into
// percent-of-`box` -- used to render a location's stored absolute position
// as a clip-path/left/top percentage against whatever crop is currently
// displayed (the whole shop's extent, or a further zoom into one location
// within it).
export const remapToBox = (box: Box, x: number, y: number) => ({
  x: ((x - box.minX) / (box.maxX - box.minX)) * 100,
  y: ((y - box.minY) / (box.maxY - box.minY)) * 100,
});
