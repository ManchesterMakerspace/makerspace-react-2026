import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import {
  createReservationBlackout, deleteReservationBlackout, listReservationBlackouts,
  updateReservationBlackout
} from "api/reservations";
import { listManagedShops } from "api/toolCheckouts";
import {
  ReservationBlackout, ReservationBlackoutInput
} from "app/entities/reservation";
import { Shop } from "app/entities/toolCheckout";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyForm = (shopId = ""): ReservationBlackoutInput => ({
  title: "",
  shopId,
  recurrence: "weekly",
  weekday: 1,
  startTime: "17:00",
  endTime: "20:00",
  startDate: "",
  endDate: "",
});

const ReservationBlackouts: React.FC = () => {
  const [shops, setShops] = React.useState<Shop[]>([]);
  const [blackouts, setBlackouts] = React.useState<ReservationBlackout[]>([]);
  const [shopFilter, setShopFilter] = React.useState("");
  const [form, setForm] = React.useState<ReservationBlackoutInput>(emptyForm());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async (filter = shopFilter) => {
    const result = await listReservationBlackouts({ shopId: filter || undefined });
    if (result.error) setError(result.error.message);
    else setBlackouts(result.data || []);
  }, [shopFilter]);

  React.useEffect(() => {
    listManagedShops().then(result => {
      if (result.error) {
        setError(result.error.message);
        return;
      }
      const managed = result.data || [];
      setShops(managed);
      setForm(current => current.shopId ? current : emptyForm(managed[0]?.id || ""));
    });
  }, []);

  React.useEffect(() => { load(shopFilter); }, [shopFilter]);

  const setField = <K extends keyof ReservationBlackoutInput>(
    key: K, value: ReservationBlackoutInput[K]
  ) => setForm(current => ({ ...current, [key]: value }));

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm(shopFilter || shops[0]?.id || ""));
    setError("");
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const result = editingId
      ? await updateReservationBlackout({ id: editingId, body: form })
      : await createReservationBlackout({ body: form });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    reset();
    await load();
  };

  const edit = (blackout: ReservationBlackout) => {
    setEditingId(blackout.id);
    setForm({
      title: blackout.title,
      shopId: blackout.shopId,
      recurrence: blackout.recurrence,
      weekday: blackout.weekday,
      startTime: blackout.startTime,
      endTime: blackout.endTime,
      startDate: blackout.startDate || "",
      endDate: blackout.endDate || "",
    });
  };

  const remove = async (blackout: ReservationBlackout) => {
    if (!window.confirm(`Delete blackout "${blackout.title}"?`)) return;
    const result = await deleteReservationBlackout({ id: blackout.id });
    if (result.error) setError(result.error.message);
    else await load();
  };

  const overnight = form.endTime <= form.startTime;

  return (
    <Paper style={{ padding: 16 }}>
      <Typography variant="h6">Reservation Blackouts</Typography>
      <Typography color="textSecondary" variant="body2">
        Recurring periods make overlapping member reservations require approval.
      </Typography>
      {error && <Alert severity="error" style={{ marginTop: 8 }}>{error}</Alert>}

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Filter shop</InputLabel>
            <Select value={shopFilter} label="Filter shop"
              onChange={event => setShopFilter(event.target.value)}>
              <MenuItem value="">All managed shops</MenuItem>
              {shops.map(shop => <MenuItem key={shop.id} value={shop.id}>{shop.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2} style={{ marginTop: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField fullWidth required size="small" label="Title" value={form.title}
            onChange={event => setField("title", event.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Shop</InputLabel>
            <Select required value={form.shopId} label="Shop"
              onChange={event => setField("shopId", event.target.value)}>
              {shops.map(shop => <MenuItem key={shop.id} value={shop.id}>{shop.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Repeats</InputLabel>
            <Select value={form.recurrence} label="Repeats"
              onChange={event => setField("recurrence", event.target.value as "daily" | "weekly")}>
              <MenuItem value="daily">Every day</MenuItem>
              <MenuItem value="weekly">Every week</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        {form.recurrence === "weekly" && <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Weekday</InputLabel>
            <Select value={form.weekday ?? 1} label="Weekday"
              onChange={event => setField("weekday", Number(event.target.value))}>
              {WEEKDAYS.map((day, index) => <MenuItem key={day} value={index}>{day}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>}
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth required size="small" type="time" label="Start"
            value={form.startTime} onChange={event => setField("startTime", event.target.value)}
            slotProps={{ htmlInput: { step: 1800 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth required size="small" type="time" label="End"
            value={form.endTime} onChange={event => setField("endTime", event.target.value)}
            slotProps={{ htmlInput: { step: 1800 } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth size="small" type="date" label="Starts on"
            value={form.startDate} onChange={event => setField("startDate", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField fullWidth size="small" type="date" label="Ends on"
            value={form.endDate} onChange={event => setField("endDate", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          {overnight && <Typography variant="caption" color="textSecondary">
            This period ends on the following day{form.endTime === form.startTime ? " (24 hours)" : ""}.
          </Typography>}
        </Grid>
        <Grid size={{ xs: 12 }} style={{ display: "flex", gap: 8 }}>
          <Button variant="contained" disabled={saving || !form.title.trim() || !form.shopId}
            onClick={submit}>{editingId ? "Save Blackout" : "Add Blackout"}</Button>
          {editingId && <Button onClick={reset}>Cancel Edit</Button>}
        </Grid>
      </Grid>

      <div style={{ marginTop: 16 }}>
        {blackouts.length === 0 && <Typography color="textSecondary">No blackouts configured.</Typography>}
        {blackouts.map(blackout => (
          <Paper key={blackout.id} variant="outlined" style={{ padding: 10, marginTop: 8 }}>
            <Grid container alignItems="center">
              <Grid size={{ xs: 12, sm: 8 }}>
                <strong>{blackout.title}</strong> — {blackout.shopName}
                <Typography variant="body2">
                  {blackout.recurrence === "daily" ? "Every day" : `Every ${WEEKDAYS[blackout.weekday ?? 0]}`}
                  {` · ${blackout.startTime}–${blackout.endTime}`}
                  {blackout.endTime <= blackout.startTime ? " (next day)" : ""}
                  {blackout.startDate ? ` · from ${blackout.startDate}` : ""}
                  {blackout.endDate ? ` · through ${blackout.endDate}` : ""}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }} style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button size="small" onClick={() => edit(blackout)}>Edit</Button>
                <Button size="small" color="secondary" onClick={() => remove(blackout)}>Delete</Button>
              </Grid>
            </Grid>
          </Paper>
        ))}
      </div>
    </Paper>
  );
};

export default ReservationBlackouts;
