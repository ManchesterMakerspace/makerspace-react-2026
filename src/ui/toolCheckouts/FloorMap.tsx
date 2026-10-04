import * as React from "react";
import * as L from "leaflet";
import leafletCss from "leaflet/dist/leaflet.css";

import {
  Box, Point, boxToBounds, latLngToPct, mapHeight, pctToLatLng, aspectFromSvgText, MAP_WIDTH,
} from "./floorMapGeometry";
import { markerHtml, MARKER_SIZE } from "./markerIcons";

// One SVG per building floor, shared by every shop on that floor.
export const floorPlanUrl = (floorName: string) => `/assets/shopFloorPlans/floor-${floorName}.svg`;
const floorPlanFallbackUrl = "/assets/shopFloorPlans/placeholder.svg";

interface FloorPlan { url: string; aspect: number }
const planCache = new Map<string, Promise<FloorPlan>>();

// Reads the plan's own viewBox so the map is laid out at its true aspect
// ratio; falls back to the placeholder plan, then to a square.
const loadFloorPlan = (floorName: string): Promise<FloorPlan> => {
  let pending = planCache.get(floorName);
  if (!pending) {
    pending = (async () => {
      for (const url of [floorPlanUrl(floorName), floorPlanFallbackUrl]) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          const aspect = aspectFromSvgText(await response.text());
          if (aspect) return { url, aspect };
        } catch { /* try the next candidate */ }
      }
      return { url: floorPlanFallbackUrl, aspect: 1 };
    })();
    planCache.set(floorName, pending);
  }
  return pending;
};

export interface MapShape {
  id: string;
  points: Point[];
  color: string;
  opacity?: number;
  label?: string;
  // Outline only (no fill) -- a frame with nothing inside it to click.
  outline?: boolean;
  // The shape currently chosen for editing: drawn with a heavier edge.
  selected?: boolean;
  onClick?: () => void;
}

export interface MapMarker {
  id: string;
  x: number;
  y: number;
  color: string;
  icon?: string;
  label?: string;
  highlighted?: boolean;
  selected?: boolean;
  // Only the selected marker is draggable, so a stray drag can't move
  // something you did not pick first.
  draggable?: boolean;
  onDragEnd?: (point: Point) => void;
  onClick?: () => void;
}

interface FloorMapProps {
  floorName: string;
  // Percent box to bring into view. The view refits only when `fitKey`
  // changes, so panning/zooming by hand is never undone by a data refresh.
  fitBox: Box;
  fitKey: string;
  shapes: MapShape[];
  markers: MapMarker[];
  // In-progress outline while drawing a new area.
  draftPoints?: Point[];
  // Draggable corners while adjusting an existing shape.
  adjustPoints?: Point[];
  // Identifies which shape the corner handles belong to. Handles are rebuilt
  // only when this changes -- rebuilding while one is being dragged would
  // destroy the very handle in your hand.
  adjustKey?: string;
  // Called continuously while a corner is dragged (final = false) and once
  // when it is released (final = true).
  onAdjustPoint?: (index: number, point: Point, final: boolean) => void;
  // A small dot sits at the middle of every edge. Dragging one pulls a new
  // corner out of that edge: `edgeIndex` is the corner the edge starts from,
  // so the new corner goes right after it. Reported while dragging (final =
  // false) and once on release (final = true).
  onInsertPoint?: (edgeIndex: number, point: Point, final: boolean) => void;
  // Double-click (or right-click / long-press) on a corner removes it.
  onRemovePoint?: (index: number) => void;
  onMapClick?: (point: Point) => void;
  height?: number;
  // Accessible name for the map region.
  label?: string;
  // Crosshair cursor, for when a click will place something. Defaults to
  // whether the map takes clicks at all.
  crosshair?: boolean;
}

