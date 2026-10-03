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
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import NearMeIcon from "@mui/icons-material/NearMe";
import PlaceIcon from "@mui/icons-material/Place";
import PolylineIcon from "@mui/icons-material/Polyline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";

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
  Box, Point, FULL_FLOOR_BOX, FLOOR_NAMES, floorLabel, sortFloors, paddedBox, centroid, withMinSpan,
} from "./floorMapGeometry";
import { boundingBoxOf } from "./locationGeometry";
import { containingParentId, descendantIds, shapeAnchor } from "./locationNesting";
import { LOCATION_KIND_OPTIONS, KIND_LABELS, colorForKind, FALLBACK_NESTED_COLOR, TOOL_MARKER_COLOR } from "./locationKinds";
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

type Mode = "select" | "marker" | "area";

// Comfortable touch size on phones; desktop keeps the compact buttons.
const touchTarget = { minHeight: { xs: 44, sm: 0 } };

interface PendingPlacement {
  xPct?: number;
  yPct?: number;
  shapePoints?: Point[];
  // The area this lands inside, worked out from where it was placed. The
  // form shows it and lets the admin change it.
  autoParentId?: string;
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
  // "" means "not inside anything". Only present when the form offered a
  // choice.
  parentId?: string;
}

const LocationFormModal: React.FC<{
  initialName: string;
  initialKind?: string;
  initialIcon?: string;
  // Offered only for a top-level location -- a nested one always follows its
  // parent's floor.
  initialFloor?: string;
  // Areas this can sit inside (same floor, never itself or anything in it).
  parentChoices?: { id: string; label: string }[];
  initialParentId?: string;
  onClose: () => void;
  onSave: (values: LocationFormValues) => void;
  onDelete?: () => void;
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
  initialName, initialKind, initialIcon, initialFloor, parentChoices, initialParentId, onClose, onSave, onDelete,
  locationId, tools, onToggleTool, linkableTools, initialToolId, loading, error
}) => {
  const [kind, setKind] = React.useState(initialKind || "");
  const [icon, setIcon] = React.useState(initialIcon || "");
  const [floor, setFloor] = React.useState(initialFloor || "");
  const [parentId, setParentId] = React.useState(initialParentId || "");
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
      parentId: parentChoices ? parentId : undefined,
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
        {parentChoices && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="textSecondary">Inside</Typography>
            <Select native fullWidth value={parentId} onChange={e => setParentId((e.target as HTMLSelectElement).value)}>
              <option value="">— not inside anything —</option>
              {parentChoices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Grid>
        )}
        {initialFloor !== undefined && !parentId && (
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
// its own floor, and a floor switch appears when more than one applies.
//
// Editors (admin/board, or a shop RM for this specific shop -- same rule the
// API itself already enforces) get a mode toolbar:
//   Select      click an area or marker to choose it; drag the chosen marker
//               to move it, or drag the corner points to reshape the area
//               (each drag saves as soon as you let go)
//   Add marker  click the map to place a marker
//   Draw area   click points around a boundary, then finish
// Anything placed or moved inside an area is nested in it automatically.
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
  // Called when the placement that `preset` started is finished or cancelled,
  // so the page can drop it.
  onPresetDone?: () => void;
  // Called after anything is saved or deleted on the map, so the page around
  // it can refresh data that depends on it (a tool's location, for one).
  onChanged?: () => void;
}> = ({ shopId, shopName, canEdit, onSelectTool, highlightToolId, preset, onPresetDone, onChanged }) => {
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
  const [mode, setMode] = React.useState<Mode>("select");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState<{ box: Box; key: number } | null>(null);
  const [drawPoints, setDrawPoints] = React.useState<Point[]>([]);
  const [pending, setPending] = React.useState<PendingPlacement | null>(null);
  const [pendingLocationId, setPendingLocationId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Location | null>(null);
  // The corner positions of the chosen area while one is being dragged,
  // before the save lands.
  const [shapeDraft, setShapeDraft] = React.useState<{ id: string; points: Point[] } | null>(null);
  const draftRef = React.useRef<{ id: string; points: Point[] } | null>(null);
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
  const selected = canEdit && selectedId ? floorLocations.find(l => l.id === selectedId) : undefined;
  const selectedIsShape = !!selected?.shapePoints && selected.shapePoints.length >= 3;

  const topLevelLocations = floorLocations.filter(l => !l.parentId);
  const baseBox = unionBoundingBox(topLevelLocations);
  // The area to bring into view: the whole shop's extent on this floor, or
  // one item when "Zoom to it" was used. The view refits only when the floor
  // or that choice changes -- not on every edit -- so the map never jumps
  // away while you are placing things.
  const fitBox: Box = focus
    ? withMinSpan(paddedBox(focus.box), 15)
    : (baseBox ? withMinSpan(paddedBox(baseBox), 30) : FULL_FLOOR_BOX);
  const fitKey = `${shopId}|${floor}|${focus?.key || 0}|${baseBox ? "data" : "empty"}`;

  const clearDraft = () => { draftRef.current = null; setShapeDraft(null); };
  const create = useWriteTransaction(adminCreateLocation, () => { refresh(); onChanged?.(); });
  const update = useWriteTransaction(adminUpdateLocation, () => { refresh(); setEditing(null); clearDraft(); onChanged?.(); });
  const remove = useWriteTransaction(adminDeleteLocation, () => { refresh(); setEditing(null); setSelectedId(null); clearDraft(); onChanged?.(); });
  const toggleTool = useWriteTransaction(adminUpdateTool, () => { refreshTools(); onChanged?.(); });

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
  // Keyed on the tool id, not the preset object: the page hands over a fresh
  // object every render, which would otherwise re-run these constantly.
  const presetToolId = preset?.toolId;
  React.useEffect(() => {
    if (!highlightToolId && !presetToolId) return;
    wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightToolId, presetToolId]);
  React.useEffect(() => {
    if (!highlightToolId) return;
    const holder = locations.find(l => l.toolIds?.includes(highlightToolId));
    if (holder) setFloorChoice(floorOf(holder));
  }, [highlightToolId, locations, floorOf]);
  // Arriving from a tool's "Place on map" button starts in Add marker mode.
  React.useEffect(() => { if (presetToolId && canEdit) setMode("marker"); }, [presetToolId, canEdit]);

  // Switching floor drops any in-progress drawing/open form/zoom rather than
  // letting it apply to the wrong floor.
  React.useEffect(() => {
    setMode(current => (presetToolId && canEdit && current === "marker" ? "marker" : "select"));
    setDrawPoints([]);
    setPending(null);
    setPendingLocationId(null);
    setEditing(null);
    setFocus(null);
    clearDraft();
  }, [floor, shopId]);

  // "Find tool": zoom in on the marker that holds it, once its floor is
  // showing. Declared after the reset effect above so this focus is the one
  // that sticks when the floor changes at the same moment.
  const focusedForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!highlightToolId) { focusedForRef.current = null; return; }
    const holder = locations.find(l => l.toolIds?.includes(highlightToolId));
    if (!holder || floorOf(holder) !== floor || focusedForRef.current === highlightToolId) return;
    focusedForRef.current = highlightToolId;
    setFocus({ box: boundingBoxOf(holder), key: Date.now() });
  }, [highlightToolId, locations, floor, floorOf]);

  const shopColor = (shop?.colorId && shopColors[shop.colorId]) || "#1976d2";
  const selecting = canEdit && mode === "select";

  const changeMode = (next: Mode) => {
    setMode(next);
    setDrawPoints([]);
    clearDraft();
    if (next !== "select") setSelectedId(null);
  };

  // Where a marker dropped, or an area drawn, at this spot is nested.
  const parentFor = (anchor: Point, selfId?: string): string | undefined =>
    containingParentId(anchor, floorLocations, selfId ? new Set([selfId, ...descendantIds(selfId, locations)]) : undefined);

  // Everything drawn on this floor: a top-level location keeps its shop's
  // own color for identification; anything nested gets a fixed kind color
  // (or the reserved tool color if it holds a tool) so it reads as "an
  // object" regardless of which shop's color it sits inside.
  const { shapes, markers } = React.useMemo(() => {
    const shapeList: MapShape[] = [];
    const markerList: MapMarker[] = [];
    floorLocations.forEach(location => {
      const isNested = !!location.parentId;
      const hasTool = isNested && !!location.toolNames?.length;
      const color = hasTool
        ? TOOL_MARKER_COLOR
        : isNested ? colorForKind(location.kind, FALLBACK_NESTED_COLOR) : shopColor;
      // A marker named after its one tool would otherwise read "Prusa — Prusa".
      const onlyItsOwnName = location.toolNames?.length === 1 && location.toolNames[0] === location.name;
      const label = location.toolNames?.length && !onlyItsOwnName
        ? `${location.name} — ${location.toolNames.join(", ")}`
        : location.name;
      const isSelected = location.id === selectedId;
      const onClick = selecting ? () => { setSelectedId(location.id); clearDraft(); } : undefined;
      const isHighlighted = !!highlightToolId && !!location.toolIds?.includes(highlightToolId);

      if (location.shapePoints && location.shapePoints.length >= 3) {
        const points = shapeDraft?.id === location.id ? shapeDraft.points : location.shapePoints;
        shapeList.push({
          id: location.id, points, color, opacity: isNested ? 0.55 : 0.3, label, onClick, selected: isSelected,
        });
        // A shape only gets a marker when it has its own icon or is the one
        // being found, so plain areas stay uncluttered.
        if (location.icon || isHighlighted) {
          const center = centroid(points);
          markerList.push({
            id: `${location.id}-marker`, x: center.x, y: center.y, color, icon: location.icon, label,
            highlighted: isHighlighted, selected: isSelected, onClick,
          });
        }
        return;
      }
      if (location.xPct != null && location.yPct != null) {
        markerList.push({
          id: location.id, x: location.xPct, y: location.yPct, color, icon: location.icon, label,
          highlighted: isHighlighted, selected: isSelected, onClick,
          draggable: selecting && isSelected,
          onDragEnd: point => {
            const parentId = parentFor(point, location.id);
            update.call({
              id: location.id,
              // "" clears the parent when a marker is dragged out of its area.
              body: { xPct: point.x, yPct: point.y, ...((parentId || "") !== (location.parentId || "") ? { parentId: parentId || "" } : {}) },
            });
          },
        });
      }
    });
    return { shapes: shapeList, markers: markerList };
  }, [floorLocations, selectedId, shapeDraft, selecting, highlightToolId, shopColor]);

  const handleMapClick = (point: Point) => {
    if (!canEdit) return;
    if (mode === "area") {
      setDrawPoints(points => [...points, point]);
    } else if (mode === "marker") {
      setPending({ xPct: point.x, yPct: point.y, autoParentId: parentFor(point) });
    } else {
      setSelectedId(null);
      clearDraft();
    }
  };

  const finishShape = () => {
    setPending({ shapePoints: drawPoints, autoParentId: parentFor(shapeAnchor(drawPoints)) });
    setDrawPoints([]);
  };

  const closePlacement = () => {
    setPending(null);
    setPendingLocationId(null);
    setMode("select");
    onPresetDone?.();
  };

  const confirmDelete = (location: Location) => {
    const { descendantLines, toolNames } = describeDeletionImpact(location.id, locations);
    const lines = [`Delete "${location.name}"?`];
    if (descendantLines.length) {
      lines.push("", "This will also permanently delete everything nested inside it:", ...descendantLines);
    }
    if (toolNames.length) {
      lines.push("", `These tools will be unassigned (not deleted): ${toolNames.join(", ")}`);
    }
    if (!window.confirm(lines.join("\n"))) return;
    remove.call({ id: location.id });
  };

  // Choices for an "Inside" picker: drawn areas on this floor, never the
  // location itself or anything already inside it.
  const parentChoicesFor = (selfId?: string) => {
    const blocked = selfId ? new Set([selfId, ...descendantIds(selfId, locations)]) : new Set<string>();
    const areas = floorLocations.filter(l => !blocked.has(l.id) && !!l.shapePoints && l.shapePoints.length >= 3);
    const labels = new Map(flattenTree(floorLocations).map(e => [e.id, e.label]));
    return areas.map(l => ({ id: l.id, label: labels.get(l.id) || l.name }));
  };

  const selectFromList = (location: Location) => {
    setFloorChoice(floorOf(location));
    changeMode("select");
    setSelectedId(location.id);
    setFocus(null);
    wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!shopFloor) return null;

  const hasAnything = locations.length > 0;
  const parentOf = selected?.parentId ? byId.get(selected.parentId) : undefined;
  const shapeBase = selected && selectedIsShape
    ? (shapeDraft?.id === selected.id ? shapeDraft.points : selected.shapePoints!)
    : undefined;

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
              <ToggleButtonGroup size="small" exclusive value={floor} aria-label="Floor" sx={{ mb: 1, maxWidth: "100%", "& .MuiToggleButton-root": touchTarget }}
                onChange={(_e, value) => { if (value) { setFloorChoice(value); setSelectedId(null); } }}>
                {floorOptions.map(f => <ToggleButton key={f} value={f}>{floorLabel(f)}</ToggleButton>)}
              </ToggleButtonGroup>
            )}
            {canEdit && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <ToggleButtonGroup size="small" exclusive value={mode} aria-label="Map tool" sx={{ "& .MuiToggleButton-root": touchTarget }}
                  onChange={(_e, value) => { if (value) changeMode(value); }}>
                  <ToggleButton value="select"><NearMeIcon fontSize="small" sx={{ mr: 0.5 }} />Select</ToggleButton>
                  <ToggleButton value="marker"><PlaceIcon fontSize="small" sx={{ mr: 0.5 }} />Add marker</ToggleButton>
                  <ToggleButton value="area"><PolylineIcon fontSize="small" sx={{ mr: 0.5 }} />Draw area</ToggleButton>
                </ToggleButtonGroup>
                {mode === "area" && (
                  <>
                    <Button variant="contained" size="small" disabled={drawPoints.length < 3} onClick={finishShape}>
                      Finish shape ({drawPoints.length})
                    </Button>
                    <Button size="small" disabled={!drawPoints.length}
                      onClick={() => setDrawPoints(points => points.slice(0, -1))}>Undo point</Button>
                    <Button size="small" onClick={() => changeMode("select")}>Cancel</Button>
                  </>
                )}
                {focus && <Button size="small" onClick={() => setFocus(null)}>Show whole shop</Button>}
              </div>
            )}
            <div ref={wrapperRef}>
              <FloorMap
                floorName={floor}
                fitBox={fitBox}
                fitKey={fitKey}
                shapes={shapes}
                markers={markers}
                draftPoints={mode === "area" ? drawPoints : undefined}
                adjustPoints={selecting && selectedIsShape ? shapeBase : undefined}
                adjustKey={selecting && selectedIsShape ? selected!.id : undefined}
                label={`${shopName} map, ${floorLabel(floor)}`}
                onAdjustPoint={(index, point, final) => {
                  if (!selected || !selectedIsShape) return;
                  const base = draftRef.current?.id === selected.id ? draftRef.current.points : selected.shapePoints!;
                  const next = base.map((p, i) => (i === index ? point : p));
                  draftRef.current = { id: selected.id, points: next };
                  setShapeDraft(draftRef.current);
                  if (final) update.call({ id: selected.id, body: { shapePoints: next } });
                }}
                onMapClick={canEdit ? handleMapClick : undefined}
                crosshair={canEdit && mode !== "select"}
              />
            </div>
            {/* Hints and messages sit BELOW the map: their text changes length
                as you work, and anything above the map would push it away from
                the cursor in the middle of a click sequence. */}
            {canEdit && (
              <Alert severity={update.error || remove.error ? "error" : "info"} sx={{ mt: 1 }}>
                {update.error || remove.error || (
                  mode === "marker"
                    ? `Click the map where ${shopTools.find(t => t.id === presetToolId)?.name || "the marker"} goes. If you click inside an area, it is placed inside that area.`
                    : mode === "area"
                      ? (drawPoints.length === 0
                        ? "Click the map to place the first point of the boundary."
                        : drawPoints.length < 3
                          ? `${drawPoints.length} point${drawPoints.length > 1 ? "s" : ""} placed -- keep clicking (at least 3 close a shape).`
                          : `${drawPoints.length} points placed -- the dashed line shows where the shape closes. Click "Finish shape" when it looks right.`)
                      : selected
                        ? (selectedIsShape
                          ? "Drag the red corner points to reshape this area. Changes save when you let go."
                          : "Drag the marker to move it. Changes save when you let go.")
                        : `Showing the ${floorLabel(floor)}. Click an area or marker to select it, or choose Add marker / Draw area. Use the +/- buttons or pinch to zoom.`
                )}
              </Alert>
            )}
            {selected && (
              <Paper variant="outlined" sx={{ mt: 1, p: 1.5 }} aria-label="Selected location">
                <Typography variant="subtitle2">{selected.name}</Typography>
                <Typography variant="caption" color="textSecondary" component="div">
                  {[selected.kind && (KIND_LABELS[selected.kind] || selected.kind), floorLabel(floorOf(selected)),
                    parentOf && `Inside ${parentOf.name}`].filter(Boolean).join(" · ")}
                </Typography>
                {!!selected.toolNames?.length && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>Tools: {selected.toolNames.join(", ")}</Typography>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <Button size="small" variant="outlined" startIcon={<EditIcon />} sx={touchTarget} onClick={() => setEditing(selected)}>
                    Edit details
                  </Button>
                  <Button size="small" startIcon={<ZoomInMapIcon />} sx={touchTarget}
                    onClick={() => setFocus({ box: boundingBoxOf(selected), key: Date.now() })}>
                    Zoom to it
                  </Button>
                  <Button size="small" color="error" startIcon={<DeleteIcon />} sx={touchTarget} disabled={remove.isRequesting}
                    onClick={() => confirmDelete(selected)}>
                    Delete
                  </Button>
                </div>
              </Paper>
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
                <Typography key={entry.id} variant="body2">
                  {/* Editors can pick an item from the list too -- the keyboard
                      route to anything on the map. */}
                  {canEdit && location
                    ? <Link component="button" variant="body2" underline="hover" onClick={() => selectFromList(location)}>{entry.label}</Link>
                    : entry.label}
                </Typography>,
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
          linkableTools={shopTools.filter(t => !t.locationId || t.id === presetToolId)}
          initialToolId={presetToolId}
          parentChoices={parentChoicesFor()}
          initialParentId={pending.autoParentId}
          onClose={closePlacement}
          onSave={async ({ name, kind, toolId, icon, parentId }) => {
            let locationId = pendingLocationId;
            if (!locationId) {
              const { autoParentId, ...geometry } = pending;
              const result = await create.call({
                body: { name, shopId, kind, icon, floorName: floor, parentId: parentId || undefined, ...geometry },
              });
              if (isApiErrorResponse(result)) return;
              locationId = result.data.id;
              setPendingLocationId(locationId);
              setSelectedId(locationId);
            }
            if (toolId) {
              const toolResult = await toggleTool.call({ id: toolId, body: { locationId } });
              if (isApiErrorResponse(toolResult)) return;
            }
            closePlacement();
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
          parentChoices={parentChoicesFor(editing.id)}
          initialParentId={editing.parentId}
          onClose={() => setEditing(null)}
          onSave={({ name, kind, icon, floorName, parentId }) => update.call({
            id: editing.id,
            // An empty icon/kind must be sent as "" to clear it server-side.
            body: {
              name, kind: kind ?? "", icon: icon ?? "",
              ...(floorName ? { floorName } : {}),
              ...(parentId !== undefined && parentId !== (editing.parentId || "") ? { parentId } : {}),
            },
          })}
          onDelete={() => confirmDelete(editing)}
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
