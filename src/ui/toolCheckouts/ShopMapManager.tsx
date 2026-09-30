import * as React from "react";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { Location, Shop } from "app/entities/toolCheckout";
import { adminListLocations, adminCreateLocation, adminUpdateLocation, adminDeleteLocation } from "api/locations";
import { listGoogleCalendarColors } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";

// One SVG per building floor, shared by every shop on that floor (a real
// floor plan covers multiple rooms/shops at once, not one shop in
// isolation) -- falls back to a generic placeholder for a floor that
// doesn't have its own file yet. Swapping in a real per-floor SVG later is
// only ever adding a file at this same predictable path, no code change.
const floorPlanUrl = (floorName: string) => `/assets/shopFloorPlans/floor-${floorName}.svg`;
const floorPlanFallbackUrl = "/assets/shopFloorPlans/placeholder.svg";

interface PendingPlacement {
  svgElementId?: string;
  xPct?: number;
  yPct?: number;
  shapePoints?: { x: number; y: number }[];
}

interface ViewBox { x: number; y: number; width: number; height: number; }

// A location's own footprint, in whatever percent-space it was drawn in
// (percent of its immediate parent's box -- the floor, if top-level, or the
// parent location's own crop once nested). A pin gets a small fixed-size box
// around its point since it has no extent of its own.
const boundingBoxOf = (loc: Location) => {
  if (loc.shapePoints?.length) {
    const xs = loc.shapePoints.map(p => p.x), ys = loc.shapePoints.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  const x = loc.xPct ?? 50, y = loc.yPct ?? 50;
  return { minX: x - 5, maxX: x + 5, minY: y - 5, maxY: y + 5 };
};

const ZOOM_PADDING_PCT = 5;

// Composes each zoomed-into location's own bounding box (in percent of
// *its* parent) down onto the SVG's true original viewBox, one level at a
// time -- since every level's stored percentages are already relative to
// its immediate parent's box, this is a plain nested crop, not a coordinate
// transform.
const cropViewBox = (original: ViewBox, stack: Location[]): ViewBox =>
  stack.reduce((current, loc) => {
    const box = boundingBoxOf(loc);
    const minX = Math.max(0, box.minX - ZOOM_PADDING_PCT), maxX = Math.min(100, box.maxX + ZOOM_PADDING_PCT);
    const minY = Math.max(0, box.minY - ZOOM_PADDING_PCT), maxY = Math.min(100, box.maxY + ZOOM_PADDING_PCT);
    return {
      x: current.x + (minX / 100) * current.width,
      y: current.y + (minY / 100) * current.height,
      width: ((maxX - minX) / 100) * current.width,
      height: ((maxY - minY) / 100) * current.height,
    };
  }, original);

const LocationFormModal: React.FC<{
  initialName: string;
  shops?: Shop[];
  initialShopId?: string;
  onClose: () => void;
  onSave: (name: string, shopId?: string) => void;
  onDelete?: () => void;
  onRedraw?: () => void;
  onAdjustCorners?: () => void;
  onZoomIn?: () => void;
  loading: boolean;
  error: string;
}> = ({ initialName, shops, initialShopId, onClose, onSave, onDelete, onRedraw, onAdjustCorners, onZoomIn, loading, error }) => {
  const [name, setName] = React.useState(initialName);
  const [shopId, setShopId] = React.useState(initialShopId || "");
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, shops ? shopId : undefined);
  };
  return (
    <FormModal id="location-form" isOpen={true} title={initialName ? "Edit location" : "Name this location"}
      closeHandler={onClose} onSubmit={submit} submitText="Save" loading={loading} error={error}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth required label="Name" placeholder="e.g. Drill bit bin"
            value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Grid>
        {shops && (
          <Grid size={{ xs: 12 }}>
            <Select native fullWidth value={shopId} onChange={e => setShopId((e.target as HTMLSelectElement).value)}>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Grid>
        )}
        {onRedraw && (
          <Grid size={{ xs: 12 }}>
            <Button onClick={onRedraw}>Redraw / reposition</Button>
          </Grid>
        )}
        {onAdjustCorners && (
          <Grid size={{ xs: 12 }}>
            <Button onClick={onAdjustCorners}>Adjust corners</Button>
          </Grid>
        )}
        {onZoomIn && (
          <Grid size={{ xs: 12 }}>
            <Button onClick={onZoomIn}>Zoom in to place items here</Button>
          </Grid>
        )}
        {onDelete && (
          <Grid size={{ xs: 12 }}>
            <Button color="error" onClick={onDelete}>Delete this location</Button>
          </Grid>
        )}
      </Grid>
    </FormModal>
  );
};

