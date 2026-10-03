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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import FormModal from "ui/common/FormModal";
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
  Box, Point, FULL_FLOOR_BOX, FLOOR_NAMES, floorLabel, sortFloors, paddedBox, centroid,
} from "./floorMapGeometry";
import { boundingBoxOf } from "./locationGeometry";
import { LOCATION_KIND_OPTIONS, colorForKind, FALLBACK_NESTED_COLOR, TOOL_MARKER_COLOR } from "./locationKinds";
import { MARKER_ICONS } from "./markerIcons";
import FloorMap, { MapShape, MapMarker } from "./FloorMap";

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

// Deleting a location cascades server-side to every descendant at any
// depth (child, that child's own children, ...) and unassigns any tool
// placed anywhere in the subtree -- this walks the same tree client-side
// purely to describe that impact to the admin before they confirm, using
// data already loaded (no extra request).
const describeDeletionImpact = (locationId: string, locations: Location[]) => {
  const byParent = new Map<string, Location[]>();
  locations.forEach(l => {
    if (l.parentId) byParent.set(l.parentId, [...(byParent.get(l.parentId) || []), l]);
  });
  const root = locations.find(l => l.id === locationId);
  const descendantLines: string[] = [];
  const toolNames: string[] = root?.toolNames ? [...root.toolNames] : [];
  const walk = (id: string, depth: number) => {
    (byParent.get(id) || []).forEach(child => {
      descendantLines.push(`${"—".repeat(depth)} ${child.name}`);
      if (child.toolNames?.length) toolNames.push(...child.toolNames);
      walk(child.id, depth + 1);
    });
  };
  walk(locationId, 1);
  return { descendantLines, toolNames };
};

interface LocationFormValues {
  name: string;
  kind?: string;
  toolId?: string;
  icon?: string;
  floorName?: string;
}

