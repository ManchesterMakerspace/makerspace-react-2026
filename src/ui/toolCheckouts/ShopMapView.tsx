import * as React from "react";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";

import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { listLocations } from "api/locations";
import { listGoogleCalendarColors } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";

// Same per-floor SVG convention as the admin map editor (ShopMapManager) --
// kept as a separate small constant rather than a shared import, since it's
// two lines and this component has no other dependency on that one.
const floorPlanUrl = (floorName: string) => `/assets/shopFloorPlans/floor-${floorName}.svg`;
const floorPlanFallbackUrl = "/assets/shopFloorPlans/placeholder.svg";

// Read-only, every-shop-at-once view for any member -- unlike the admin
// editor (ShopMapManager), which shows one shop at a time with the rest as
// dim reference context while you draw, this is the "just show me the whole
// floor" view: every shop's area rendered simultaneously in its own
// calendar color, so overlaps or gaps are visible at a glance.
const ShopMapView: React.FC = () => {
  const { data: shops = [] } = useCheckoutCatalog("shops");
  const floors = React.useMemo(
    () => Array.from(new Set(shops.map(s => s.floorName).filter((f): f is string => !!f))).sort(),
    [shops]
  );
  const [floorName, setFloorName] = React.useState("");
  React.useEffect(() => {
    if (!floorName && floors.length) setFloorName(floors[0]);
  }, [floors, floorName]);

  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [shopColors, setShopColors] = React.useState<Record<string, string>>({});
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const shopsOnFloor = shops.filter(s => s.floorName === floorName);
  const floorShopIds = shopsOnFloor.map(s => s.id);

  const { data: locations = [] } = useReadTransaction(
    listLocations, { shopIds: floorShopIds }, !floorShopIds.length,
    `member-locations-floor-${floorName}`, true
  );

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

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-shop-location]").forEach(el => el.remove());
    locations.forEach(location => {
      const ownerShop = shops.find(s => s.id === location.shopId);
      const color = (ownerShop?.colorId && shopColors[ownerShop.colorId]) || "#1976d2";
      const label = `${ownerShop?.name || "Shop"}: ${location.name}`;
      if (location.shapePoints && location.shapePoints.length >= 3) {
        const shape = document.createElement("div");
        shape.setAttribute("data-shop-location", location.id);
        shape.title = label;
        Object.assign(shape.style, {
          position: "absolute",
          inset: "0",
          clipPath: `polygon(${location.shapePoints.map(p => `${p.x}% ${p.y}%`).join(", ")})`,
          background: color,
          opacity: "0.35",
        });
        wrapper.appendChild(shape);
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        const dot = document.createElement("div");
        dot.setAttribute("data-shop-location", location.id);
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
        });
        wrapper.appendChild(dot);
      }
    });
  }, [svgMarkup, locations, shops, shopColors]);

  return (
    <Grid container spacing={2}>
      {floors.length > 1 && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Select native fullWidth value={floorName} onChange={e => setFloorName((e.target as HTMLSelectElement).value)}>
            {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
          </Select>
        </Grid>
      )}
      {svgMarkup && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Floor {floorName} -- every shop's area shown at once, each in its own color. Hover a shaded area for its name.
          </Typography>
          <style>{"[data-shop-map-wrapper] > svg { width: 100% !important; height: auto !important; display: block !important; }"}</style>
          <div
            ref={wrapperRef}
            data-shop-map-wrapper
            style={{ position: "relative", border: "1px solid #ccc", maxWidth: 600 }}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
            {shopsOnFloor.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: (s.colorId && shopColors[s.colorId]) || "#1976d2",
                  border: "1px solid rgba(0,0,0,.2)", display: "inline-block",
                }} />
                <Typography variant="caption">{s.name}</Typography>
              </div>
            ))}
          </div>
        </Grid>
      )}
    </Grid>
  );
};

export default ShopMapView;