const STYLE_ID = "floor-map-styles";
const OWN_CSS = `
.floor-map .floor-map-marker { width: ${MARKER_SIZE}px; height: ${MARKER_SIZE}px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.floor-map .floor-map-ring { position: absolute; left: -14px; top: -14px; width: ${MARKER_SIZE + 28}px; height: ${MARKER_SIZE + 28}px; border-radius: 50%; border: 4px solid #d32f2f; box-shadow: 0 0 0 3px rgba(255, 255, 255, .95), 0 0 14px 5px rgba(211, 47, 47, .5); box-sizing: border-box; pointer-events: none; animation: floor-map-pulse 1.4s ease-in-out infinite; }
.floor-map .floor-map-ring-selected { border-width: 3px; border-color: #1976d2; box-shadow: 0 0 0 2px rgba(255, 255, 255, .95); animation: none; }
.floor-map .floor-map-handle { width: 16px; height: 16px; border-radius: 50%; background: #d32f2f; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.3); box-sizing: border-box; cursor: grab; }
.floor-map .floor-map-midpoint { width: 12px; height: 12px; border-radius: 50%; background: rgba(255, 255, 255, .92); border: 2px solid #d32f2f; box-shadow: 0 0 0 1px rgba(0,0,0,.2); box-sizing: border-box; opacity: .8; cursor: copy; }
.floor-map .floor-map-midpoint:hover { opacity: 1; transform: scale(1.25); }
@media (pointer: coarse) { .floor-map .floor-map-handle { width: 26px; height: 26px; } .floor-map .floor-map-midpoint { width: 22px; height: 22px; } }
.floor-map .floor-map-clickable { cursor: pointer; }
.floor-map.leaflet-container { background: #fff; font: inherit; }
@keyframes floor-map-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .floor-map .floor-map-ring { animation: none; } }
.floor-map .leaflet-marker-icon:focus-visible { outline: 3px solid #1976d2; outline-offset: 2px; border-radius: 50%; }
`;

// Leaflet's own stylesheet is bundled as a plain string (see the css rule in
// the webpack configs) and injected once, rather than going through Rails'
// stylesheet pipeline.
const ensureStyles = () => {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `${leafletCss}\n${OWN_CSS}`;
  document.head.appendChild(style);
};

