import * as React from "react";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Typography from "@mui/material/Typography";
import { Tool } from "app/entities/toolCheckout";
import { togglePrerequisiteToolId } from "./reservationPrerequisites";

export interface ReservationSettingsValue {
  reservable?: boolean;
  maxConcurrentReservations?: number;
  reservationHorizonDays?: number;
  maxReservationDurationHours?: number;
  reservationRequiresApproval?: boolean;
  reservationPrerequisiteToolIds?: string[];
}

const Help: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip title={text}><InfoOutlinedIcon fontSize="inherit" style={{ marginLeft: 4 }} /></Tooltip>
);

const ReservationSettingsFields: React.FC<{
  value: ReservationSettingsValue;
  onChange: (value: ReservationSettingsValue) => void;
  tools?: Tool[];
  lockedToolId?: string;
}> = ({ value, onChange, tools = [], lockedToolId }) => {
  const set = (field: keyof ReservationSettingsValue, next: any) =>
    onChange({ ...value, [field]: next });
  const selected = Array.from(value.reservationPrerequisiteToolIds || []);
  const effectiveSelected = lockedToolId ? Array.from(new Set([...selected, lockedToolId])) : selected;
  const toggle = (id: string) => {
    if (id === lockedToolId) return;
    set("reservationPrerequisiteToolIds", togglePrerequisiteToolId(selected, id));
  };

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <FormControlLabel
          control={<Checkbox checked={!!value.reservable} onChange={event => set("reservable", event.target.checked)} />}
          label={<>Reservable <Help text="Allow active members with the required checkouts to reserve this resource." /></>}
        />
      </Grid>
      {value.reservable && (
        <>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth type="number" label="Max concurrent reservations"
              value={value.maxConcurrentReservations ?? 1}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              onChange={event => set("maxConcurrentReservations", Number(event.target.value))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth type="number" label="Days reservable in advance"
              value={value.reservationHorizonDays ?? 7}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              onChange={event => set("reservationHorizonDays", Number(event.target.value))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth type="number" label="Maximum duration (hours)"
              value={value.maxReservationDurationHours ?? 8}
              slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
              onChange={event => set("maxReservationDurationHours", Number(event.target.value))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={<Checkbox checked={!!value.reservationRequiresApproval}
                onChange={event => set("reservationRequiresApproval", event.target.checked)} />}
              label={<>Reservation requires RM approval <Help text="Pending requests consume capacity until approved, denied, or canceled." /></>}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormLabel style={{ fontSize: 12 }}>
              Required checkout tools
              <Help text="Members must hold active checkouts for every selected tool. A tool always requires its own checkout." />
            </FormLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {tools.map(tool => (
                <Chip key={tool.id} label={tool.id === lockedToolId ? `${tool.name} (required)` : tool.name}
                  size="small" clickable={tool.id !== lockedToolId}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation();
                    toggle(tool.id);
                  }}
                  aria-pressed={effectiveSelected.includes(tool.id)}
                  color={effectiveSelected.includes(tool.id) ? "primary" : "default"}
                  variant={effectiveSelected.includes(tool.id) ? "filled" : "outlined"} />
              ))}
            </div>
            {tools.length === 0 && (
              <Typography variant="caption" color="textSecondary">
                No tools belong to this shop yet. Add tools, then edit the shop to select required checkouts.
              </Typography>
            )}
          </Grid>
        </>
      )}
    </>
  );
};

export default ReservationSettingsFields;
