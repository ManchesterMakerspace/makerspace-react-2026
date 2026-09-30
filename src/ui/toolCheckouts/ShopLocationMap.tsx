import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";

import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { listLocations } from "api/locations";
import { listGoogleCalendarColors } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";
import { flattenTree } from "./locationTree";
import { paddedBox, cropViewBoxToBox, resolveAbsolutePoint } from "./locationGeometry";
import { colorForKind, labelForKind, FALLBACK_NESTED_COLOR, TOOL_MARKER_COLOR } from "./locationKinds";
import { Location } from "app/entities/toolCheckout";

// Same per-floor SVG convention as ShopMapManager/ShopMapView.
const floorPlanUrl = (floorName: string) => `/assets/shopFloorPlans/floor-${floorName}.svg`;
const floorPlanFallbackUrl = "/assets/shopFloorPlans/placeholder.svg";

// Bounding box of a shop's own top-level locations, in floor-relative
// percent -- only top-level locations set the crop (a nested item's own
// stored percentages aren't floor-relative, so they can't contribute
// directly; resolveAbsolutePoint below converts them before they're
// rendered, but the crop itself is sized off the top-level shape/pins,
// which comfortably contain whatever's nested inside them).
const unionBoundingBox = (locations: Location[]) => {
  const xs: number[] = [], ys: number[] = [];
  locations.forEach(l => {
    if (l.shapePoints?.length) l.shapePoints.forEach(p => { xs.push(p.x); ys.push(p.y); });
    else if (l.xPct != null && l.yPct != null) { xs.push(l.xPct); ys.push(l.yPct); }
  });
  if (!xs.length) return null;
  return paddedBox({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
};

const remap = (pct: number, min: number, max: number) => ((pct - min) / (max - min)) * 100;

// Read-only, zoomed-to-one-shop map -- embedded on the Workshops page's
// Details tab, distinct from ShopMapView (every shop on a floor, at
// overview scale) and ShopMapManager (the interactive admin editor). Crops
// the floor plan to just this shop's own area, resolves every location
// (including ones nested several levels deep) back to floor-relative
// percent, then remaps into that cropped frame, so the overlay -- shop
// boundary, cabinets, shelves, whatever's nested inside them -- stays
// aligned with the visibly-zoomed SVG underneath it.
const ShopLocationMap: React.FC<{
  shopId: string;
  shopName: string;
  // Lets a click on a tool's name jump straight to that tool on the
  // Workshops page's Tools tab, where a member can actually act on it
  // (request checkout, reserve, etc.) instead of just seeing its name.
  onSelectTool?: (toolId: string) => void;
  // The reverse direction: "Find tool" on a Tools-tab row lands here with
  // this set, so the map can ring whichever marker holds that tool.
  highlightToolId?: string;
}> = ({ shopId, shopName, onSelectTool, highlightToolId }) => {
  const { data: shops = [] } = useCheckoutCatalog("shops");
  const shop = shops.find(s => s.id === shopId);
  const floorName = shop?.floorName;

  const { data: locations = [] } = useReadTransaction(
    listLocations, { shopIds: [shopId] }, !shopId, `shop-location-map-${shopId}`, true
  );

  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [shopColors, setShopColors] = React.useState<Record<string, string>>({});
  const wrapperRef = React.useRef<HTMLDivElement>(null);

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

  // "Find tool" on the Tools tab sets this and switches to this tab -- pull
  // the map into view the same way the reverse direction (WorkshopTools)
  // scrolls to a specific row.
  React.useEffect(() => {
    if (!highlightToolId) return;
    wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightToolId]);

  const topLevelLocations = locations.filter(l => !l.parentId);
  const box = unionBoundingBox(topLevelLocations);
  const byId = React.useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const svgRoot = wrapper.querySelector(":scope > svg") as SVGSVGElement | null;
    const baseVal = svgRoot?.viewBox?.baseVal;
    if (!svgRoot || !baseVal || !box) return;
    const cropped = cropViewBoxToBox(
      { x: baseVal.x, y: baseVal.y, width: baseVal.width, height: baseVal.height },
      box
    );
    svgRoot.setAttribute("viewBox", `${cropped.x} ${cropped.y} ${cropped.width} ${cropped.height}`);
    // Without this, the floor plan's fixed absolute width/height attributes
    // (not its viewBox) drive the wrapper's on-page aspect ratio via the
    // width:100%/height:auto CSS rule below, so a crop with a different
    // aspect ratio gets letterboxed by the default preserveAspectRatio
    // rather than stretched -- breaking the 0-100%-of-wrapper assumption
    // every remap() call here depends on.
    svgRoot.setAttribute("preserveAspectRatio", "none");
    // No dependency array -- React can re-apply dangerouslySetInnerHTML on
    // this wrapper on any unrelated re-render (confirmed via direct
    // instrumentation while building the admin editor's equivalent zoom
    // feature -- see ShopMapManager.tsx's crop effect for the full story),
    // silently resetting the injected SVG's viewBox back to its embedded
    // default. Reasserting the crop every render is cheap and removes any
    // dependence on `box` happening to be a fresh object each time.
  });

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !box) return;
    wrapper.querySelectorAll("[data-shop-location], [data-shop-location-ring]").forEach(el => el.remove());
    const shopColor = (shop?.colorId && shopColors[shop.colorId]) || "#1976d2";
    // Every location, not just top-level -- a nested cabinet/shelf/table's
    // own shapePoints/pin are stored relative to its immediate parent, not
    // the floor, so resolveAbsolutePoint composes them back through every
    // ancestor (the same math the admin editor's zoomed canvas uses when
    // placing them) before the usual floor-percent -> crop-percent remap.
    locations.forEach(location => {
      // A nested item (cabinet, table, tool) rendered in the same shop
      // color as its containing room at the same opacity would be
      // indistinguishable from it wherever they overlap -- unlike the admin
      // editor, which only ever shows one zoom level at a time, this view
      // flattens every nesting level onto one image. A fixed, non-shop
      // color at a higher opacity keeps anything nested clearly readable
      // as "an object", regardless of which shop's color it sits inside.
      // A NESTED location holding a tool gets the reserved tool color ahead
      // of its own kind color -- a tool's exact spot needs to be
      // unmistakable regardless of what kind of container it sits inside.
      // Deliberately not applied at the top level: the shop's own boundary
      // shape needs to stay in the shop's own color for shop identification
      // even when a tool happens to be attached directly to the room
      // itself rather than to a dedicated spot within it.
      const isNested = !!location.parentId;
      const hasTool = isNested && !!location.toolNames?.length;
      const color = hasTool
        ? TOOL_MARKER_COLOR
        : isNested ? colorForKind(location.kind, FALLBACK_NESTED_COLOR) : shopColor;
      const opacity = isNested ? "0.55" : "0.3";
      const label = location.toolNames?.length
        ? `${location.name} — ${location.toolNames.join(", ")}`
        : location.name;
      const isHighlighted = !!highlightToolId && !!location.toolIds?.includes(highlightToolId);
      // "Find tool" on the Tools tab lands here with this location's tool
      // highlighted -- an animated ring, centered on the marker's own
      // position, so it's unmistakable at a glance without hiding anything
      // else on the map.
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
        const absPoints = location.shapePoints.map(p =>
          resolveAbsolutePoint(location.parentId, p.x, p.y, byId)
        );
        const shape = document.createElement("div");
        shape.setAttribute("data-shop-location", location.id);
        shape.title = label;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${absPoints.map(p =>
            `${remap(p.x, box.minX, box.maxX)}% ${remap(p.y, box.minY, box.maxY)}%`
          ).join(", ")})`,
          background: color,
          opacity,
        });
        wrapper.appendChild(shape);
        if (isHighlighted) {
          const centerX = absPoints.reduce((sum, p) => sum + p.x, 0) / absPoints.length;
          const centerY = absPoints.reduce((sum, p) => sum + p.y, 0) / absPoints.length;
          addRing(remap(centerX, box.minX, box.maxX), remap(centerY, box.minY, box.maxY));
        }
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        const abs = resolveAbsolutePoint(location.parentId, location.xPct, location.yPct, byId);
        const dot = document.createElement("div");
        dot.setAttribute("data-shop-location", location.id);
        dot.title = label;
        Object.assign(dot.style, {
          position: "absolute",
          left: `${remap(abs.x, box.minX, box.maxX)}%`,
          top: `${remap(abs.y, box.minY, box.maxY)}%`,
          transform: "translate(-50%, -100%)",
          width: "14px",
          height: "14px",
          borderRadius: "50% 50% 50% 0",
          background: color,
          opacity,
        });
        wrapper.appendChild(dot);
        if (isHighlighted) {
          // The pin's own box is anchored bottom-center (translate -50%,
          // -100%) to look like a map pin -- the ring centers on that same
          // anchor point, not the div's own top-left.
          addRing(remap(abs.x, box.minX, box.maxX), remap(abs.y, box.minY, box.maxY));
        }
      }
    });
    // No dependency array -- see the crop effect above.
  });

  if (!floorName) return null;

  return (
    <Grid container spacing={1}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="subtitle2" gutterBottom>{shopName} map</Typography>
        {!svgMarkup || !box ? (
          <Typography variant="body2" color="textSecondary">
            No location map set up for this shop yet.
          </Typography>
        ) : (
          <>
            <style>{"[data-shop-location-map-wrapper] > svg { width: 100% !important; height: auto !important; display: block !important; } @keyframes shop-location-map-ring-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.25); opacity: 0.6; } }"}</style>
            <div
              ref={wrapperRef}
              data-shop-location-map-wrapper
              style={{ position: "relative", border: "1px solid #ccc", maxWidth: 420 }}
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
              // A location that exists purely to mark one tool's exact spot
              // -- no children, exactly one tool, sharing its name -- is
              // exactly what "place a specific tool here" creates (it
              // prefills the marker's name from the tool). Showing the
              // location's own row above an identically-named tool row is
              // pure redundancy, so collapse the two into one "Tool:" line
              // at the location's own depth instead.
              if (!hasChildren && toolNames.length === 1 && toolNames[0] === location?.name) {
                return [
                  <Typography key={entry.id} variant="body2" color="textSecondary">
                    {"—".repeat(entry.depth)}{entry.depth ? " " : ""}Tool: {toolLink(toolNames[0], toolIds[0])}
                  </Typography>,
                ];
              }
              return [
                <Typography key={entry.id} variant="body2">{entry.label}</Typography>,
                // "Tool:" (not another dash level) so a tool sharing its
                // location's name can't be mistaken for a real nested
                // sub-location.
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
    </Grid>
  );
};

export default ShopLocationMap;
