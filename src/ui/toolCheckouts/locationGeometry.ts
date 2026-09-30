import { Location } from "app/entities/toolCheckout";

export interface Box { minX: number; maxX: number; minY: number; maxY: number; }

export const FULL_FLOOR_BOX: Box = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

// A location's own footprint, in whatever percent-space it was placed in
// (percent of its immediate parent's box -- the floor, if top-level, or the
// parent location's own resolved box once nested). A pin gets a small
// fixed-size box around its point since it has no extent of its own.
export const boundingBoxOf = (loc: Location): Box => {
  if (loc.shapePoints?.length) {
    const xs = loc.shapePoints.map(p => p.x), ys = loc.shapePoints.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  const x = loc.xPct ?? 50, y = loc.yPct ?? 50;
  return { minX: x - 5, maxX: x + 5, minY: y - 5, maxY: y + 5 };
};

export const ZOOM_PADDING_PCT = 5;

const padded = (box: Box): Box => ({
  minX: Math.max(0, box.minX - ZOOM_PADDING_PCT),
  maxX: Math.min(100, box.maxX + ZOOM_PADDING_PCT),
  minY: Math.max(0, box.minY - ZOOM_PADDING_PCT),
  maxY: Math.min(100, box.maxY + ZOOM_PADDING_PCT),
});

// Maps a point given in percent-of-`container` into whatever absolute frame
// `container` is itself already expressed in -- floor-relative percent, as
// long as `container` itself ultimately resolves back to FULL_FLOOR_BOX.
export const composePoint = (container: Box, x: number, y: number) => ({
  x: container.minX + (x / 100) * (container.maxX - container.minX),
  y: container.minY + (y / 100) * (container.maxY - container.minY),
});

// Resolves a location's own floor-relative bounding box, composing through
// every ancestor's own (padded) box -- mirrors exactly how the admin
// editor's zoomed canvas crops the viewBox one level at a time, so a
// location drawn while zoomed two levels deep resolves back to the same
// floor position wherever else it's displayed (e.g. the read-only
// Workshops-page map, which never zooms interactively itself).
export const resolveAbsoluteBox = (loc: Location, byId: Map<string, Location>): Box => {
  const parent = loc.parentId ? byId.get(loc.parentId) : undefined;
  const container = parent ? padded(resolveAbsoluteBox(parent, byId)) : FULL_FLOOR_BOX;
  const local = boundingBoxOf(loc);
  const topLeft = composePoint(container, local.minX, local.minY);
  const bottomRight = composePoint(container, local.maxX, local.maxY);
  return { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y };
};

// Resolves an arbitrary point stored in percent-of-its-parent (a location's
// own shapePoints vertex, or its pin xPct/yPct) into floor-relative percent.
export const resolveAbsolutePoint = (
  parentId: string | undefined, x: number, y: number, byId: Map<string, Location>
) => {
  const parent = parentId ? byId.get(parentId) : undefined;
  const container = parent ? padded(resolveAbsoluteBox(parent, byId)) : FULL_FLOOR_BOX;
  return composePoint(container, x, y);
};
