import * as React from "react";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { isApiErrorResponse } from "makerspace-ts-api-client";
import { Location, Tool } from "app/entities/toolCheckout";
import { adminListLocations, listLocations, adminCreateLocation, adminUpdateLocation, adminDeleteLocation } from "api/locations";
import { listGoogleCalendarColors, listTools, adminUpdateTool } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";
import { flattenTree } from "./locationTree";
import {
  Box, FULL_FLOOR_BOX, boundingBoxOf, paddedBox, cropViewBoxToBox, composePoint, remapToBox, ViewBox,
} from "./locationGeometry";
import { LOCATION_KIND_OPTIONS, colorForKind, FALLBACK_NESTED_COLOR, TOOL_MARKER_COLOR } from "./locationKinds";

// One SVG per building floor, shared by every shop on that floor.
const floorPlanUrl = (floorName: string) => `/assets/shopFloorPlans/floor-${floorName}.svg`;
const floorPlanFallbackUrl = "/assets/shopFloorPlans/placeholder.svg";

const unionBoundingBox = (locations: Location[]): Box | null => {
  const xs: number[] = [], ys: number[] = [];
  locations.forEach(l => {
    if (l.shapePoints?.length) l.shapePoints.forEach(p => { xs.push(p.x); ys.push(p.y); });
    else if (l.xPct != null && l.yPct != null) { xs.push(l.xPct); ys.push(l.yPct); }
  });
  if (!xs.length) return null;
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

interface PendingPlacement {
  xPct?: number;
  yPct?: number;
  shapePoints?: { x: number; y: number }[];
}

const LocationFormModal: React.FC<{
  initialName: string;
  initialKind?: string;
  onClose: () => void;
  onSave: (name: string, kind?: string, toolId?: string) => void;
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
  // Preselects one of linkableTools (e.g. arriving here via the Tools tab's
  // "Place on map" button) instead of making the admin find it themselves.
  initialToolId?: string;
  loading: boolean;
  error: string;
}> = ({
  initialName, initialKind, onClose, onSave, onDelete, onRedraw, onAdjustCorners, onZoomIn,
  locationId, tools, onToggleTool, linkableTools, initialToolId, loading, error
}) => {
  const [kind, setKind] = React.useState(initialKind || "");
  const [toolId, setToolId] = React.useState(initialToolId || "");
  const [name, setName] = React.useState(
    initialName || linkableTools?.find(t => t.id === initialToolId)?.name || ""
  );
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, kind || undefined, toolId || undefined);
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

// Single map component for one shop, shown on its Workshops page to every
// member. Always shows the shop's own area, every nested cabinet/shelf/
// tool inside it (all stored in absolute floor-relative percent, so no
// recursive resolution is needed to place any of it correctly), and the
// tool-name hierarchy list below it. When `canEdit` is true (admin/board,
// or a shop RM for this specific shop -- same rule the API itself already
// enforces), it also gains the draw/place/zoom/edit tools that used to live
// on a separate admin-only "Map" tab -- editing a shop's map now happens on
// that shop's own page instead of a shop-picker elsewhere.
const ShopLocationMap: React.FC<{
  shopId: string;
  shopName: string;
  canEdit: boolean;
  // Lets a click on a tool's name jump straight to that tool on the
  // Workshops page's Tools tab.
  onSelectTool?: (toolId: string) => void;
  // "Find tool" on a Tools-tab row lands here with this set, so the map can
  // ring whichever marker holds that tool.
  highlightToolId?: string;
  // Set by the Tools tab's "Place on map" button -- preselects this tool in
  // the "place a specific tool here" picker for the next new marker placed,
  // instead of making the admin find it themselves.
  preset?: { toolId: string };
}> = ({ shopId, shopName, canEdit, onSelectTool, highlightToolId, preset }) => {
  const { data: shops = [] } = useCheckoutCatalog("shops");
  const shop = shops.find(s => s.id === shopId);
  const floorName = shop?.floorName;

  const { data: locations = [], refresh } = useReadTransaction(
    canEdit ? adminListLocations : listLocations, { shopIds: [shopId] }, !shopId,
    `shop-location-map-${shopId}-${canEdit}`, true
  );
  const byId = React.useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

  // Only fetched when editing is possible -- the "place a specific tool
  // here" picker and "Tools here" checklist both need the full tool list
  // (including which already have a locationId), not just the toolNames
  // already embedded on each location in the read-only response.
  const { data: shopTools = [], refresh: refreshTools } = useReadTransaction(
    listTools, { shopId }, !canEdit || !shopId, `admin-tools-for-map-${shopId}`, true
  );

  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [shopColors, setShopColors] = React.useState<Record<string, string>>({});
  const [zoomStack, setZoomStack] = React.useState<Location[]>([]);
  const [drawing, setDrawing] = React.useState(false);
  const [drawPoints, setDrawPoints] = React.useState<{ x: number; y: number }[]>([]);
  const [pending, setPending] = React.useState<PendingPlacement | null>(null);
  const [pendingLocationId, setPendingLocationId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [redrawing, setRedrawing] = React.useState<{ id: string; isPin: boolean } | null>(null);
  const [adjusting, setAdjusting] = React.useState<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const draggingIndexRef = React.useRef<number | null>(null);
  const suppressNextClickRef = React.useRef(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const originalViewBoxRef = React.useRef<ViewBox | null>(null);

  const currentParent = zoomStack[zoomStack.length - 1];
  const currentParentRef = React.useRef(currentParent);
  currentParentRef.current = currentParent;

  const topLevelLocations = locations.filter(l => !l.parentId);
  const baseBox = unionBoundingBox(topLevelLocations);
  // The crop currently on screen: the whole shop's extent, or (while
  // zoomed in) one location's own extent within it. Always a single,
  // direct padding of that location's own absolute bounding box -- no
  // composing through ancestors, since every location's own coordinates
  // are already floor-relative.
  //
  // A brand-new shop with nothing drawn yet has no bounding box to crop
  // to -- for a plain viewer that correctly means "nothing to show," but
  // an editor's very first job is drawing that initial shape, so they get
  // the whole floor plan uncropped instead of being locked out by the
  // "no map set up yet" message before they've had a chance to draw
  // anything.
  const effectiveBox: Box | null = zoomStack.length
    ? paddedBox(boundingBoxOf(currentParent))
    : (baseBox ? paddedBox(baseBox) : (canEdit ? FULL_FLOOR_BOX : null));

  const activeLocations = locations.filter(
    l => (l.parentId || undefined) === currentParent?.id
  );

  const create = useWriteTransaction(adminCreateLocation, () => refresh());
  const update = useWriteTransaction(adminUpdateLocation, () => { refresh(); setEditing(null); setRedrawing(null); setAdjusting(null); });
  const remove = useWriteTransaction(adminDeleteLocation, () => { refresh(); setEditing(null); });
  const toggleTool = useWriteTransaction(adminUpdateTool, () => refreshTools());

  React.useEffect(() => {
    let active = true;
    listGoogleCalendarColors().then(result => {
      if (!active) return;
      const list = result.data?.colors || FALLBACK_COLORS;
      setShopColors(Object.fromEntries(list.map(c => [c.id, c.backgroundColor])));
    });
    return () => { active = false; };
  }, []);

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

  // "Find tool"/"Place on map" land here from elsewhere on the page --
  // bring the map into view the same way WorkshopTools scrolls to a row.
  React.useEffect(() => {
    if (!highlightToolId && !preset) return;
    wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightToolId, preset]);

  // Captures the injected SVG's true original viewBox once per floor-plan
  // load, before any zoom crop is applied to it.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const svgRoot = wrapper?.querySelector(":scope > svg:not([data-draw-preview])") as SVGSVGElement | null;
    const baseVal = svgRoot?.viewBox?.baseVal;
    originalViewBoxRef.current = baseVal
      ? { x: baseVal.x, y: baseVal.y, width: baseVal.width, height: baseVal.height }
      : null;
  }, [svgMarkup]);

  // Applies (or restores) the viewBox crop for the current zoom level.
  //
  // Deliberately no dependency array -- confirmed via direct instrumentation
  // that React re-applies dangerouslySetInnerHTML on this wrapper on EVERY
  // re-render, even though `svgMarkup` itself never changes, silently
  // resetting the injected SVG's viewBox back to its embedded default. A
  // dependency array that looks correct (e.g. [svgMarkup, zoomStack]) only
  // reruns when those specific values change, missing re-renders triggered
  // by anything else (clicking to place a pin, for instance). Every other
  // effect below that appends content into this same wrapper has the
  // identical no-dependency-array treatment for the same reason.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const svgRoot = wrapper?.querySelector(":scope > svg:not([data-draw-preview])") as SVGSVGElement | null;
    const original = originalViewBoxRef.current;
    if (!svgRoot || !original || !effectiveBox) return;
    const box = cropViewBoxToBox(original, effectiveBox);
    svgRoot.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    // The floor plan's width/height attributes are fixed absolute lengths,
    // so the CSS width:100%/height:auto sizing rule derives the wrapper's
    // on-page aspect ratio from THOSE, not from whatever viewBox is
    // currently set -- forcing preserveAspectRatio="none" keeps a crop with
    // a different aspect ratio stretched to fill instead of letterboxed,
    // which every percent-based click/overlay calculation here assumes.
    svgRoot.setAttribute("preserveAspectRatio", "none");
  });

  // Switching the zoom level (or finishing an edit) drops any in-progress
  // drawing/open form rather than letting it apply to the wrong context.
  React.useEffect(() => {
    setDrawing(false);
    setDrawPoints([]);
    setPending(null);
    setPendingLocationId(null);
    setEditing(null);
    setRedrawing(null);
    setAdjusting(null);
  }, [zoomStack.length, currentParent?.id]);

  // Global mousemove/mouseup for corner-dragging -- mounted once, gated on
  // draggingIndexRef rather than the `adjusting` state itself.
  React.useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const index = draggingIndexRef.current;
      const wrapper = wrapperRef.current;
      if (index == null || !wrapper || !effectiveBox) return;
      const rect = wrapper.getBoundingClientRect();
      const rawX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
      const rawY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
      const { x, y } = composePoint(effectiveBox, rawX, rawY);
      setAdjusting(current => current && {
        ...current,
        points: current.points.map((p, i) => (i === index ? { x: Math.round(x), y: Math.round(y) } : p)),
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
  }, [effectiveBox]);

  // Draggable handle + live preview overlay for adjust-corners mode.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !effectiveBox) return;
    wrapper.querySelectorAll("[data-adjust-handle]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-adjust-preview]").forEach(el => el.remove());
    if (!adjusting) return;

    const displayPoints = adjusting.points.map(p => remapToBox(effectiveBox, p.x, p.y));
    const preview = document.createElement("div");
    preview.setAttribute("data-adjust-preview", "true");
    Object.assign(preview.style, {
      position: "absolute",
      inset: "0",
      clipPath: `polygon(${displayPoints.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
      background: "rgba(211, 47, 47, 0.25)",
      pointerEvents: "none",
    });
    wrapper.appendChild(preview);

    displayPoints.forEach((point, index) => {
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
    // No dependency array -- same reset risk as the viewBox-crop effect.
  });

  // Renders every location (every nesting depth) against the currently
  // displayed crop -- a plain remap, since every stored coordinate is
  // already floor-relative. A top-level location keeps its shop's own
  // color for identification; anything nested gets a fixed kind color (or
  // the reserved tool color if it holds a tool) so it reads as "an object"
  // regardless of which shop's color it sits inside.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !effectiveBox) return;
    wrapper.querySelectorAll("[data-shop-location], [data-shop-location-ring], [data-zoom-parent-outline]").forEach(el => el.remove());
    const shopColor = (shop?.colorId && shopColors[shop.colorId]) || "#1976d2";

    // While zoomed in, the location you zoomed into is otherwise invisible
    // -- draw its own outline (stroke only, no fill) so there's always a
    // frame of reference, even on a blank floor-plan region.
    if (currentParent?.shapePoints && currentParent.shapePoints.length >= 3) {
      const displayPoints = currentParent.shapePoints.map(p => remapToBox(effectiveBox, p.x, p.y));
      const svgNs = "http://www.w3.org/2000/svg";
      const outlineSvg = document.createElementNS(svgNs, "svg");
      outlineSvg.setAttribute("data-zoom-parent-outline", currentParent.id);
      outlineSvg.setAttribute("viewBox", "0 0 100 100");
      outlineSvg.setAttribute("preserveAspectRatio", "none");
      Object.assign(outlineSvg.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none",
      });
      const polygon = document.createElementNS(svgNs, "polygon");
      polygon.setAttribute("points", displayPoints.map(p => `${p.x},${p.y}`).join(" "));
      polygon.setAttribute("fill", "none");
      polygon.setAttribute("stroke", "#1976d2");
      polygon.setAttribute("stroke-width", "0.6");
      polygon.setAttribute("stroke-dasharray", "2,1");
      outlineSvg.appendChild(polygon);
      wrapper.appendChild(outlineSvg);
    }

    locations.forEach(location => {
      if (adjusting?.id === location.id) return;
      // The location you zoomed into gets its own outline above instead of
      // a normal filled overlay (which would otherwise double-render it).
      if (currentParent?.id === location.id) return;
      const isNested = !!location.parentId;
      const hasTool = isNested && !!location.toolNames?.length;
      const color = hasTool
        ? TOOL_MARKER_COLOR
        : isNested ? colorForKind(location.kind, FALLBACK_NESTED_COLOR) : shopColor;
      const opacity = isNested ? "0.55" : "0.3";
      const label = location.toolNames?.length
        ? `${location.name} — ${location.toolNames.join(", ")}`
        : location.name;
      const isActive = canEdit && (location.parentId || undefined) === currentParent?.id;
      const isHighlighted = !!highlightToolId && !!location.toolIds?.includes(highlightToolId);
      const addRing = (centerXPct: number, centerYPct: number) => {
        const ring = document.createElement("div");
        ring.setAttribute("data-shop-location-ring", location.id);
        Object.assign(ring.style, {
          position: "absolute",
          left: `${centerXPct}%`,
          top: `${centerYPct}%`,
          width: "34px",
          height: "34px",
          marginLeft: "-17px",
          marginTop: "-17px",
          borderRadius: "50%",
          border: "3px solid #d32f2f",
          boxSizing: "border-box",
          pointerEvents: "none",
          animation: "shop-location-map-ring-pulse 1.4s ease-in-out infinite",
        });
        wrapper.appendChild(ring);
      };

      if (location.shapePoints && location.shapePoints.length >= 3) {
        const displayPoints = location.shapePoints.map(p => remapToBox(effectiveBox, p.x, p.y));
        const shape = document.createElement("div");
        shape.setAttribute("data-shop-location", location.id);
        shape.title = label;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${displayPoints.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
          background: color,
          opacity,
          cursor: isActive ? "pointer" : undefined,
          pointerEvents: isActive ? "auto" : "none",
        });
        if (isActive) shape.addEventListener("click", event => { event.stopPropagation(); setEditing(location); });
        wrapper.appendChild(shape);
        if (isHighlighted) {
          const centerX = displayPoints.reduce((sum, p) => sum + p.x, 0) / displayPoints.length;
          const centerY = displayPoints.reduce((sum, p) => sum + p.y, 0) / displayPoints.length;
          addRing(centerX, centerY);
        }
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        const p = remapToBox(effectiveBox, location.xPct, location.yPct);
        const dot = document.createElement("div");
        dot.setAttribute("data-shop-location", location.id);
        dot.title = label;
        Object.assign(dot.style, {
          position: "absolute",
          left: `${p.x}%`,
          top: `${p.y}%`,
          transform: "translate(-50%, -100%)",
          width: "14px",
          height: "14px",
          borderRadius: "50% 50% 50% 0",
          background: color,
          opacity,
          cursor: isActive ? "pointer" : undefined,
          pointerEvents: isActive ? "auto" : "none",
        });
        if (isActive) dot.addEventListener("click", event => { event.stopPropagation(); setEditing(location); });
        wrapper.appendChild(dot);
        if (isHighlighted) addRing(p.x, p.y);
      }
    });
    // No dependency array -- see the viewBox-crop effect's comment above.
  });

  // Live feedback for an in-progress "draw shop area" click sequence.
  //
  // drawPoints are stored in absolute floor-relative percent (same as any
  // saved shapePoints -- see handleMapClick below), not percent of the
  // currently-displayed crop, so each point has to be remapped through
  // effectiveBox before plotting it in this 0-100 preview overlay, exactly
  // like the saved-location render effect above already does. Missing this
  // was a real, confirmed bug: a click's preview dot could appear far from
  // where it was actually clicked whenever the view was zoomed/cropped.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-draw-preview]").forEach(el => el.remove());
    if (drawPoints.length === 0 || !effectiveBox) return;

    const displayPoints = drawPoints.map(p => remapToBox(effectiveBox, p.x, p.y));
    const svgNs = "http://www.w3.org/2000/svg";
    const overlay = document.createElementNS(svgNs, "svg");
    overlay.setAttribute("data-draw-preview", "overlay");
    overlay.setAttribute("viewBox", "0 0 100 100");
    overlay.setAttribute("preserveAspectRatio", "none");
    Object.assign(overlay.style, {
      position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none",
    });
    if (displayPoints.length > 1) {
      const line = document.createElementNS(svgNs, "polyline");
      line.setAttribute("points", displayPoints.map(p => `${p.x},${p.y}`).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#d32f2f");
      line.setAttribute("stroke-width", "0.6");
      overlay.appendChild(line);
      if (displayPoints.length >= 3) {
        const close = document.createElementNS(svgNs, "line");
        close.setAttribute("x1", String(displayPoints[displayPoints.length - 1].x));
        close.setAttribute("y1", String(displayPoints[displayPoints.length - 1].y));
        close.setAttribute("x2", String(displayPoints[0].x));
        close.setAttribute("y2", String(displayPoints[0].y));
        close.setAttribute("stroke", "#d32f2f");
        close.setAttribute("stroke-width", "0.6");
        close.setAttribute("stroke-dasharray", "2,1");
        overlay.appendChild(close);
      }
    }
    displayPoints.forEach(p => {
      const dot = document.createElementNS(svgNs, "circle");
      dot.setAttribute("cx", String(p.x));
      dot.setAttribute("cy", String(p.y));
      dot.setAttribute("r", "1.2");
      dot.setAttribute("fill", "#d32f2f");
      overlay.appendChild(dot);
    });
    wrapper.appendChild(overlay);
  }, [drawPoints, effectiveBox]);

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const wrapper = wrapperRef.current;
    if (!wrapper || !effectiveBox) return;

    const rect = wrapper.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    const { x, y } = composePoint(effectiveBox, rawX, rawY);
    const xPct = Math.round(x), yPct = Math.round(y);

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

  if (!floorName) return null;

  return (
    <Grid container spacing={1}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="subtitle2" gutterBottom>{shopName} map</Typography>
        {!svgMarkup || !effectiveBox ? (
          <Typography variant="body2" color="textSecondary">
            No location map set up for this shop yet.
          </Typography>
        ) : (
          <>
            {canEdit && zoomStack.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Button size="small" onClick={() => setZoomStack([])}>{shopName}</Button>
                {zoomStack.map((loc, i) => (
                  <React.Fragment key={loc.id}>
                    {" / "}
                    <Button size="small" onClick={() => setZoomStack(zoomStack.slice(0, i + 1))}>{loc.name}</Button>
                  </React.Fragment>
                ))}
              </div>
            )}
            {canEdit && (
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {zoomStack.length > 0
                  ? `Zoomed in to ${currentParent?.name} -- items placed here belong inside it.`
                  : `Click "Draw area" to outline a boundary, or click anywhere else to drop a point pin for a smaller item.`}
              </Typography>
            )}
            {drawing && (
              <Alert severity="info" sx={{ mb: 1 }}>
                {drawPoints.length === 0
                  ? `Click on the map to place the first point of ${redrawing ? "the new outline" : "the boundary"}.`
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
            {canEdit && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {!drawing && !redrawing && !adjusting && (
                  <Button variant="outlined" onClick={() => setDrawing(true)}>Draw area</Button>
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
            )}
            <style>{"[data-shop-location-map-wrapper] > svg:not([data-draw-preview]) { width: 100% !important; height: auto !important; display: block !important; } @keyframes shop-location-map-ring-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.25); opacity: 0.6; } }"}</style>
            <div
              ref={wrapperRef}
              data-shop-location-map-wrapper
              onClick={canEdit ? handleMapClick : undefined}
              style={{
                position: "relative", border: "1px solid #ccc", maxWidth: canEdit ? 600 : 420,
                overflow: "hidden", cursor: canEdit ? "crosshair" : undefined,
              }}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </>
        )}
        {locations.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {flattenTree(locations).flatMap(entry => {
              const location = byId.get(entry.id);
              const toolNames = location?.toolNames || [];
              const toolIds = location?.toolIds || [];
              const toolLink = (toolName: string, toolId: string | undefined) =>
                onSelectTool && toolId
                  ? <Link component="button" variant="body2" onClick={() => onSelectTool(toolId)}>{toolName}</Link>
                  : toolName;
              const hasChildren = locations.some(l => l.parentId === entry.id);
              if (!hasChildren && toolNames.length === 1 && toolNames[0] === location?.name) {
                return [
                  <Typography key={entry.id} variant="body2" color="textSecondary">
                    {"—".repeat(entry.depth)}{entry.depth ? " " : ""}Tool: {toolLink(toolNames[0], toolIds[0])}
                  </Typography>,
                ];
              }
              return [
                <Typography key={entry.id} variant="body2">{entry.label}</Typography>,
                ...toolNames.map((toolName, i) => (
                  <Typography key={`${entry.id}-tool-${i}`} variant="body2" color="textSecondary">
                    {"—".repeat(entry.depth + 1)} Tool: {toolLink(toolName, toolIds[i])}
                  </Typography>
                )),
              ];
            })}
          </div>
        )}
      </Grid>
      {pending && effectiveBox && (
        <LocationFormModal
          initialName=""
          // Only tools that don't already have a location -- picking an
          // already-placed tool here would just reassign it to this new
          // marker, silently leaving its old marker behind with the same
          // name but no tool link.
          linkableTools={shopTools.filter(t => !t.locationId || t.id === preset?.toolId)}
          initialToolId={preset?.toolId}
          onClose={() => { setPending(null); setPendingLocationId(null); }}
          onSave={async (name, kind, toolId) => {
            let locationId = pendingLocationId;
            if (!locationId) {
              const result = await create.call({ body: { name, shopId, kind, parentId: currentParent?.id, ...pending } });
              if (isApiErrorResponse(result)) return;
              locationId = result.data.id;
              setPendingLocationId(locationId);
            }
            if (toolId) {
              const toolResult = await toggleTool.call({ id: toolId, body: { locationId } });
              if (isApiErrorResponse(toolResult)) return;
            }
            setPending(null);
            setPendingLocationId(null);
          }}
          loading={create.isRequesting || toggleTool.isRequesting}
          error={create.error || toggleTool.error}
        />
      )}
      {editing && (
        <LocationFormModal
          initialName={editing.name}
          initialKind={editing.kind}
          onClose={() => setEditing(null)}
          onSave={(name, kind) => update.call({ id: editing.id, body: { name, kind } })}
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

export default ShopLocationMap;
