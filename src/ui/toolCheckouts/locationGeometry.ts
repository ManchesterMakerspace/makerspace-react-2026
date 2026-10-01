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

export const paddedBox = (box: Box): Box => ({
  minX: Math.max(0, box.minX - ZOOM_PADDING_PCT),
  maxX: Math.min(100, box.maxX + ZOOM_PADDING_PCT),
  minY: Math.max(0, box.minY - ZOOM_PADDING_PCT),
  maxY: Math.min(100, box.maxY + ZOOM_PADDING_PCT),
});
const padded = paddedBox;

// An SVG viewBox, in the SVG's own user-unit coordinate system (not
// percent).
export interface ViewBox { x: number; y: number; width: number; height: number; }

// Maps a percent-space Box onto a real SVG viewBox's coordinate system --
// shared by the admin editor's zoomed canvas (ShopMapManager, which crops
// down through a stack of nested locations one level at a time) and the
// Workshops-page single-shop map (ShopLocationMap, which crops once to a
// shop's own top-level bounding box), so both derive a crop from the same
// formula instead of maintaining separate copies of this arithmetic.
export const cropViewBoxToBox = (original: ViewBox, box: Box): ViewBox => ({
  x: original.x + (box.minX / 100) * original.width,
  y: original.y + (box.minY / 100) * original.height,
  width: ((box.maxX - box.minX) / 100) * original.width,
  height: ((box.maxY - box.minY) / 100) * original.height,
});

// Maps a point given in percent-of-`container` into whatever absolute frame
// `container` is itself already expressed in -- floor-relative percent, as
// long as `container` itself ultimately resolves back to FULL_FLOOR_BOX.
export const composePoint = (container: Box, x: number, y: number) => ({
  x: container.minX + (x / 100) * (container.maxX - container.minX),
  y: container.minY + (y / 100) * (container.maxY - container.minY),
});

// Resolves a location's own floor-relative bounding box, composing through
// every ancestor's own TRUE (unpadded) box. Padding is a purely visual
// crop margin (see paddedBox) -- it must never leak into how a child's
// stored percent is interpreted, or nesting several levels deep compounds
// the margin at every level (a small cabinet's padding can be ~30% of its
// own size), pushing deeply-nested items outside their real ancestor's
// boundary. `ShopMapManager`'s click-to-percent math applies the matching
// inverse remap (see `wrapperPctToLocalPct`) so a point is captured and
// interpreted against the same unpadded frame.
export const resolveAbsoluteBox = (loc: Location, byId: Map<string, Location>): Box => {
  const parent = loc.parentId ? byId.get(loc.parentId) : undefined;
  const container = parent ? resolveAbsoluteBox(parent, byId) : FULL_FLOOR_BOX;
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
  const container = parent ? resolveAbsoluteBox(parent, byId) : FULL_FLOOR_BOX;
  return composePoint(container, x, y);
};

// Inverse of the visual padding applied to a zoomed-in crop: converts a raw
// click/drag percent (0-100 across the currently-*displayed*, padded crop)
// into percent-of-the-true-unpadded-parent-box, which is the frame every
// stored xPct/yPct/shapePoints value is defined in. Without this, a point
// captured by clicking within the padded margin would be stored as if that
// margin were part of the parent's own box, and `resolveAbsoluteBox` above
// (which composes through unpadded boxes only) would then place it wrong.
// No-op (identity) when there's no parent, matching top-level placement,
// which has always been plain percent-of-the-whole-floor with no padding.
export const wrapperPctToLocalPct = (rawPct: number, min: number, max: number): number => {
  const paddedMin = Math.max(0, min - ZOOM_PADDING_PCT);
  const paddedMax = Math.min(100, max + ZOOM_PADDING_PCT);
  const displayedValue = paddedMin + (rawPct / 100) * (paddedMax - paddedMin);
  return ((displayedValue - min) / (max - min)) * 100;
};
