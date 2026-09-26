import * as React from "react";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import { useCheckoutCatalog } from "./CheckoutCatalog";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { Location } from "app/entities/toolCheckout";
import { adminListLocations, adminCreateLocation, adminUpdateLocation, adminDeleteLocation } from "api/locations";

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

const LocationFormModal: React.FC<{
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
  onDelete?: () => void;
  loading: boolean;
  error: string;
}> = ({ initialName, onClose, onSave, onDelete, loading, error }) => {
  const [name, setName] = React.useState(initialName);
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
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
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const selectedShop = shops.find(s => s.id === shopId);
  const floorName = selectedShop?.floorName;

  const { data: locations = [], refresh, error: loadError } =
    useReadTransaction(adminListLocations, { shopId }, !shopId, `admin-locations-${shopId}`, true);

  const create = useWriteTransaction(adminCreateLocation, () => { refresh(); setPending(null); });
  const update = useWriteTransaction(adminUpdateLocation, () => { refresh(); setEditing(null); });
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
  }, [shopId]);

  // Re-applies highlights/pins whenever the map or the location list changes
  // -- not React-rendered JSX, since these need to live inside markup that
  // was injected via dangerouslySetInnerHTML.
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll("[data-location-pin]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-location-shape]").forEach(el => el.remove());
    wrapper.querySelectorAll("[data-location-highlighted]").forEach(el => {
      el.removeAttribute("data-location-highlighted");
      (el as unknown as SVGElement).style.outline = "";
    });
    locations.forEach(location => {
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
  }, [svgMarkup, locations]);

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
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const target = event.target as Element;

    const highlighted = target.closest("[data-location-highlighted]");
    if (highlighted) {
      const existing = locations.find(l => l.svgElementId === highlighted.id);
      if (existing) { setEditing(existing); return; }
    }

    const rect = wrapper.getBoundingClientRect();
    const xPct = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((event.clientY - rect.top) / rect.height) * 100);

    if (drawing) {
      setDrawPoints(points => [...points, { x: xPct, y: yPct }]);
      return;
    }

    setPending({ xPct, yPct });
  };

  const finishShape = () => {
    setPending({ shapePoints: drawPoints });
    setDrawPoints([]);
    setDrawing(false);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setDrawPoints([]);
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
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Floor {floorName} map -- shared with every other shop on this floor. {drawing
              ? `Click to place a point (${drawPoints.length} so far, need at least 3), then Finish shape.`
              : "Click \"Draw shop area\" to outline a shop's boundary, or click anywhere else to drop a point pin for a smaller item (cabinet, tool, fixture)."}
          </Typography>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {!drawing && (
              <Button variant="outlined" onClick={() => setDrawing(true)}>Draw shop area</Button>
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
          <div
            ref={wrapperRef}
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
          onSave={name => create.call({ body: { name, shopId, ...pending } })}
          loading={create.isRequesting}
          error={create.error}
        />
      )}
      {editing && (
        <LocationFormModal
          initialName={editing.name}
          onClose={() => setEditing(null)}
          onSave={name => update.call({ id: editing.id, body: { name } })}
          onDelete={() => remove.call({ id: editing.id })}
          loading={update.isRequesting || remove.isRequesting}
          error={update.error || remove.error}
        />
      )}
    </Grid>
  );
};

export default ShopMapManager;
