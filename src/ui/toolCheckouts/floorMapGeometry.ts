// Coordinate helpers for the Leaflet floor map.
//
// Every location is stored as absolute, floor-relative percent (0-100 of the
// whole floor plan, y growing downward). Leaflet's "simple" CRS has y growing
// upward, so these helpers are the single place where a stored percent and a
// Leaflet position are converted -- nothing else in the map does coordinate
// math, which is what keeps clicks, shapes and markers lined up at any zoom.

export interface Point { x: number; y: number }
export interface Box { minX: number; maxX: number; minY: number; maxY: number }

// The floor plan is laid out in a fixed 1000-unit-wide space; its height
// follows the plan's own aspect ratio.
export const MAP_WIDTH = 1000;

export const FLOOR_NAMES = ["B", "1", "2"] as const;
export const FLOOR_LABELS: Record<string, string> = { B: "Basement", "1": "1st floor", "2": "2nd floor" };
export const floorLabel = (floor: string) => FLOOR_LABELS[floor] || `Floor ${floor}`;
export const sortFloors = (floors: string[]) =>
  [...floors].sort((a, b) => (FLOOR_NAMES as readonly string[]).indexOf(a) - (FLOOR_NAMES as readonly string[]).indexOf(b));

// Plan height in map units for a plan whose height/width ratio is `aspect`.
export const mapHeight = (aspect: number) => MAP_WIDTH * aspect;

export const pctToLatLng = (aspect: number, x: number, y: number): [number, number] =>
  [mapHeight(aspect) * (1 - y / 100), (MAP_WIDTH * x) / 100];

const clampPct = (value: number) => Math.min(100, Math.max(0, value));
// One decimal is plenty for a floor plan and keeps stored values tidy.
const roundPct = (value: number) => Math.round(clampPct(value) * 10) / 10;

export const latLngToPct = (aspect: number, lat: number, lng: number): Point => ({
  x: roundPct((lng / MAP_WIDTH) * 100),
  y: roundPct((1 - lat / mapHeight(aspect)) * 100),
});

// [[south, west], [north, east]] for a percent box.
export const boxToBounds = (aspect: number, box: Box): [[number, number], [number, number]] => [
  pctToLatLng(aspect, box.minX, box.maxY),
  pctToLatLng(aspect, box.maxX, box.minY),
];

export const FULL_FLOOR_BOX: Box = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

// Visual margin around a box when the map fits it -- context beyond the
// exact edge. Never changes how a stored coordinate is interpreted.
export const FIT_PADDING_PCT = 5;

export const paddedBox = (box: Box, pad = FIT_PADDING_PCT): Box => ({
  minX: Math.max(0, box.minX - pad),
  maxX: Math.min(100, box.maxX + pad),
  minY: Math.max(0, box.minY - pad),
  maxY: Math.min(100, box.maxY + pad),
});

// Widens a box around its centre so it spans at least `minSpan` percent on
// each axis (never past the plan's edge). Fitting a single pin, or one tiny
// cabinet, would otherwise zoom into blank floor with no walls for context.
export const withMinSpan = (box: Box, minSpan: number): Box => {
  const widen = (min: number, max: number): [number, number] => {
    if (max - min >= minSpan) return [min, max];
    const mid = (min + max) / 2;
    let lo = mid - minSpan / 2, hi = mid + minSpan / 2;
    if (lo < 0) { hi = Math.min(100, hi - lo); lo = 0; }
    if (hi > 100) { lo = Math.max(0, lo - (hi - 100)); hi = 100; }
    return [lo, hi];
  };
  const [minX, maxX] = widen(box.minX, box.maxX);
  const [minY, maxY] = widen(box.minY, box.maxY);
  return { minX, maxX, minY, maxY };
};

// A shape needs at least this many corners to be a shape.
export const MIN_SHAPE_POINTS = 3;

// Adds a corner to an outline. Edge `edgeIndex` runs from corner `edgeIndex`
// to the next one (the last edge wraps back to the first), and the new corner
// goes between them. Returns a new array.
export const insertPoint = (points: Point[], edgeIndex: number, point: Point): Point[] => {
  if (edgeIndex < 0 || edgeIndex >= points.length) return points;
  return [...points.slice(0, edgeIndex + 1), point, ...points.slice(edgeIndex + 1)];
};

// Removes a corner, unless that would leave fewer than MIN_SHAPE_POINTS (the
// same array comes back, so the caller can tell nothing changed).
export const removePoint = (points: Point[], index: number): Point[] => {
  if (index < 0 || index >= points.length || points.length <= MIN_SHAPE_POINTS) return points;
  return points.filter((_, i) => i !== index);
};

export const centroid = (points: Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

// Reads width/height from an SVG document's viewBox (falling back to its
// width/height attributes) and returns height/width.
export const aspectFromSvgText = (svg: string): number | null => {
  const viewBox = svg.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return viewBox[3] / viewBox[2];
  const width = parseFloat(svg.match(/<svg[^>]*\swidth\s*=\s*"([\d.]+)/i)?.[1] || "");
  const height = parseFloat(svg.match(/<svg[^>]*\sheight\s*=\s*"([\d.]+)/i)?.[1] || "");
  return width > 0 && height > 0 ? height / width : null;
};
