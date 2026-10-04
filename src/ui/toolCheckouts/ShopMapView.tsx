import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { listLocations } from "api/locations";
import { listGoogleCalendarColors } from "api/toolCheckouts";
import { FALLBACK_COLORS } from "./ShopColorField";
import { FULL_FLOOR_BOX, floorLabel, sortFloors, centroid } from "./floorMapGeometry";
import FloorMap, { MapShape, MapMarker } from "./FloorMap";

// Read-only, every-shop-at-once view for any member -- unlike
// ShopLocationMap, which shows one shop's own area (with its full edit
// tooling for an admin/RM), this is the "just show me the whole floor"
// view: every shop's area rendered simultaneously in its own calendar
// color, so overlaps or gaps are visible at a glance. A shop that spans
// floors (e.g. Facilities) appears on each floor it has an area on.
const ShopMapView: React.FC = () => {
  const { data: shops = [] } = useCheckoutCatalog("shops");
  const shopIds = React.useMemo(() => shops.map(s => s.id), [shops]);

  const { data: locations = [] } = useReadTransaction(
    listLocations, { shopIds }, !shopIds.length, "member-locations-all-floors", true
  );

  // Top-level locations only: this overview is "every shop's own area at a
  // glance," not a room-by-room breakdown -- the Workshops page's
  // ShopLocationMap is where nested contents are drawn.
  const topLevel = React.useMemo(() => locations.filter(l => !l.parentId), [locations]);
  const shopFloor = React.useMemo(() => new Map(shops.map(s => [s.id, s.floorName || "1"])), [shops]);
  const floorOf = React.useCallback(
    (l: { floorName?: string; shopId: string }) => l.floorName || shopFloor.get(l.shopId) || "1",
    [shopFloor]
  );

  const floors = React.useMemo(
    () => sortFloors(Array.from(new Set([...shops.map(s => s.floorName || "1"), ...topLevel.map(floorOf)]))),
    [shops, topLevel, floorOf]
  );
  const [floorChoice, setFloorChoice] = React.useState("");
  const floorName = floorChoice && floors.includes(floorChoice) ? floorChoice : floors[0] || "";

  const [shopColors, setShopColors] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let active = true;
    listGoogleCalendarColors().then(result => {
      if (!active) return;
      const list = result.data?.colors || FALLBACK_COLORS;
      setShopColors(Object.fromEntries(list.map(c => [c.id, c.backgroundColor])));
    });
    return () => { active = false; };
  }, []);

  const colorOf = React.useCallback((shopId: string) => {
    const owner = shops.find(s => s.id === shopId);
    return (owner?.colorId && shopColors[owner.colorId]) || "#1976d2";
  }, [shops, shopColors]);

  const onFloor = React.useMemo(() => topLevel.filter(l => floorOf(l) === floorName), [topLevel, floorOf, floorName]);
  const shopsOnFloor = React.useMemo(() => {
    const ids = new Set(onFloor.map(l => l.shopId));
    shops.forEach(s => { if ((s.floorName || "1") === floorName && !topLevel.some(l => l.shopId === s.id)) ids.add(s.id); });
    return shops.filter(s => ids.has(s.id));
  }, [shops, onFloor, topLevel, floorName]);

  const { shapes, markers } = React.useMemo(() => {
    const shapeList: MapShape[] = [];
    const markerList: MapMarker[] = [];
    onFloor.forEach(location => {
      const ownerName = shops.find(s => s.id === location.shopId)?.name || "Shop";
      const color = colorOf(location.shopId);
      const label = `${ownerName}: ${location.name}`;
      if (location.shapePoints && location.shapePoints.length >= 3) {
        shapeList.push({ id: location.id, points: location.shapePoints, color, opacity: 0.35, label });
        if (location.icon) {
          const center = centroid(location.shapePoints);
          markerList.push({ id: `${location.id}-marker`, x: center.x, y: center.y, color, icon: location.icon, label });
        }
      } else if (location.xPct != null && location.yPct != null) {
        markerList.push({ id: location.id, x: location.xPct, y: location.yPct, color, icon: location.icon, label });
      }
    });
    return { shapes: shapeList, markers: markerList };
  }, [onFloor, shops, colorOf]);

  if (!floorName) return null;

  return (
    <Grid container spacing={2}>
      {floors.length > 1 && (
        <Grid size={{ xs: 12 }}>
          <ToggleButtonGroup size="small" exclusive value={floorName} aria-label="Floor" sx={{ maxWidth: "100%", "& .MuiToggleButton-root": { minHeight: { xs: 44, sm: 0 } } }}
            onChange={(_e, value) => { if (value) setFloorChoice(value); }}>
            {floors.map(f => <ToggleButton key={f} value={f}>{floorLabel(f)}</ToggleButton>)}
          </ToggleButtonGroup>
        </Grid>
      )}
      <Grid size={{ xs: 12 }}>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {floorLabel(floorName)} -- every shop's area shown at once, each in its own color. Hover or tap a shaded area for its name.
        </Typography>
        <FloorMap floorName={floorName} fitBox={FULL_FLOOR_BOX} fitKey={floorName} shapes={shapes} markers={markers}
          label={`All shops, ${floorLabel(floorName)}`} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {shopsOnFloor.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                background: colorOf(s.id),
                border: "1px solid rgba(0,0,0,.2)", display: "inline-block",
              }} />
              <Typography variant="caption">{s.name}</Typography>
            </div>
          ))}
        </div>
      </Grid>
    </Grid>
  );
};

export default ShopMapView;
