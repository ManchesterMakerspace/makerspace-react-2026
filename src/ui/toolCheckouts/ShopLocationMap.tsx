import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { listLocations } from "api/locations";
import { listGoogleCalendarColors } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";
import { flattenTree } from "./locationTree";
import { Location } from "app/entities/toolCheckout";

// Same per-floor SVG convention as ShopMapManager/ShopMapView.
const floorPlanUrl = (floorName: string) => `/assets/shopFloorPlans/floor-${floorName}.svg`;
const floorPlanFallbackUrl = "/assets/shopFloorPlans/placeholder.svg";

const ZOOM_PADDING_PCT = 5;

// Bounding box of a shop's own top-level locations, in floor-relative
// percent -- only top-level locations contribute, since nested
// cabinets/shelves are shown as a text list below rather than drawn (their
// stored percentages are relative to their own parent, not the floor; see
// the remap note below for why that matters).
const boundingBoxOf = (locations: Location[]) => {
  const xs: number[] = [], ys: number[] = [];
  locations.forEach(l => {
    if (l.shapePoints?.length) l.shapePoints.forEach(p => { xs.push(p.x); ys.push(p.y); });
    else if (l.xPct != null && l.yPct != null) { xs.push(l.xPct); ys.push(l.yPct); }
  });
  if (!xs.length) return null;
  return {
    minX: Math.max(0, Math.min(...xs) - ZOOM_PADDING_PCT),
    maxX: Math.min(100, Math.max(...xs) + ZOOM_PADDING_PCT),
    minY: Math.max(0, Math.min(...ys) - ZOOM_PADDING_PCT),
    maxY: Math.min(100, Math.max(...ys) + ZOOM_PADDING_PCT),
  };
};

const remap = (pct: number, min: number, max: number) => ((pct - min) / (max - min)) * 100;

// Read-only, zoomed-to-one-shop map -- embedded on the Workshops page's
// Details tab, distinct from ShopMapView (every shop on a floor, at
// overview scale) and ShopMapManager (the interactive admin editor). Crops
// the floor plan to just this shop's own area and remaps its top-level
// locations' stored floor-relative percentages into that cropped frame, so
// the overlay stays aligned with the visibly-zoomed SVG underneath it.
const ShopLocationMap: React.FC<{ shopId: string; shopName: string }> = ({ shopId, shopName }) => {
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

  const topLevelLocations = locations.filter(l => !l.parentId);
  const box = boundingBoxOf(topLevelLocations);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const svgRoot = wrapper.querySelector(":scope > svg") as SVGSVGElement | null;
    const baseVal = svgRoot?.viewBox?.baseVal;
    if (!svgRoot || !baseVal || !box) return;
    const cropped = {
      x: baseVal.x + (box.minX / 100) * baseVal.width,
      y: baseVal.y + (box.minY / 100) * baseVal.height,
      width: ((box.maxX - box.minX) / 100) * baseVal.width,
      height: ((box.maxY - box.minY) / 100) * baseVal.height,
    };
    svgRoot.setAttribute("viewBox", `${cropped.x} ${cropped.y} ${cropped.width} ${cropped.height}`);
    // Without this, the floor plan's fixed absolute width/height attributes
    // (not its viewBox) drive the wrapper's on-page aspect ratio via the
    // width:100%/height:auto CSS rule below, so a crop with a different
    // aspect ratio gets letterboxed by the default preserveAspectRatio
    // rather than stretched -- breaking the 0-100%-of-wrapper assumption
    // every remap() call here depends on.
    svgRoot.setAttribute("preserveAspectRatio", "none");
  }, [svgMarkup, box]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !box) return;
    wrapper.querySelectorAll("[data-shop-location]").forEach(el => el.remove());
    const color = (shop?.colorId && shopColors[shop.colorId]) || "#1976d2";
    topLevelLocations.forEach(location => {
      if (location.shapePoints && location.shapePoints.length >= 3) {
        const shape = document.createElement("div");
        shape.setAttribute("data-shop-location", location.id);
        shape.title = location.name;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${location.shapePoints.map(p =>
            `${remap(p.x, box.minX, box.maxX)}% ${remap(p.y, box.minY, box.maxY)}%`
          ).join(", ")})`,
          background: color,
          opacity: "0.3",
        });
        wrapper.appendChild(shape);
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        const dot = document.createElement("div");
        dot.setAttribute("data-shop-location", location.id);
        dot.title = location.name;
        Object.assign(dot.style, {
          position: "absolute",
          left: `${remap(location.xPct, box.minX, box.maxX)}%`,
          top: `${remap(location.yPct, box.minY, box.maxY)}%`,
          transform: "translate(-50%, -100%)",
          width: "14px",
          height: "14px",
          borderRadius: "50% 50% 50% 0",
          background: color,
        });
        wrapper.appendChild(dot);
      }
    });
  }, [svgMarkup, topLevelLocations, box, shop, shopColors]);

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
            <style>{"[data-shop-location-map-wrapper] > svg { width: 100% !important; height: auto !important; display: block !important; }"}</style>
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
            {flattenTree(locations).map(entry => (
              <Typography key={entry.id} variant="body2">{entry.label}</Typography>
            ))}
          </div>
        )}
      </Grid>
    </Grid>
  );
};

export default ShopLocationMap;
