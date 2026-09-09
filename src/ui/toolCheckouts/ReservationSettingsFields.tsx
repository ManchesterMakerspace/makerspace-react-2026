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
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import { listShopFeeItems } from "api/shopFees";
import { ShopFeeItem } from "app/entities/shopFee";
import { DurationFee, Tool } from "app/entities/toolCheckout";
import { togglePrerequisiteToolId } from "./reservationPrerequisites";

export interface ReservationSettingsValue {
  reservable?: boolean;
  minimumAdvanceNoticeHours?: number;
  prohibitSameDayReservations?: boolean;
  reservationFullDay?: boolean;
  durationFees?: DurationFee[];
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
  const [fees, setFees] = React.useState<ShopFeeItem[]>([]);
  const [feeError, setFeeError] = React.useState("");
  React.useEffect(() => {
    let active = true;
    listShopFeeItems().then(result => {
      if (!active) return;
      if ("data" in result) setFees((result.data || []).filter(fee => !fee.disabled));
      else setFeeError("Unable to load shop fees. Please retry before adding a duration fee.");
    });
    return () => { active = false; };
  }, []);
  const rules = value.durationFees || [];
  const updateRule = (index: number, patch: Partial<DurationFee>) =>
    onChange({ ...value, durationFees: rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) });
  const set = (field: keyof ReservationSettingsValue, next: any) =>
    onChange({ ...value, [field]: next });
  const selected: string[] = Array.from(value.reservationPrerequisiteToolIds || []);
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
            <TextField fullWidth type="number" label="Minimum advance notice (hours)"
              value={value.minimumAdvanceNoticeHours ?? 2}
              slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              onChange={event => set("minimumAdvanceNoticeHours", Number(event.target.value))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel label="Prohibit same day reservations" control={<Checkbox
              checked={!!value.prohibitSameDayReservations}
              onChange={event => set("prohibitSameDayReservations", event.target.checked)} />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth type="number" label="Maximum duration (hours)"
              value={value.maxReservationDurationHours ?? 8}
              slotProps={{ htmlInput: { min: value.reservationFullDay ? 24 : 0.5, step: value.reservationFullDay ? 24 : 0.5 } }}
              onChange={event => set("maxReservationDurationHours", Number(event.target.value))} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel label="Minimum reservation duration: full day"
              control={<Checkbox checked={!!value.reservationFullDay} onChange={event => onChange({ ...value,
                reservationFullDay: event.target.checked,
                maxReservationDurationHours: event.target.checked ? Math.max(24, Math.ceil((value.maxReservationDurationHours || 24) / 24) * 24) : value.maxReservationDurationHours
              })} />} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            {feeError && <Alert severity="warning">{feeError}</Alert>}
            {rules.map((rule, index) => <div key={index} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <TextField select label="Shop fee" value={rule.invoiceOptionId} style={{ minWidth: 200 }}
                onChange={event => updateRule(index, { invoiceOptionId: event.target.value })}>
                {!fees.some(fee => fee.id === rule.invoiceOptionId) && rule.invoiceOptionId &&
                  <MenuItem value={rule.invoiceOptionId}>Unavailable fee — select a replacement</MenuItem>}
                {fees.map(fee => <MenuItem key={fee.id} value={fee.id}>{fee.name} (${Number(fee.amount).toFixed(2)})</MenuItem>)}
              </TextField>
              <FormControlLabel label="Full day" control={<Checkbox checked={rule.fullDay}
                onChange={event => updateRule(index, { fullDay: event.target.checked })} />} />
              {!rule.fullDay && <>
                <TextField type="number" label="Minimum hours" value={rule.minimumHours}
                  slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
                  onChange={event => updateRule(index, { minimumHours: Number(event.target.value) })} />
                <TextField type="number" label="Maximum hours per fee unit" value={rule.maximumHours}
                  slotProps={{ htmlInput: { min: rule.minimumHours, step: 0.5 } }}
                  onChange={event => updateRule(index, { maximumHours: Number(event.target.value) })} />
              </>}
              <Button color="error" onClick={() => set("durationFees", rules.filter((_, i) => i !== index))}>Delete duration-based fee</Button>
            </div>)}
            <Button onClick={() => set("durationFees", [...rules, { invoiceOptionId: fees[0]?.id || "", minimumHours: 4, maximumHours: 4, fullDay: false }])}>
              Add duration-based fee
            </Button>
            <Typography variant="caption" style={{ display: "block" }}>Only the longest applicable duration fee per resource applies. Partial units round up; 12 hours at $10 per 4 hours costs $30.</Typography>
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