const FloorMap: React.FC<FloorMapProps> = ({
  floorName, fitBox, fitKey, shapes, markers, draftPoints, adjustPoints, adjustKey, onAdjustPoint, onInsertPoint,
  onRemovePoint, onMapClick, height = 420, label = "Floor map", crosshair,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const overlayRef = React.useRef<L.ImageOverlay | null>(null);
  const shapeLayerRef = React.useRef<L.LayerGroup | null>(null);
  const markerLayerRef = React.useRef<L.LayerGroup | null>(null);
  const draftLayerRef = React.useRef<L.LayerGroup | null>(null);
  const adjustLayerRef = React.useRef<L.LayerGroup | null>(null);
  const [aspect, setAspect] = React.useState<number | null>(null);

  // Latest callbacks, so the map's own listeners never go stale.
  const onMapClickRef = React.useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onAdjustPointRef = React.useRef(onAdjustPoint);
  onAdjustPointRef.current = onAdjustPoint;
  const onInsertPointRef = React.useRef(onInsertPoint);
  onInsertPointRef.current = onInsertPoint;
  const onRemovePointRef = React.useRef(onRemovePoint);
  onRemovePointRef.current = onRemovePoint;
  const aspectRef = React.useRef<number | null>(null);
  aspectRef.current = aspect;
  const adjustPointsRef = React.useRef(adjustPoints);
  adjustPointsRef.current = adjustPoints;
  const fitBoxRef = React.useRef(fitBox);
  fitBoxRef.current = fitBox;

  React.useEffect(() => {
    ensureStyles();
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      crs: L.CRS.Simple,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: -4,
      maxZoom: 4,
      attributionControl: false,
      // The page scrolls past the map; zoom with the buttons, pinch or
      // double-click instead of capturing the wheel.
      scrollWheelZoom: false,
    });
    mapRef.current = map;
    shapeLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    adjustLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      const a = aspectRef.current;
      if (a == null) return;
      onMapClickRef.current?.(latLngToPct(a, event.latlng.lat, event.latlng.lng));
    });
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize())
      : null;
    observer?.observe(container);
    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Swap the floor plan when the floor changes.
  React.useEffect(() => {
    let cancelled = false;
    setAspect(null);
    loadFloorPlan(floorName).then(plan => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      overlayRef.current?.remove();
      const bounds = L.latLngBounds([0, 0], [mapHeight(plan.aspect), MAP_WIDTH]);
      overlayRef.current = L.imageOverlay(plan.url, bounds, { interactive: false }).addTo(map);
      overlayRef.current.bringToBack();
      map.setMaxBounds(bounds.pad(0.5));
      setAspect(plan.aspect);
    });
    return () => { cancelled = true; };
  }, [floorName]);

  // Fit when the plan finishes loading and whenever the caller asks.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || aspect == null) return;
    map.invalidateSize();
    map.fitBounds(boxToBounds(aspect, fitBoxRef.current), { animate: false });
  }, [aspect, fitKey]);

  React.useEffect(() => {
    const layer = shapeLayerRef.current;
    if (!layer || aspect == null) return;
    layer.clearLayers();
    shapes.forEach(shape => {
      if (shape.points.length < 3) return;
      const polygon = L.polygon(shape.points.map(p => pctToLatLng(aspect, p.x, p.y)), {
        color: shape.color,
        weight: shape.selected ? 3 : shape.outline ? 2 : 1,
        dashArray: shape.outline ? "6 4" : undefined,
        fill: !shape.outline,
        fillColor: shape.color,
        fillOpacity: shape.opacity ?? 0.3,
        // A shape that is only hoverable (name tooltip) must let clicks reach
        // the map, otherwise you cannot draw or drop a pin on top of an
        // existing area -- e.g. a cabinet inside a room. Only a shape with
        // its own click action keeps the click for itself.
        bubblingMouseEvents: !shape.onClick,
        interactive: !!shape.onClick || !!shape.label,
        className: shape.onClick ? "floor-map-clickable" : undefined,
      });
      if (shape.label) polygon.bindTooltip(shape.label, { sticky: true });
      if (shape.onClick) {
        const handler = shape.onClick;
        polygon.on("click", () => handler());
      }
      layer.addLayer(polygon);
    });
  }, [shapes, aspect]);

  React.useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer || aspect == null) return;
    layer.clearLayers();
    markers.forEach(item => {
      const marker = L.marker(pctToLatLng(aspect, item.x, item.y), {
        icon: L.divIcon({
          className: "",
          html: markerHtml(item.icon, item.color, item.highlighted, item.selected),
          iconSize: [MARKER_SIZE, MARKER_SIZE],
          iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
        }),
        interactive: !!item.onClick || !!item.label,
        // Interactive markers are reachable and activatable from the
        // keyboard (Enter), and carry the name as their accessible label --
        // the colored glyph alone is never the only label.
        keyboard: !!item.onClick,
        title: item.label,
        alt: item.label || "Map marker",
        bubblingMouseEvents: false,
        zIndexOffset: item.highlighted || item.selected ? 1000 : 0,
        draggable: !!item.draggable,
      });
      if (item.draggable && item.onDragEnd) {
        const done = item.onDragEnd;
        marker.on("dragend", () => {
          const at = marker.getLatLng();
          done(latLngToPct(aspect, at.lat, at.lng));
        });
      }
      // The tool being looked for keeps its name showing, so it is obvious
      // which ringed marker is the one.
      if (item.label) {
        marker.bindTooltip(item.label, { direction: "top", offset: [0, -MARKER_SIZE / 2 - 8], permanent: !!item.highlighted });
      }
      if (item.onClick) {
        const handler = item.onClick;
        marker.on("click", () => handler());
      }
      layer.addLayer(marker);
    });
  }, [markers, aspect]);

  React.useEffect(() => {
    const layer = draftLayerRef.current;
    if (!layer || aspect == null) return;
    layer.clearLayers();
    if (!draftPoints?.length) return;
    const latLngs = draftPoints.map(p => pctToLatLng(aspect, p.x, p.y));
    if (latLngs.length > 1) layer.addLayer(L.polyline(latLngs, { color: "#d32f2f", weight: 2, interactive: false }));
    if (latLngs.length >= 3) {
      layer.addLayer(L.polyline([latLngs[latLngs.length - 1], latLngs[0]], {
        color: "#d32f2f", weight: 2, dashArray: "6 4", interactive: false,
      }));
    }
    latLngs.forEach(latLng => layer.addLayer(L.circleMarker(latLng, {
      radius: 5, color: "#fff", weight: 1, fillColor: "#d32f2f", fillOpacity: 1, interactive: false,
    })));
  }, [draftPoints, aspect]);

  // Draggable corner handles. The shape preview is drawn by the parent
  // (through `shapes`) so it follows the same code path as any other shape.
  React.useEffect(() => {
    const layer = adjustLayerRef.current;
    if (!layer || aspect == null) return;
    layer.clearLayers();
    const points = adjustPointsRef.current;
    if (!adjustKey || !points?.length) return;

    // Edge midpoints first, so a corner handle sits on top wherever the two
    // overlap (a very short edge). Dragging one adds a corner to that edge.
    if (points.length >= 3) {
      points.forEach((point, edgeIndex) => {
        const next = points[(edgeIndex + 1) % points.length];
        const dot = L.marker(pctToLatLng(aspect, (point.x + next.x) / 2, (point.y + next.y) / 2), {
          draggable: true,
          icon: L.divIcon({ className: "", html: '<div class="floor-map-midpoint" title="Drag to add a corner"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }),
          bubblingMouseEvents: false,
          keyboard: false,
        });
        const reportInsert = (final: boolean) => () => {
          const latLng = dot.getLatLng();
          onInsertPointRef.current?.(edgeIndex, latLngToPct(aspect, latLng.lat, latLng.lng), final);
        };
        dot.on("drag", reportInsert(false));
        dot.on("dragend", reportInsert(true));
        // Leaflet only treats a marker as the target of a click if it listens for
        // one; without this a click on the dot falls through to the map, which
        // would deselect the shape.
        dot.on("click", () => undefined);
        layer.addLayer(dot);
      });
    }

    points.forEach((point, index) => {
      const handle = L.marker(pctToLatLng(aspect, point.x, point.y), {
        draggable: true,
        icon: L.divIcon({ className: "", html: '<div class="floor-map-handle" title="Drag to move; double-click to remove"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        bubblingMouseEvents: false,
        keyboard: false,
      });
      const report = (final: boolean) => () => {
        const latLng = handle.getLatLng();
        onAdjustPointRef.current?.(index, latLngToPct(aspect, latLng.lat, latLng.lng), final);
      };
      handle.on("drag", report(false));
      handle.on("dragend", report(true));
      // Double-click (or right-click / long-press) removes the corner. The
      // map's own double-click zoom and context menu are kept out of it.
      const remove = (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event.originalEvent);
        onRemovePointRef.current?.(index);
      };
      handle.on("dblclick", remove);
      handle.on("contextmenu", remove);
      // As on the edge dots: claim the click, so it never reaches the map.
      handle.on("click", () => undefined);
      layer.addLayer(handle);
    });
  }, [adjustKey, aspect]);

  return (
    <div
      ref={containerRef}
      className="floor-map"
      role="region"
      aria-label={label}
      style={{
        // A map needs a definite height; it shrinks on narrow screens
        // instead of overflowing, and the width follows its container.
        height: `min(${height}px, 90vw)`, minHeight: 240, width: "100%", maxWidth: 720,
        border: "1px solid rgba(0, 0, 0, 0.26)", cursor: (crosshair ?? !!onMapClick) ? "crosshair" : undefined,
      }}
    />
  );
};

export default FloorMap;
