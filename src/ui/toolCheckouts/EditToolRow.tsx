import { toolAvailabilityLabel } from "ui/common/ToolAvailability";
import * as React from "react";
import { Box, Grid, Typography, TextField, IconButton, Tooltip, Select, FormLabel, Chip, Checkbox, FormControlLabel } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import { Shop, Tool } from "app/entities/toolCheckout";
import ReservationSettingsFields, { ReservationSettingsValue } from "./ReservationSettingsFields";
import { duplicateToolName, wouldCreatePrerequisiteLoop } from "./toolValidation";
const normalizedChannel = (value: string) => value.replace(/^#+/, "");

interface EditToolRowProps {
  tool: Tool;
  tools: Tool[];
  shops: Shop[];
  onSave: (id: string, body: Partial<Tool>, notes?: string) => void;
  onCancel: () => void;
  saving: boolean;
}

export const EditToolRow: React.FC<EditToolRowProps> = ({ tool, tools, shops, onSave, onCancel, saving }) => {
  const [name, setName] = React.useState(tool.name);
  const [wikiUrl, setWikiUrl] = React.useState(tool.wikiUrlOverride || "");
  const [gdriveId, setGdriveId] = React.useState(tool.gdriveId || "");
  const [description, setDescription] = React.useState(tool.description || "");
  const [open, setOpen] = React.useState(!!tool.open);
  const [shopId, setShopId] = React.useState(tool.shopId);
  const [prerequisiteIds, setPrerequisiteIds] = React.useState<string[]>(tool.prerequisiteIds || []);
  const [disabled, setDisabled] = React.useState(!!tool.disabled);
  const [announce, setAnnounce] = React.useState(!!tool.announce);
  const [announceChannel, setAnnounceChannel] = React.useState(tool.announceChannel || "");
  const [usersChannel, setUsersChannel] = React.useState(tool.usersChannel || "");
  const [notes, setNotes] = React.useState(tool.notes || "");
  const [localError, setLocalError] = React.useState("");
  // Only the reservation-specific fields -- seeding this from the full tool
  // object let its name/description/gdriveId/announce*/etc. leak in, which
  // then silently overwrote whatever the user just edited via the trailing
  // `...reservation` spread in submit() below.
  const [reservation, setReservation] = React.useState<ReservationSettingsValue>({
    reservable: tool.reservable,
    maxConcurrentReservations: tool.maxConcurrentReservations,
    reservationHorizonDays: tool.reservationHorizonDays,
    minimumAdvanceNoticeHours: tool.minimumAdvanceNoticeHours ?? 2,
    prohibitSameDayReservations: tool.prohibitSameDayReservations ?? false,
    reservationFullDay: tool.reservationFullDay,
    durationFees: tool.durationFees,
    maxReservationDurationHours: tool.maxReservationDurationHours,
    reservationRequiresApproval: tool.reservationRequiresApproval,
    reservationPrerequisiteToolIds: tool.reservationPrerequisiteToolIds,
  });

  const availablePrereqs = tools.filter(t => t.shopId === shopId && t.id !== tool.id);
  const togglePrereq = (id: string) => {
    const nextIds = prerequisiteIds.includes(id)
      ? prerequisiteIds.filter(p => p !== id)
      : [...prerequisiteIds, id];

    if (wouldCreatePrerequisiteLoop(tools, tool.id, nextIds)) {
      setLocalError("That prerequisite would create a dependency loop.");
      return;
    }

    setLocalError("");
    setPrerequisiteIds(nextIds);
  };

  // Prerequisites are shop-scoped -- moving to a different shop invalidates
  // whatever was previously selected here, the same way changing the shop
  // on Add Tool resets it.
  const changeShop = (nextShopId: string) => {
    setShopId(nextShopId);
    setPrerequisiteIds([]);
    setLocalError("");
  };

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (duplicateToolName(tools, trimmedName, shopId, tool.id)) {
      setLocalError("A tool with this name already exists in this shop.");
      return;
    }

    if (wouldCreatePrerequisiteLoop(tools, tool.id, prerequisiteIds)) {
      setLocalError("These prerequisites would create a dependency loop.");
      return;
    }

    setLocalError("");
    onSave(
      tool.id,
      { name: trimmedName, wikiUrlOverride: wikiUrl, gdriveId, description, shopId, disabled, open, announce, announceChannel, usersChannel, prerequisiteIds, ...reservation },
      notes !== (tool.notes || "") ? notes : undefined
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, alignItems: "center" }}>
      <TextField size="small" value={name} onChange={e => setName(e.target.value)}
        label="Tool name" placeholder="Tool name" autoFocus />
      <TextField size="small" value={description} onChange={e => setDescription(e.target.value)}
        label="Description" placeholder="Description" />
      <div style={{ gridColumn: "1 / -1" }}>
        <FormLabel style={{ fontSize: 12 }}>Shop</FormLabel>
        <Select native fullWidth size="small" inputProps={{ "aria-label": "Shop" }} value={shopId}
          onChange={e => changeShop((e.target as HTMLSelectElement).value)}>
          {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <TextField size="small" value={wikiUrl} onChange={e => setWikiUrl(e.target.value)}
        label="Wiki URL" placeholder="Wiki URL (generated when blank)" style={{ gridColumn: "1 / -1" }} />
      <TextField size="small" value={gdriveId} onChange={e => setGdriveId(e.target.value)}
        label="GDrive ID" placeholder="GDrive ID" style={{ gridColumn: "1 / -1" }} />
      {tool.notes !== undefined && (
        <TextField size="small" multiline value={notes} onChange={e => setNotes(e.target.value)}
          label="Notes" helperText="Only shown to approvers and active checkouts"
          style={{ gridColumn: "1 / -1" }} />
      )}
      <TextField size="small" value={announceChannel} onChange={e => setAnnounceChannel(normalizedChannel(e.target.value))}
        label="Announce channel" placeholder="Announce channel" />
      <TextField size="small" value={usersChannel} onChange={e => setUsersChannel(normalizedChannel(e.target.value))}
        label="Users channel" placeholder="Users channel" />
      <FormControlLabel control={<Checkbox checked={open} onChange={e => setOpen(e.target.checked)} />} label="No checkout required" />
      <FormControlLabel control={<Checkbox checked={disabled} onChange={e => setDisabled(e.target.checked)} />} label="Hidden" />
      <FormControlLabel control={<Checkbox checked={announce} onChange={e => setAnnounce(e.target.checked)} />} label="Announce" />
      <div style={{ gridColumn: "1 / -1" }}>
        <FormLabel style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Prerequisites</FormLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {availablePrereqs.length ? availablePrereqs.map(t => (
            <Chip key={t.id} label={toolAvailabilityLabel(t)} size="small" clickable
              onClick={() => togglePrereq(t.id)}
              color={prerequisiteIds.includes(t.id) ? "primary" : "default"}
              variant={prerequisiteIds.includes(t.id) ? "filled" : "outlined"}
            />
          )) : (
            <Typography variant="caption" color="textSecondary">No other tools in this shop.</Typography>
          )}
        </div>
        {localError && <Typography variant="caption" color="error">{localError}</Typography>}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <Grid container spacing={1}>
          <ReservationSettingsFields
            value={reservation}
            onChange={setReservation}
            tools={tools.filter(candidate => candidate.shopId === shopId)}
            lockedToolId={tool.id}
          />
        </Grid>
      </div>
      <div>
        <Tooltip title="Save"><span>
          <IconButton aria-label="Save" size="small" color="primary" disabled={saving || !name}
            onClick={submit}>
            <SaveIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
        <Tooltip title="Cancel">
          <IconButton aria-label="Cancel" size="small" disabled={saving} onClick={onCancel}><CancelIcon fontSize="small" /></IconButton>
        </Tooltip>
      </div>
    </Box>
  );
};

