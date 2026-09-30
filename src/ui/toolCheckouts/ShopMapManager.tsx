import * as React from "react";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { isApiErrorResponse } from "makerspace-ts-api-client";
import { Location, Shop, Tool } from "app/entities/toolCheckout";
import { adminListLocations, adminCreateLocation, adminUpdateLocation, adminDeleteLocation } from "api/locations";
import { listGoogleCalendarColors, listTools, adminUpdateTool } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";
import { boundingBoxOf, paddedBox, cropViewBoxToBox, wrapperPctToLocalPct, ViewBox } from "./locationGeometry";
import { LOCATION_KIND_OPTIONS, colorForKind, TOOL_MARKER_COLOR } from "./locationKinds";

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

// Composes each zoomed-into location's own bounding box (in percent of
// *its* parent) down onto the SVG's true original viewBox, one level at a
// time -- since every level's stored percentages are already relative to
// its immediate parent's box, this is a plain nested crop, not a coordinate
// transform. cropViewBoxToBox (shared with ShopLocationMap's single-level
// crop) does the actual percent-box -> SVG-viewBox arithmetic.
const cropViewBox = (original: ViewBox, stack: Location[]): ViewBox =>
  stack.reduce((current, loc) => cropViewBoxToBox(current, paddedBox(boundingBoxOf(loc))), original);