const ShopMapManager: React.FC = () => {
  const { data: shops = [] } = useCheckoutCatalog("managedShops");
  const [shopId, setShopId] = React.useState("");
  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingPlacement | null>(null);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [drawPoints, setDrawPoints] = React.useState<{ x: number; y: number }[]>([]);
  const [redrawing, setRedrawing] = React.useState<{ id: string; isPin: boolean } | null>(null);
  // A shape whose individual corners are being dragged into place --
  // separate from `redrawing`, which discards the old points entirely and
  // starts a fresh click-to-place sequence. `points` is a working copy,
  // only committed to the server on Save.
  const [adjusting, setAdjusting] = React.useState<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const draggingIndexRef = React.useRef<number | null>(null);
  // Set right when a drag's mouseup fires, so the "click" event the browser
  // synthesizes immediately after doesn't also get treated as a new
  // pin/point placement by handleMapClick.
  const suppressNextClickRef = React.useRef(false);
  const [shopColors, setShopColors] = React.useState<Record<string, string>>({});
  // Each entry is a location the admin has "zoomed into" to place items
  // inside it (a cabinet, a shelf within that cabinet, ...); empty means
  // viewing the whole floor. The last entry is the current parent context.
  const [zoomStack, setZoomStack] = React.useState<Location[]>([]);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const originalViewBoxRef = React.useRef<ViewBox | null>(null);
  const currentParent = zoomStack[zoomStack.length - 1];

  const selectedShop = shops.find(s => s.id === shopId);
  const floorName = selectedShop?.floorName;
  // Every shop sharing this floor, not just the selected one -- so a newly
  // drawn shape can be checked against neighbors already placed there.
  const floorShopIds = shops.filter(s => s.floorName === floorName).map(s => s.id);

  React.useEffect(() => {
    let active = true;
    listGoogleCalendarColors().then(result => {
      if (!active) return;
      const list = result.data?.colors || FALLBACK_COLORS;
      setShopColors(Object.fromEntries(list.map(c => [c.id, c.backgroundColor])));
    });
    return () => { active = false; };
  }, []);

  const { data: allLocations = [], refresh, error: loadError } = useReadTransaction(
    adminListLocations, { shopIds: floorShopIds }, !floorShopIds.length,
    `admin-locations-floor-${floorName}`, true
  );
  // At the top level (empty zoomStack): every one of the selected shop's
  // own top-level locations, plus a dimmed reference layer of every OTHER
  // shop's locations on this floor. Once zoomed into a location, only its
  // direct children are "active" -- there's no other-shop reference layer
  // to show once you're inside one shop's own nested contents.
  const activeLocations = allLocations.filter(
    l => l.shopId === shopId && (l.parentId || undefined) === currentParent?.id
  );
  const otherLocations = zoomStack.length === 0
    ? allLocations.filter(l => l.shopId !== shopId)
    : [];

  const create = useWriteTransaction(adminCreateLocation, () => { refresh(); setPending(null); });
  const update = useWriteTransaction(adminUpdateLocation, () => { refresh(); setEditing(null); setRedrawing(null); setAdjusting(null); });
  const remove = useWriteTransaction(adminDeleteLocation, () => { refresh(); setEditing(null); });

  React.useEffect(() => {
    if (!floorName) { setSvgMarkup(null); return; }
    let cancelled = false;
    (async () => {
      let response = await fetch(floorPlanUrl(floorName));
      if (!response.ok) response = await fetch(floorPlanFallbackUrl);
      const text = await response.text();
      if (!cancelled) setSvgMarkup(text);
    })();
    return () => { cancelled = true; };
  }, [floorName]);


  // Switching shops changes what the map/locations mean -- drop any
  // in-progress drawing or open form rather than letting it apply to the
  // wrong shop's map.
  React.useEffect(() => {
    setDrawing(false);
    setDrawPoints([]);
    setPending(null);
    setEditing(null);
    setRedrawing(null);
    setAdjusting(null);
    setZoomStack([]);
  }, [shopId]);

  // Global mousemove/mouseup for corner-dragging -- mounted once, gated on
  // draggingIndexRef rather than the `adjusting` state itself so it doesn't
  // need to be torn down and rebuilt on every point moved mid-drag.
  React.useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const index = draggingIndexRef.current;
      const wrapper = wrapperRef.current;
      if (index == null || !wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
      const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)));
      setAdjusting(current => current && {
        ...current,
        points: current.points.map((p, i) => (i === index ? { x, y } : p)),
      });
    };
    const onUp = () => {
      if (draggingIndexRef.current != null) {
        draggingIndexRef.current = null;
        suppressNextClickRef.current = true;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Draggable handle + live preview overlay for adjust-corners mode --
  // imperative DOM, like every other map overlay here, since the wrapper's
  // content comes from dangerouslySetInnerHTML and can't mix with rendered
  // JSX children.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-adjust-handle]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-adjust-preview]").forEach(el => el.remove());
    if (!adjusting) return;

    const preview = document.createElement("div");
    preview.setAttribute("data-adjust-preview", "true");
    Object.assign(preview.style, {
      position: "absolute",
      inset: "0",
      clipPath: `polygon(${adjusting.points.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
      background: "rgba(211, 47, 47, 0.25)",
      pointerEvents: "none",
    });
    wrapper.appendChild(preview);

    adjusting.points.forEach((point, index) => {
      const handle = document.createElement("div");
      handle.setAttribute("data-adjust-handle", String(index));
      Object.assign(handle.style, {
        position: "absolute",
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translate(-50%, -50%)",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: "#d32f2f",
        border: "2px solid white",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
        cursor: "grab",
      });
      handle.addEventListener("mousedown", event => {
        event.stopPropagation();
        event.preventDefault();
        draggingIndexRef.current = index;
      });
      wrapper.appendChild(handle);
    });
  }, [adjusting]);

  // Captures the injected SVG's true original viewBox once per floor-plan
  // load, before any zoom crop is applied to it -- so repeated zooms always
  // compose from the real original rather than a previously-overwritten
  // live value. Declared before the crop-apply effect below so it always
  // runs first on the same svgMarkup change.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const svgRoot = wrapper?.querySelector(":scope > svg:not([data-draw-preview])") as SVGSVGElement | null;
    const baseVal = svgRoot?.viewBox?.baseVal;
    originalViewBoxRef.current = baseVal
      ? { x: baseVal.x, y: baseVal.y, width: baseVal.width, height: baseVal.height }
      : null;
  }, [svgMarkup]);

  // Applies (or restores) the viewBox crop for the current zoom level.
  // Everything else -- click math, clip-path overlays, the draw-preview --
  // keeps operating in "percent of the currently displayed box" terms and
  // needs no changes; only the SVG's own internal coordinate window moves.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const svgRoot = wrapper?.querySelector(":scope > svg:not([data-draw-preview])") as SVGSVGElement | null;
    const original = originalViewBoxRef.current;
    if (!svgRoot || !original) return;
    const box = zoomStack.length ? cropViewBox(original, zoomStack) : original;
    svgRoot.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    // The floor plan's width/height attributes are fixed absolute lengths
    // (e.g. mm from an Inkscape export), so the CSS width:100%/height:auto
    // sizing rule derives the wrapper's on-page aspect ratio from THOSE, not
    // from whatever viewBox is currently set -- cropping to a sub-region
    // with a different aspect ratio would otherwise get letterboxed by the
    // default preserveAspectRatio="xMidYMid meet" instead of stretched to
    // fill, throwing off every percent-based click/overlay calculation here
    // (which all assume the visible content fills the box 0-100% on both
    // axes independently, same assumption the draw-preview overlay already
    // makes explicit with its own preserveAspectRatio="none").
    svgRoot.setAttribute("preserveAspectRatio", "none");
  }, [svgMarkup, zoomStack]);

  // Re-applies highlights/pins whenever the map or the location list changes
  // -- not React-rendered JSX, since these need to live inside markup that
  // was injected via dangerouslySetInnerHTML.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-location-pin]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-location-shape]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-other-shop-location]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-location-highlighted]").forEach(el => {
      el.removeAttribute("data-location-highlighted");
      (el as unknown as SVGElement).style.outline = "";
    });

    // Reference layer: every OTHER shop's already-placed locations on this
    // same floor, tinted with that shop's own color and non-interactive, so
    // drawing a new shape can't accidentally overlap one without it being
    // visible while drawing.
    otherLocations.forEach(location => {
      const ownerShop = shops.find(s => s.id === location.shopId);
      const color = (ownerShop?.colorId && shopColors[ownerShop.colorId]) || "#888888";
      const label = `${ownerShop?.name || "Another shop"}: ${location.name}`;
      if (location.shapePoints && location.shapePoints.length >= 3) {
        const shape = document.createElement("div");
        shape.setAttribute("data-other-shop-location", location.id);
        shape.title = label;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${location.shapePoints.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
          background: color,
          opacity: "0.18",
          pointerEvents: "none",
        });
        wrapper.appendChild(shape);
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        const dot = document.createElement("div");
        dot.setAttribute("data-other-shop-location", location.id);
        dot.title = label;
        Object.assign(dot.style, {
          position: "absolute",
          left: `${location.xPct}%`,
          top: `${location.yPct}%`,
          transform: "translate(-50%, -100%)",
          width: "14px",
          height: "14px",
          borderRadius: "50% 50% 50% 0",
          background: color,
          opacity: "0.5",
          pointerEvents: "none",
        });
        wrapper.appendChild(dot);
      }
    });

    activeLocations.forEach(location => {
      // Its geometry is already fully represented by the adjust-preview
      // overlay/handles (rendered in a separate effect, on top of this
      // one) -- skipping its normal clickable overlay here avoids a click
      // on the shape underneath re-opening the edit modal mid-drag.
      if (adjusting?.id === location.id) return;
      if (location.svgElementId) {
        const target = wrapper.querySelector(`#${CSS.escape(location.svgElementId)}`) as SVGElement | null;
        if (target) {
          target.setAttribute("data-location-highlighted", "true");
          target.style.outline = "3px solid #1976d2";
          target.style.cursor = "pointer";
        }
        return;
      }
      if (location.shapePoints && location.shapePoints.length >= 3) {
        const shape = document.createElement("div");
        shape.setAttribute("data-location-shape", location.id);
        shape.title = location.name;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${location.shapePoints.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
          background: "rgba(25, 118, 210, 0.25)",
          cursor: "pointer",
        });
        shape.addEventListener("click", event => {
          event.stopPropagation();
          setEditing(location);
        });
        wrapper.appendChild(shape);
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        const pin = document.createElement("div");
        pin.setAttribute("data-location-pin", location.id);
        pin.title = location.name;
        Object.assign(pin.style, {
          position: "absolute",
          left: `${location.xPct}%`,
          top: `${location.yPct}%`,
          transform: "translate(-50%, -100%)",
          width: "16px",
          height: "16px",
          borderRadius: "50% 50% 50% 0",
          background: "#1976d2",
          cursor: "pointer",
        });
        pin.addEventListener("click", event => {
          event.stopPropagation();
          setEditing(location);
        });
        wrapper.appendChild(pin);
      }
    });
  }, [svgMarkup, activeLocations, otherLocations, shops, shopColors, adjusting]);

  // Live feedback for an in-progress "draw shop area" click sequence --
  // separate from the effect above since it re-runs on every vertex placed,
  // not just when the map or saved locations change.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-draw-preview]").forEach(el => el.remove());
    if (drawPoints.length === 0) return;

    const svgNs = "http://www.w3.org/2000/svg";
    const overlay = document.createElementNS(svgNs, "svg");
    overlay.setAttribute("data-draw-preview", "overlay");
    overlay.setAttribute("viewBox", "0 0 100 100");
    overlay.setAttribute("preserveAspectRatio", "none");
    Object.assign(overlay.style, {
      position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none",
    });
    if (drawPoints.length > 1) {
      const line = document.createElementNS(svgNs, "polyline");
      line.setAttribute("points", drawPoints.map(p => `${p.x},${p.y}`).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#1976d2");
      line.setAttribute("stroke-width", "0.5");
      overlay.appendChild(line);
    }
    // Dashed preview of the closing edge (last point back to first) so the
    // in-progress view matches the closed shape Finish will actually save --
    // only meaningful once there are enough points to form a real polygon.
    if (drawPoints.length >= 3) {
      const first = drawPoints[0];
      const last = drawPoints[drawPoints.length - 1];
      const closing = document.createElementNS(svgNs, "line");
      closing.setAttribute("x1", String(last.x));
      closing.setAttribute("y1", String(last.y));
      closing.setAttribute("x2", String(first.x));
      closing.setAttribute("y2", String(first.y));
      closing.setAttribute("stroke", "#1976d2");
      closing.setAttribute("stroke-width", "0.5");
      closing.setAttribute("stroke-dasharray", "2,1");
      overlay.appendChild(closing);
    }
    wrapper.appendChild(overlay);

    drawPoints.forEach((point, i) => {
      const dot = document.createElement("div");
      dot.setAttribute("data-draw-preview", String(i));
      Object.assign(dot.style, {
        position: "absolute",
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translate(-50%, -50%)",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: "#d32f2f",
        border: "2px solid white",
        pointerEvents: "none",
      });
      wrapper.appendChild(dot);
    });
  }, [drawPoints]);

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const target = event.target as Element;

    const highlighted = target.closest("[data-location-highlighted]");
    if (highlighted) {
      const existing = activeLocations.find(l => l.svgElementId === highlighted.id);
      if (existing) { setEditing(existing); return; }
    }

    const rect = wrapper.getBoundingClientRect();
    const xPct = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((event.clientY - rect.top) / rect.height) * 100);

    if (drawing) {
      setDrawPoints(points => [...points, { x: xPct, y: yPct }]);
      return;
    }

    if (redrawing?.isPin) {
      update.call({ id: redrawing.id, body: { xPct, yPct } });
      return;
    }

    setPending({ xPct, yPct });
  };

  const finishShape = () => {
    if (redrawing) {
      update.call({ id: redrawing.id, body: { shapePoints: drawPoints } });
    } else {
      setPending({ shapePoints: drawPoints });
    }
    setDrawPoints([]);
    setDrawing(false);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setDrawPoints([]);
    setRedrawing(null);
  };

  const startAdjust = (location: Location) => {
    if (!location.shapePoints?.length) return;
    setAdjusting({ id: location.id, points: location.shapePoints.map(p => ({ ...p })) });
    setEditing(null);
  };

  const saveAdjust = () => {
    if (!adjusting) return;
    update.call({ id: adjusting.id, body: { shapePoints: adjusting.points } });
  };

  const startRedraw = (location: Location) => {
    const isPin = location.xPct != null && location.yPct != null;
    setRedrawing({ id: location.id, isPin });
    setEditing(null);
    if (!isPin) { setDrawing(true); setDrawPoints([]); }
  };

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Select native fullWidth value={shopId} onChange={e => setShopId((e.target as HTMLSelectElement).value)}>
          <option value="">— select shop —</option>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Grid>
      {loadError && <Grid size={{ xs: 12 }}><ErrorMessage error={loadError} /></Grid>}
      {shopId && !floorName && (
        <Grid size={{ xs: 12 }}><ErrorMessage error="This shop has no floor set, so its map can't be found." /></Grid>
      )}
      {shopId && svgMarkup && (
        <Grid size={{ xs: 12 }}>
          {zoomStack.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Button size="small" onClick={() => setZoomStack([])}>{selectedShop?.name}</Button>
              {zoomStack.map((loc, i) => (
                <React.Fragment key={loc.id}>
                  {" / "}
                  <Button size="small" onClick={() => setZoomStack(zoomStack.slice(0, i + 1))}>{loc.name}</Button>
                </React.Fragment>
              ))}
            </div>
          )}
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {zoomStack.length > 0
              ? `Zoomed in to ${currentParent?.name} -- items placed here belong inside it.`
              : `Floor ${floorName} map -- shared with every other shop on this floor.`}{" "}
            {!drawing && `Click "Draw ${zoomStack.length ? "area" : "shop area"}" to outline ${zoomStack.length ? "this location's" : "a shop's"} boundary, or click anywhere else to drop a point pin for a smaller item (cabinet, tool, fixture).`}
          </Typography>
          {drawing && (
            <Alert severity="info" sx={{ mb: 1 }}>
              {drawPoints.length === 0
                ? `Click on the map to place the first point of ${redrawing ? "the new outline" : zoomStack.length ? "this item's outline" : "the shop's boundary"}.`
                : drawPoints.length < 3
                  ? `${drawPoints.length} point${drawPoints.length > 1 ? "s" : ""} placed -- keep clicking to add more (at least 3 needed to close a shape).`
                  : `${drawPoints.length} points placed -- the dashed line previews where the shape will close. Click "Finish shape" when the outline looks right, or keep adding points.`}
            </Alert>
          )}
          {redrawing?.isPin && (
            <Alert severity="info" sx={{ mb: 1 }} action={
              <Button size="small" onClick={() => setRedrawing(null)}>Cancel</Button>
            }>
              Click anywhere on the map to move this location.
            </Alert>
          )}
          {adjusting && (
            <Alert severity={update.error ? "error" : "info"} sx={{ mb: 1 }} action={
              <>
                <Button size="small" disabled={update.isRequesting} onClick={saveAdjust}>Save</Button>
                <Button size="small" disabled={update.isRequesting} onClick={() => setAdjusting(null)}>Cancel</Button>
              </>
            }>
              {update.error || "Drag a corner point to reposition it, then Save."}
            </Alert>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {!drawing && !redrawing && !adjusting && (
              <Button variant="outlined" onClick={() => setDrawing(true)}>Draw {zoomStack.length ? "area" : "shop area"}</Button>
            )}
            {drawing && (
              <>
                <Button variant="contained" disabled={drawPoints.length < 3} onClick={finishShape}>
                  Finish shape ({drawPoints.length})
                </Button>
                <Button onClick={cancelDrawing}>Cancel</Button>
              </>
            )}
          </div>
          {/* A CSS rule, not an imperative style on the injected <svg> --
              something (never fully root-caused; flagged for the broader
              debug pass) keeps clearing a JS-applied inline style on that
              node, but a stylesheet rule isn't an attribute of the node
              itself, so nothing can reset it out from under us. Forces the
              SVG's own intrinsic size (often mm units from an Inkscape
              export) to exactly fill the wrapper -- every click/overlay
              calculation here assumes the visible map exactly matches the
              wrapper's box, regardless of the source file's own units.
              Excludes the live-draw preview overlay (:not([data-draw-preview]))
              -- that one is a plain 0-100 square viewBox by design, and
              forcing height:auto on it (deriving from its square intrinsic
              ratio) squished it into a non-matching square, offsetting the
              in-progress polyline/dashed-line from the correctly-positioned
              dots. It already sets its own width/height:100% inline, which
              this rule would otherwise stomp via !important. */}
          <style>{"[data-map-wrapper] > svg:not([data-draw-preview]) { width: 100% !important; height: auto !important; display: block !important; }"}</style>
          <div
            ref={wrapperRef}
            data-map-wrapper
            onClick={handleMapClick}
            style={{ position: "relative", border: "1px solid #ccc", cursor: "crosshair", maxWidth: 600 }}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </Grid>
      )}
      {pending && (
        <LocationFormModal
          initialName=""
          onClose={() => setPending(null)}
          onSave={name => create.call({ body: { name, shopId, parentId: currentParent?.id, ...pending } })}
          loading={create.isRequesting}
          error={create.error}
        />
      )}
      {editing && (
        <LocationFormModal
          initialName={editing.name}
          shops={shops}
          initialShopId={editing.shopId}
          onClose={() => setEditing(null)}
          onSave={(name, newShopId) => update.call({ id: editing.id, body: { name, shopId: newShopId } })}
          onDelete={() => remove.call({ id: editing.id })}
          onRedraw={
            (editing.shapePoints?.length || (editing.xPct != null && editing.yPct != null))
              ? () => startRedraw(editing)
              : undefined
          }
          onAdjustCorners={
            editing.shapePoints && editing.shapePoints.length >= 3
              ? () => startAdjust(editing)
              : undefined
          }
          onZoomIn={() => { setZoomStack(stack => [...stack, editing]); setEditing(null); }}
          loading={update.isRequesting || remove.isRequesting}
          error={update.error || remove.error}
        />
      )}
    </Grid>
  );
};

export default ShopMapManager;
