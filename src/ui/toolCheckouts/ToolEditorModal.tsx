import * as React from "react";
import { Box, Button, Checkbox, Chip, FormControlLabel, Grid, TextField, Typography } from "@mui/material";
import { Shop, Tool } from "app/entities/toolCheckout";
import { adminCreateTool, adminUpdateTool } from "api/toolCheckouts";
import { adminListLocations } from "api/locations";
import FormModal from "ui/common/FormModal";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { flattenTree } from "./locationTree";
import ReservationSettingsFields from "./ReservationSettingsFields";
import { duplicateToolName, wouldCreatePrerequisiteLoop } from "./toolValidation";

interface ToolEditorModalProps {
  tool?: Tool;
  shops: Shop[];
  tools: Tool[];
  initialShopId?: string;
  onClose: () => void;
  onSaved: () => void;
  onPlaceOnMap?: (shopId: string, toolId: string) => void;
}

// Both catalogs use this editor for creation and updates. Seed only editable
// fields from the full management record, never the public workshop summary.
const ToolEditorModal: React.FC<ToolEditorModalProps> = ({ tool, shops, tools, initialShopId, onClose, onSaved, onPlaceOnMap }) => {
  // An omitted private field is a visibility decision, not an empty note.
  const canEditNotes = !tool || tool.notes !== undefined;
  const [value, setValue] = React.useState<Partial<Tool>>(() => ({
    name: tool?.name ?? "",
    shopId: tool?.shopId ?? initialShopId ?? shops[0]?.id ?? "",
    locationId: tool?.locationId ?? "",
    wikiUrlOverride: tool?.wikiUrlOverride ?? "",
    gdriveId: tool?.gdriveId ?? "",
    description: tool?.description ?? "",
    requestorAnnotation: tool?.requestorAnnotation ?? "",
    notes: tool ? tool.notes : "",
    open: tool?.open ?? false,
    disabled: tool?.disabled ?? false,
    allowPending: tool?.allowPending ?? false,
    announce: tool?.announce ?? false,
    announceChannel: tool?.announceChannel ?? "",
    usersChannel: tool?.usersChannel ?? "",
    prerequisiteIds: tool?.prerequisiteIds ?? [],
    reservable: tool?.reservable ?? false,
    maxConcurrentReservations: tool?.maxConcurrentReservations ?? 1,
    reservationHorizonDays: tool?.reservationHorizonDays ?? 7,
    minimumAdvanceNoticeHours: tool?.minimumAdvanceNoticeHours ?? 2,
    prohibitSameDayReservations: tool?.prohibitSameDayReservations ?? false,
    reservationFullDay: tool?.reservationFullDay ?? false,
    durationFees: tool?.durationFees ?? [],
    maxReservationDurationHours: tool?.maxReservationDurationHours ?? 8,
    reservationRequiresApproval: tool?.reservationRequiresApproval ?? false,
    reservationPrerequisiteToolIds: tool?.reservationPrerequisiteToolIds ?? [],
  }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const shopChanged = !!tool && value.shopId !== tool.shopId;
  const mapPlacementHelpId = React.useId();
  const { data: locations = [], error: locationError } = useReadTransaction(
    adminListLocations, { shopId: value.shopId! }, !value.shopId, `admin-locations-${value.shopId}`, true
  );
  const locationChoices = flattenTree(locations);
  const shopTools = tools.filter(candidate => candidate.shopId === value.shopId);
  const prerequisites = shopTools.filter(candidate => candidate.id !== tool?.id);
  const set = <K extends keyof Tool,>(field: K, next: Tool[K]) => setValue(previous => ({ ...previous, [field]: next }));
  const changeShop = (shopId: string) => {
    setValue(previous => ({ ...previous, shopId, locationId: "", prerequisiteIds: [], reservationPrerequisiteToolIds: [] }));
    setError("");
  };
  const togglePrerequisite = (id: string) => {
    const ids = value.prerequisiteIds || [];
    const next = ids.includes(id) ? ids.filter(candidate => candidate !== id) : [...ids, id];
    if (wouldCreatePrerequisiteLoop(tools, tool?.id, next)) {
      setError("These prerequisites would create a dependency loop.");
      return;
    }
    setError("");
    set("prerequisiteIds", next);
  };
  const submit = async () => {
    if (saving) return;
    const name = value.name?.trim();
    if (!name || !value.shopId) {
      setError("Enter a tool name and select a shop.");
      return;
    }
    if (duplicateToolName(tools, name, value.shopId, tool?.id)) {
      setError("A tool with this name already exists in the selected shop.");
      return;
    }
    if (wouldCreatePrerequisiteLoop(tools, tool?.id, value.prerequisiteIds || [])) {
      setError("These prerequisites would create a dependency loop.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { ...value, name, requestorAnnotation: value.requestorAnnotation?.trim() || null,
        notes: canEditNotes ? value.notes : undefined };
      const result = tool ? await adminUpdateTool({ id: tool.id, body }) : await adminCreateTool({ body });
      if (result.error) setError(result.error.message);
      else onSaved();
    } catch {
      setError("Unable to save this tool. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal id="tool-editor" isOpen title={tool ? `Edit ${tool.name}` : "Add Tool"}
      closeHandler={() => { if (!saving) onClose(); }} onSubmit={submit}
      submitText={tool ? "Save Tool" : "Add Tool"} loading={saving} error={error}
      submitDisabled={saving || !value.name?.trim() || !value.shopId}>
      <Box component="fieldset" disabled={saving} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth required label="Tool Name" value={value.name} autoFocus
              onChange={event => set("name", event.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField select fullWidth required label="Shop" value={value.shopId}
              slotProps={{ select: { native: true } }} onChange={event => changeShop(event.target.value)}>
              <option value="">— select shop —</option>
              {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField select fullWidth label="Location" value={value.locationId}
              slotProps={{ select: { native: true } }} onChange={event => set("locationId", event.target.value)}
              error={!!locationError} helperText={locationError}>
              <option value="">— no location —</option>
              {value.locationId && !locationChoices.some(location => location.id === value.locationId) &&
                <option value={value.locationId}>{tool?.locationName || "Current location"}</option>}
              {locationChoices.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}
            </TextField>
            {tool && onPlaceOnMap && <>
              <Button disabled={saving || shopChanged}
                aria-describedby={shopChanged ? mapPlacementHelpId : undefined}
                onClick={() => onPlaceOnMap(tool.shopId, tool.id)}>Place on map</Button>
              {shopChanged && <Typography id={mapPlacementHelpId} component="p" variant="caption" color="textSecondary">
                Save the shop change before placing this tool on the map.
              </Typography>}
            </>}
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Wiki URL" value={value.wikiUrlOverride}
              onChange={event => set("wikiUrlOverride", event.target.value)}
              helperText="Leave blank to use the tool's generated wiki link." />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="GDrive ID" value={value.gdriveId}
              onChange={event => set("gdriveId", event.target.value)} helperText="Optional Google Drive folder ID." />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline label="Description" value={value.description}
              onChange={event => set("description", event.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline minRows={2} label="Annotation for requestors" value={value.requestorAnnotation}
              onChange={event => set("requestorAnnotation", event.target.value)} helperText="Leave blank to use the shop annotation." />
          </Grid>
          {canEditNotes && <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline label="Notes" value={value.notes ?? ""}
              onChange={event => set("notes", event.target.value)}
              helperText="Private details such as lock combinations; shown only to managers, approvers, and members with an active checkout." />
          </Grid>}
          <Grid size={{ xs: 12 }}>
            <FormControlLabel label="No checkout required" control={<Checkbox checked={value.open} onChange={event => set("open", event.target.checked)} />} />
            <FormControlLabel label="Hidden" control={<Checkbox checked={value.disabled} onChange={event => set("disabled", event.target.checked)} />} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel label="Allow pending members to request checkout and reservations" control={<Checkbox
              checked={value.allowPending} onChange={event => set("allowPending", event.target.checked)} />} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel label="Announce requests and checkouts" control={<Checkbox checked={value.announce} onChange={event => set("announce", event.target.checked)} />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Announce Channel" value={value.announceChannel}
              onChange={event => set("announceChannel", event.target.value.replace(/^#+/, ""))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Users Channel" value={value.usersChannel}
              onChange={event => set("usersChannel", event.target.value.replace(/^#+/, ""))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Checkout prerequisites (warning shown if not met)</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {prerequisites.map(candidate => <Chip key={candidate.id} label={candidate.name} clickable disabled={saving}
                onClick={() => togglePrerequisite(candidate.id)} aria-pressed={value.prerequisiteIds?.includes(candidate.id)}
                color={value.prerequisiteIds?.includes(candidate.id) ? "primary" : "default"}
                variant={value.prerequisiteIds?.includes(candidate.id) ? "filled" : "outlined"} />)}
              {!prerequisites.length && <Typography variant="caption" color="textSecondary">No other tools in this shop.</Typography>}
            </Box>
          </Grid>
          <ReservationSettingsFields value={value} onChange={next => setValue(previous => ({ ...previous, ...next }))}
            tools={shopTools} lockedToolId={tool?.id} disabled={saving} />
        </Grid>
      </Box>
    </FormModal>
  );
};

export default ToolEditorModal;