const LocationFormModal: React.FC<{
  initialName: string;
  initialKind?: string;
  shops?: Shop[];
  initialShopId?: string;
  onClose: () => void;
  onSave: (name: string, shopId?: string, kind?: string, toolId?: string) => void;
  onDelete?: () => void;
  onRedraw?: () => void;
  onAdjustCorners?: () => void;
  onZoomIn?: () => void;
  locationId?: string;
  tools?: Tool[];
  onToggleTool?: (toolId: string, checked: boolean) => void;
  // Offered only when placing a brand-new marker (not editing an existing
  // one) -- picking a tool here means "this marker IS that tool's precise
  // spot", prefilling the name and linking the tool to it on save. Distinct
  // from `tools`/`onToggleTool` above, which lets an EXISTING location's
  // edit form say "these tools are generally somewhere in here".
  linkableTools?: Tool[];
  // Preselects one of linkableTools (e.g. arriving here via the Tools
  // tab's "Place on map" button) instead of making the admin find it
  // themselves in the dropdown.
  initialToolId?: string;
  loading: boolean;
  error: string;
}> = ({
  initialName, initialKind, shops, initialShopId, onClose, onSave, onDelete, onRedraw, onAdjustCorners, onZoomIn,
  locationId, tools, onToggleTool, linkableTools, initialToolId, loading, error
}) => {
  const [kind, setKind] = React.useState(initialKind || "");
  const [shopId, setShopId] = React.useState(initialShopId || "");
  const [toolId, setToolId] = React.useState(initialToolId || "");
  const [name, setName] = React.useState(
    initialName || linkableTools?.find(t => t.id === initialToolId)?.name || ""
  );
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, shops ? shopId : undefined, kind || undefined, toolId || undefined);
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
        {linkableTools && linkableTools.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" color="textSecondary">Or place a specific tool here</Typography>
            <Select native fullWidth value={toolId} onChange={e => {
              const id = (e.target as HTMLSelectElement).value;
              setToolId(id);
              const tool = linkableTools.find(t => t.id === id);
              if (tool && !name.trim()) setName(tool.name);
            }}>
              <option value="">— none, just a plain marker —</option>
              {linkableTools.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.locationName ? ` (currently: ${t.locationName})` : ""}
                </option>
              ))}
            </Select>
          </Grid>
        )}
        <Grid size={{ xs: 12 }}>
          <Select native fullWidth value={kind} onChange={e => setKind((e.target as HTMLSelectElement).value)}>
            {LOCATION_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Grid>
        {shops && (
          <Grid size={{ xs: 12 }}>
            <Select native fullWidth value={shopId} onChange={e => setShopId((e.target as HTMLSelectElement).value)}>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Grid>
        )}
        {locationId && tools && tools.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2">Tools here</Typography>
            {tools.map(tool => (
              <FormControlLabel key={tool.id} style={{ display: "block" }}
                control={
                  <Checkbox
                    checked={tool.locationId === locationId}
                    onChange={e => onToggleTool?.(tool.id, e.target.checked)}
                  />
                }
                label={tool.name}
              />
            ))}
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

const ShopMapManager: React.FC<{
  // Set by the Tools tab's "Place on map" button -- jumps straight to this
  // shop and, once the current shop selection matches, preselects this
  // tool in the "place a specific tool here" picker for the next new
  // marker, instead of making the admin hunt for the shop/tool themselves.
  preset?: { shopId: string; toolId: string };
}> = ({ preset }) => {
  const { data: shops = [] } = useCheckoutCatalog("managedShops");
  const [shopId, setShopId] = React.useState(preset?.shopId || "");
  React.useEffect(() => {
    if (preset?.shopId) setShopId(preset.shopId);
  }, [preset?.shopId]);
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
  // Read from the corner-drag mousemove handler below, which is mounted
  // once (empty dependency array) and would otherwise close over whatever
  // `currentParent` was at mount time forever.
  const currentParentRef = React.useRef(currentParent);
  currentParentRef.current = currentParent;

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

  // The selected shop's tools, so the edit form can show/toggle which
  // tool(s) live at a given location directly from the map, instead of only
  // through the separate Tools tab's location picker.
  const { data: shopTools = [], refresh: refreshTools } = useReadTransaction(
    listTools, { shopId }, !shopId, `admin-tools-for-map-${shopId}`, true
  );
  const toggleTool = useWriteTransaction(adminUpdateTool, () => refreshTools());

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
      let x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
      let y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)));
      const parent = currentParentRef.current;
      if (parent) {
        const box = boundingBoxOf(parent);
        x = Math.round(wrapperPctToLocalPct(x, box.minX, box.maxX));
        y = Math.round(wrapperPctToLocalPct(y, box.minY, box.maxY));
      }
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
    // No dependency array: same reset risk as the viewBox-crop effect above
    // (React re-applies dangerouslySetInnerHTML -- and wipes every appended
    // child, including these handles -- on any unrelated re-render of this
    // component), so this needs to reassert on every render, not just when
    // `adjusting` itself changes.
  });

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
  //
  // Deliberately no dependency array -- confirmed via direct instrumentation
  // (patching the wrapper's innerHTML setter) that React re-applies
  // dangerouslySetInnerHTML on this wrapper on EVERY re-render of this
  // component, even though `svgMarkup` itself never changes, silently
  // resetting the injected SVG's viewBox back to its embedded default. A
  // dependency array of [svgMarkup, zoomStack] looks correct but only
  // reruns when those specific values change -- so clicking to place a pin
  // (which only touches `pending` state) still re-renders the component,
  // resets the viewBox, and this effect never notices to reapply the crop.
  // This is almost certainly also the true, never-fully-explained cause of
  // the earlier imperative-inline-style-getting-cleared mystery (see the
  // CSS-rule workaround below) -- same reset, different casualty. Every
  // other effect in this component that appends content into this same
  // wrapper (pins/shapes below, the draw-preview, the adjust-corners
  // handles) has the identical no-dependency-array treatment for the same
  // reason -- none of them can safely rely on a specific value changing to
  // know when to reassert their DOM content.
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
  });

  // Re-applies highlights/pins whenever the map or the location list changes
  // -- not React-rendered JSX, since these need to live inside markup that
  // was injected via dangerouslySetInnerHTML.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-location-pin]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-location-shape]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-other-shop-location]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-zoom-parent-outline]").forEach(el => el.remove());
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

    // While zoomed in, the location you zoomed into is otherwise invisible
    // -- activeLocations only ever holds its CHILDREN, so with nothing else
    // drawn inside it yet (or a floor plan that has no real walls matching
    // where it was drawn), the crop can look like a blank screen with no
    // frame of reference for where you actually are. Draw its own outline
    // (stroke only, no fill) so there's always something to place items
    // against. A plain clip-path div can't do this -- clip-path crops what
    // shows through a div's own rectangular box, it doesn't trace the
    // clipped shape's edges as a border -- so this uses a real SVG polygon
    // instead, same convention as the draw-preview overlay elsewhere here.
    if (currentParent?.shapePoints && currentParent.shapePoints.length >= 3) {
      const svgNs = "http://www.w3.org/2000/svg";
      const outlineSvg = document.createElementNS(svgNs, "svg");
      outlineSvg.setAttribute("data-zoom-parent-outline", currentParent.id);
      outlineSvg.setAttribute("viewBox", "0 0 100 100");
      outlineSvg.setAttribute("preserveAspectRatio", "none");
      Object.assign(outlineSvg.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none",
      });
      const polygon = document.createElementNS(svgNs, "polygon");
      polygon.setAttribute("points", currentParent.shapePoints.map(p => `${p.x},${p.y}`).join(" "));
      polygon.setAttribute("fill", "none");
      polygon.setAttribute("stroke", "#1976d2");
      polygon.setAttribute("stroke-width", "0.6");
      polygon.setAttribute("stroke-dasharray", "2,1");
      outlineSvg.appendChild(polygon);
      wrapper.appendChild(outlineSvg);
    }

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
      const label = location.toolNames?.length
        ? `${location.name} — ${location.toolNames.join(", ")}`
        : location.name;
      // Same priority as the read-only Workshops-page map: a location
      // holding a tool always renders in the reserved tool color, ahead of
      // its own kind color, so it stays consistent regardless of which
      // view an admin is looking at.
      const color = location.toolNames?.length ? TOOL_MARKER_COLOR : colorForKind(location.kind, "#1976d2");
      if (location.shapePoints && location.shapePoints.length >= 3) {
        const shape = document.createElement("div");
        shape.setAttribute("data-location-shape", location.id);
        shape.title = label;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${location.shapePoints.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
          background: color,
          opacity: "0.35",
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
        pin.title = label;
        Object.assign(pin.style, {
          position: "absolute",
          left: `${location.xPct}%`,
          top: `${location.yPct}%`,
          transform: "translate(-50%, -100%)",
          width: "16px",
          height: "16px",
          borderRadius: "50% 50% 50% 0",
          background: color,
          cursor: "pointer",
        });
        pin.addEventListener("click", event => {
          event.stopPropagation();
          setEditing(location);
        });
        wrapper.appendChild(pin);
      }
    });
    // No dependency array -- see the viewBox-crop effect's comment above.
    // (activeLocations/otherLocations happen to be freshly-filtered arrays
    // every render today, which would have masked the need for this too,
    // but that's exactly the kind of accidental correctness this file
    // shouldn't depend on -- a future `useMemo` on either would silently
    // reintroduce the reset bug.)
  });

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
    // No dependency array, same reset risk as the other overlay effects
    // here -- see the viewBox-crop effect's comment above.
  });

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
    let xPct = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    let yPct = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    // The visible wrapper shows a *padded* crop when zoomed in (a bit of
    // margin beyond the current parent's exact edges, for visual breathing
    // room) -- but every stored point must be percent-of-the-true-unpadded-
    // parent-box, or composing through multiple nesting levels compounds
    // that margin and can push a deeply-nested item outside its ancestor's
    // real boundary. Remap raw wrapper percent into that frame before use.
    if (currentParent) {
      const box = boundingBoxOf(currentParent);
      xPct = Math.round(wrapperPctToLocalPct(xPct, box.minX, box.maxX));
      yPct = Math.round(wrapperPctToLocalPct(yPct, box.minY, box.maxY));
    }

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
              confirmed (see the viewBox-crop effect above) that React
              re-applies dangerouslySetInnerHTML on this wrapper on every
              re-render, clearing any JS-applied inline style on that node,
              but a stylesheet rule isn't an attribute of the node itself,
              so nothing can reset it out from under us. Forces the
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
          linkableTools={shopTools}
          initialToolId={shopId === preset?.shopId ? preset?.toolId : undefined}
          onClose={() => setPending(null)}
          onSave={async (name, _shopId, kind, toolId) => {
            const result = await create.call({ body: { name, shopId, kind, parentId: currentParent?.id, ...pending } });
            // Fire-and-forget: create's own onSuccess (above) closes this
            // modal as soon as the location itself is saved, so a failure
            // in this second call surfaces only via the "Tools here"
            // checklist not reflecting it next time this location is
            // edited, not as an error in this form. Acceptable here since
            // the only realistic failure mode (a shop mismatch) can't
            // happen -- linkableTools is always scoped to this same shop.
            if (toolId && !isApiErrorResponse(result)) {
              toggleTool.call({ id: toolId, body: { locationId: result.data.id } });
            }
          }}
          loading={create.isRequesting}
          error={create.error}
        />
      )}
      {editing && (
        <LocationFormModal
          initialName={editing.name}
          initialKind={editing.kind}
          shops={shops}
          initialShopId={editing.shopId}
          onClose={() => setEditing(null)}
          onSave={(name, newShopId, kind) => update.call({ id: editing.id, body: { name, shopId: newShopId, kind } })}
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
          locationId={editing.id}
          tools={shopTools}
          onToggleTool={(toolId, checked) => toggleTool.call({ id: toolId, body: { locationId: checked ? editing.id : "" } })}
          loading={update.isRequesting || remove.isRequesting || toggleTool.isRequesting}
          error={update.error || remove.error || toggleTool.error}
        />
      )}
    </Grid>
  );
};

export default ShopMapManager;