const LocationFormModal: React.FC<{
  initialName: string;
  initialKind?: string;
  initialIcon?: string;
  // Offered only for a top-level location -- a nested one always follows its
  // parent's floor.
  initialFloor?: string;
  onClose: () => void;
  onSave: (values: LocationFormValues) => void;
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
  initialName, initialKind, initialIcon, initialFloor, onClose, onSave, onDelete, onRedraw, onAdjustCorners, onZoomIn,
  locationId, tools, onToggleTool, linkableTools, initialToolId, loading, error
}) => {
  const [kind, setKind] = React.useState(initialKind || "");
  const [icon, setIcon] = React.useState(initialIcon || "");
  const [floor, setFloor] = React.useState(initialFloor || "");
  const [toolId, setToolId] = React.useState(initialToolId || "");
  const [name, setName] = React.useState(
    initialName || linkableTools?.find(t => t.id === initialToolId)?.name || ""
  );
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      kind: kind || undefined,
      toolId: toolId || undefined,
      icon: icon || undefined,
      floorName: initialFloor !== undefined && floor !== initialFloor ? floor : undefined,
    });
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="textSecondary">Type</Typography>
          <Select native fullWidth value={kind} onChange={e => setKind((e.target as HTMLSelectElement).value)}>
            {LOCATION_KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="textSecondary">Marker icon</Typography>
          <Select native fullWidth value={icon} onChange={e => setIcon((e.target as HTMLSelectElement).value)}>
            <option value="">Default (pin)</option>
            {MARKER_ICONS.filter(i => i.value !== "pin").map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </Select>
        </Grid>
        {initialFloor !== undefined && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="textSecondary">Floor</Typography>
            <Select native fullWidth value={floor} onChange={e => setFloor((e.target as HTMLSelectElement).value)}>
              {FLOOR_NAMES.map(f => <option key={f} value={f}>{floorLabel(f)}</option>)}
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

// Single map component for one shop, shown on its Workshops page to every
// member. Shows the shop's own areas, every nested cabinet/shelf/tool inside
// them (all stored in absolute floor-relative percent, so no recursive
// resolution is needed to place any of it correctly), and the tool-name
// hierarchy list below it. A shop can span floors: each location is drawn on
// its own floor, and a floor switch appears when more than one applies. When
// `canEdit` is true (admin/board, or a shop RM for this specific shop -- same
// rule the API itself already enforces), it also gains the draw/place/zoom/
// edit tools.
//
// The map itself is Leaflet (FloorMap): pan, pinch/button zoom, and every
// click/shape/marker position is converted by one shared helper, instead of
// hand-rolled percent math over an injected SVG.
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
  const shopFloor = shop?.floorName;

  const { data: locations = [], refresh } = useReadTransaction(
    canEdit ? adminListLocations : listLocations, { shopIds: [shopId] }, !shopId,
    `shop-location-map-${shopId}-${canEdit}`, true
  );
  const byId = React.useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
  const floorOf = React.useCallback((l: Location) => l.floorName || shopFloor || "1", [shopFloor]);

  // Only fetched when editing is possible -- the "place a specific tool
  // here" picker and "Tools here" checklist both need the full tool list
  // (including which already have a locationId), not just the toolNames
  // already embedded on each location in the read-only response.
  const { data: shopTools = [], refresh: refreshTools } = useReadTransaction(
    listTools, { shopId }, !canEdit || !shopId, `admin-tools-for-map-${shopId}`, true
  );

  const [shopColors, setShopColors] = React.useState<Record<string, string>>({});
  const [floorChoice, setFloorChoice] = React.useState("");
  const [zoomStack, setZoomStack] = React.useState<Location[]>([]);
  const [drawing, setDrawing] = React.useState(false);
  const [drawPoints, setDrawPoints] = React.useState<Point[]>([]);
  const [pending, setPending] = React.useState<PendingPlacement | null>(null);
  const [pendingLocationId, setPendingLocationId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [redrawing, setRedrawing] = React.useState<{ id: string; isPin: boolean } | null>(null);
  const [adjusting, setAdjusting] = React.useState<{ id: string; points: Point[] } | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Floors this shop has something on; an editor can add to any floor.
  const floorOptions = React.useMemo(() => {
    if (canEdit) return [...FLOOR_NAMES] as string[];
    const found = new Set(locations.map(floorOf));
    if (shopFloor) found.add(shopFloor);
    return sortFloors(Array.from(found));
  }, [canEdit, locations, floorOf, shopFloor]);
  const floor = floorChoice && floorOptions.includes(floorChoice)
    ? floorChoice
    : (shopFloor && floorOptions.includes(shopFloor) ? shopFloor : floorOptions[0] || "1");

  const floorLocations = React.useMemo(() => locations.filter(l => floorOf(l) === floor), [locations, floorOf, floor]);

  const currentParent = zoomStack[zoomStack.length - 1];
  const topLevelLocations = floorLocations.filter(l => !l.parentId);
  const baseBox = unionBoundingBox(topLevelLocations);
  // The area to bring into view: the whole shop's extent on this floor, or
  // (while zoomed in) one location's own extent. The view refits only when
  // the floor or zoom level changes -- not on every edit -- so the map never
  // jumps away while you are placing things.
  const fitBox: Box = zoomStack.length
    ? paddedBox(boundingBoxOf(currentParent))
    : (baseBox ? paddedBox(baseBox) : FULL_FLOOR_BOX);
  const fitKey = `${shopId}|${floor}|${currentParent?.id || ""}|${baseBox ? "data" : "empty"}`;

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

  // "Find tool"/"Place on map" land here from elsewhere on the page --
  // bring the map into view the same way WorkshopTools scrolls to a row,
  // and switch to the floor that tool is on.
  React.useEffect(() => {
    if (!highlightToolId && !preset) return;
    wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightToolId, preset]);
  React.useEffect(() => {
    if (!highlightToolId) return;
    const holder = locations.find(l => l.toolIds?.includes(highlightToolId));
    if (holder) setFloorChoice(floorOf(holder));
  }, [highlightToolId, locations, floorOf]);

  // Switching floor or zoom level drops any in-progress drawing/open form
  // rather than letting it apply to the wrong context.
  React.useEffect(() => {
    setDrawing(false);
    setDrawPoints([]);
    setPending(null);
    setPendingLocationId(null);
    setEditing(null);
    setRedrawing(null);
    setAdjusting(null);
  }, [floor, zoomStack.length, currentParent?.id]);
  React.useEffect(() => { setZoomStack([]); }, [floor, shopId]);

  const shopColor = (shop?.colorId && shopColors[shop.colorId]) || "#1976d2";
  const busy = drawing || !!redrawing || !!adjusting;

  // Everything drawn on this floor: a top-level location keeps its shop's
  // own color for identification; anything nested gets a fixed kind color
  // (or the reserved tool color if it holds a tool) so it reads as "an
  // object" regardless of which shop's color it sits inside.
  const { shapes, markers } = React.useMemo(() => {
    const shapeList: MapShape[] = [];
    const markerList: MapMarker[] = [];
    if (currentParent?.shapePoints && currentParent.shapePoints.length >= 3) {
      shapeList.push({ id: `frame-${currentParent.id}`, points: currentParent.shapePoints, color: "#1976d2", outline: true });
    }
    floorLocations.forEach(location => {
      if (adjusting?.id === location.id) return;
      // The location you zoomed into gets its own outline above instead of
      // a normal filled overlay (which would otherwise double-render it).
      if (currentParent?.id === location.id) return;
      const isNested = !!location.parentId;
      const hasTool = isNested && !!location.toolNames?.length;
      const color = hasTool
        ? TOOL_MARKER_COLOR
        : isNested ? colorForKind(location.kind, FALLBACK_NESTED_COLOR) : shopColor;
      const label = location.toolNames?.length
        ? `${location.name} — ${location.toolNames.join(", ")}`
        : location.name;
      const isActive = canEdit && !busy && (location.parentId || undefined) === currentParent?.id;
      const onClick = isActive ? () => setEditing(location) : undefined;
      const isHighlighted = !!highlightToolId && !!location.toolIds?.includes(highlightToolId);

      if (location.shapePoints && location.shapePoints.length >= 3) {
        shapeList.push({ id: location.id, points: location.shapePoints, color, opacity: isNested ? 0.55 : 0.3, label, onClick });
        // A shape only gets a marker when it has its own icon or is the one
        // being found, so plain areas stay uncluttered.
        if (location.icon || isHighlighted) {
          const center = centroid(location.shapePoints);
          markerList.push({ id: `${location.id}-marker`, x: center.x, y: center.y, color, icon: location.icon, label, highlighted: isHighlighted, onClick });
        }
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        markerList.push({ id: location.id, x: location.xPct, y: location.yPct, color, icon: location.icon, label, highlighted: isHighlighted, onClick });
      }
    });
    if (adjusting) {
      shapeList.push({ id: "adjust-preview", points: adjusting.points, color: "#d32f2f", opacity: 0.25 });
    }
    return { shapes: shapeList, markers: markerList };
  }, [floorLocations, currentParent, adjusting, canEdit, busy, highlightToolId, shopColor]);

  const handleMapClick = (point: Point) => {
    if (drawing) {
      setDrawPoints(points => [...points, point]);
      return;
    }
    if (adjusting) return;
    if (redrawing?.isPin) {
      update.call({ id: redrawing.id, body: { xPct: point.x, yPct: point.y } });
      return;
    }
    setPending({ xPct: point.x, yPct: point.y });
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

  if (!shopFloor) return null;

  const hasAnything = locations.length > 0;

  return (
    <Grid container spacing={1}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="subtitle2" gutterBottom>{shopName} map</Typography>
        {!hasAnything && !canEdit ? (
          <Typography variant="body2" color="textSecondary">
            No location map set up for this shop yet.
          </Typography>
        ) : (
          <>
            {floorOptions.length > 1 && (
              <ToggleButtonGroup size="small" exclusive value={floor} aria-label="Floor" sx={{ mb: 1, maxWidth: "100%" }}
                onChange={(_e, value) => { if (value) setFloorChoice(value); }}>
                {floorOptions.map(f => <ToggleButton key={f} value={f}>{floorLabel(f)}</ToggleButton>)}
              </ToggleButtonGroup>
            )}
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
                  : `Showing the ${floorLabel(floor)}. Click "Draw area" to outline a boundary, or click anywhere else to drop a pin for a smaller item. Use the +/- buttons or pinch to zoom.`}
              </Typography>
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
            <div ref={wrapperRef}>
              <FloorMap
                floorName={floor}
                fitBox={fitBox}
                fitKey={fitKey}
                shapes={shapes}
                markers={markers}
                draftPoints={drawing ? drawPoints : undefined}
                adjustPoints={adjusting?.points}
                label={`${shopName} map, ${floorLabel(floor)}`}
                onAdjustPoint={(index, point) => setAdjusting(current => current && {
                  ...current, points: current.points.map((p, i) => (i === index ? point : p)),
                })}
                onMapClick={canEdit ? handleMapClick : undefined}
              />
            </div>
            {/* Hints sit BELOW the map: their text changes length as points are
                placed, and anything above the map would push it away from the
                cursor in the middle of a click sequence. */}
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
      {pending && (
        <LocationFormModal
          initialName=""
          // Only tools that don't already have a location -- picking an
          // already-placed tool here would just reassign it to this new
          // marker, silently leaving its old marker behind with the same
          // name but no tool link.
          linkableTools={shopTools.filter(t => !t.locationId || t.id === preset?.toolId)}
          initialToolId={preset?.toolId}
          onClose={() => { setPending(null); setPendingLocationId(null); }}
          onSave={async ({ name, kind, toolId, icon }) => {
            let locationId = pendingLocationId;
            if (!locationId) {
              const result = await create.call({
                body: { name, shopId, kind, icon, floorName: floor, parentId: currentParent?.id, ...pending },
              });
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
          initialIcon={editing.icon}
          initialFloor={editing.parentId ? undefined : floorOf(editing)}
          onClose={() => setEditing(null)}
          onSave={({ name, kind, icon, floorName }) => update.call({
            id: editing.id,
            // An empty icon/kind must be sent as "" to clear it server-side.
            body: { name, kind: kind ?? "", icon: icon ?? "", ...(floorName ? { floorName } : {}) },
          })}
          onDelete={() => {
            const { descendantLines, toolNames } = describeDeletionImpact(editing.id, locations);
            const lines = [`Delete "${editing.name}"?`];
            if (descendantLines.length) {
              lines.push(
                "",
                "This will also permanently delete everything nested inside it:",
                ...descendantLines
              );
            }
            if (toolNames.length) {
              lines.push("", `These tools will be unassigned (not deleted): ${toolNames.join(", ")}`);
            }
            if (!window.confirm(lines.join("\n"))) return;
            remove.call({ id: editing.id });
          }}
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
