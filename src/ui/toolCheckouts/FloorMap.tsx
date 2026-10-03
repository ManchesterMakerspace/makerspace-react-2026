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
  // Outline only (no fill) -- the frame around the area you zoomed into.
  outline?: boolean;
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
  onAdjustPoint?: (index: number, point: Point) => void;
  onMapClick?: (point: Point) => void;
  height?: number;
  // Accessible name for the map region.
  label?: string;
}

const STYLE_ID = "floor-map-styles";
const OWN_CSS = `
.floor-map .floor-map-marker { width: ${MARKER_SIZE}px; height: ${MARKER_SIZE}px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.floor-map .floor-map-ring { position: absolute; left: -9px; top: -9px; width: ${MARKER_SIZE + 18}px; height: ${MARKER_SIZE + 18}px; border-radius: 50%; border: 3px solid #d32f2f; box-sizing: border-box; pointer-events: none; animation: floor-map-pulse 1.4s ease-in-out infinite; }
.floor-map .floor-map-handle { width: 16px; height: 16px; border-radius: 50%; background: #d32f2f; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.3); box-sizing: border-box; cursor: grab; }
.floor-map .floor-map-clickable { cursor: pointer; }
.floor-map .leaflet-container { background: #fff; font: inherit; }
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
  floorName, fitBox, fitKey, shapes, markers, draftPoints, adjustPoints, onAdjustPoint, onMapClick, height = 420,
  label = "Floor map",
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
  const aspectRef = React.useRef<number | null>(null);
  aspectRef.current = aspect;
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
        weight: shape.outline ? 2 : 1,
        dashArray: shape.outline ? "6 4" : undefined,
        fill: !shape.outline,
        fillColor: shape.color,
        fillOpacity: shape.opacity ?? 0.3,
        bubblingMouseEvents: false,
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
          html: markerHtml(item.icon, item.color, item.highlighted),
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
        zIndexOffset: item.highlighted ? 1000 : 0,
      });
      if (item.label) marker.bindTooltip(item.label, { direction: "top", offset: [0, -MARKER_SIZE / 2] });
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
    if (!adjustPoints?.length) return;
    adjustPoints.forEach((point, index) => {
      const handle = L.marker(pctToLatLng(aspect, point.x, point.y), {
        draggable: true,
        icon: L.divIcon({ className: "", html: '<div class="floor-map-handle"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        bubblingMouseEvents: false,
        keyboard: false,
      });
      handle.on("dragend", () => {
        const latLng = handle.getLatLng();
        onAdjustPointRef.current?.(index, latLngToPct(aspect, latLng.lat, latLng.lng));
      });
      layer.addLayer(handle);
    });
    // Rebuilding on every drag would fight the drag itself, so only the
    // number of corners and the plan trigger a rebuild; positions are read
    // from adjustPoints at that moment.
  }, [adjustPoints?.length, adjustPoints?.[0]?.x, adjustPoints?.[0]?.y, aspect]);

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
        border: "1px solid rgba(0, 0, 0, 0.26)", cursor: onMapClick ? "crosshair" : undefined,
      }}
    />
  );
};

export default FloorMap;
