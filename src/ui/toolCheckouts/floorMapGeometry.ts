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
