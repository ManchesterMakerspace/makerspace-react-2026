import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import FormLabel from "@mui/material/FormLabel";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import {
  approveReservation, cancelManagedReservation, cancelReservation, createReservation, denyReservation,
  getReservationAvailability, getReservationCatalog, listManagedReservations, listReservations,
  previewManagedReservation, previewReservation, updateManagedReservation, updateReservation
} from "api/reservations";
import { Reservation, ReservationCatalog, ReservationInput, ReservationPreview } from "app/entities/reservation";
import { Shop, Tool } from "app/entities/toolCheckout";
import moment from "ui/utils/moment";
import { useAuthState } from "ui/reducer/hooks";

const ZONE = "America/New_York";
const today = () => moment.tz(ZONE).format("YYYY-MM-DD");
const asIso = (date: string, time: string) => moment.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", ZONE).toISOString();
const statusColor = (status: string): "default" | "primary" | "warning" | "success" | "error" =>
  status === "pending" ? "warning" : status === "approved" ? "success" : status === "denied" ? "error" : "default";

const ReservationsPage: React.FC = () => {
  const { currentUser } = useAuthState();
  const [catalog, setCatalog] = React.useState<ReservationCatalog>({ shops: [], tools: [] });
  const [shopId, setShopId] = React.useState("");
  const [scope, setScope] = React.useState<"shop" | "tools">("tools");
  const [toolIds, setToolIds] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [endDate, setEndDate] = React.useState(today());
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("10:00");
  const [preview, setPreview] = React.useState<ReservationPreview | null>(null);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [mine, setMine] = React.useState<Reservation[]>([]);
  const [managed, setManaged] = React.useState<Reservation[]>([]);
  const [editing, setEditing] = React.useState<Reservation | null>(null);
  const [editingManaged, setEditingManaged] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const isManager = !!(currentUser.isAdmin || currentUser.isBoardMember ||
    (currentUser.isResourceManager && (currentUser.resourceManagerShopIds || []).length));
  const selectedShop = catalog.shops.find(shop => shop.id === shopId);
  const shopTools = catalog.tools.filter(tool => tool.shopId === shopId);
  const input: ReservationInput = {
    title, shopId, reservationScope: scope, toolIds,
    startAt: asIso(date, startTime), endAt: asIso(endDate, endTime)
  };

  const loadReservations = React.useCallback(async () => {
    const [result, mineResult] = await Promise.all([
      getReservationAvailability({ date, shopId: shopId || undefined }),
      listReservations({ mine: true })
    ]);
    if (result.data) setReservations(result.data);
    if (mineResult.data) setMine(mineResult.data);
    if (isManager) {
      const managerResult = await listManagedReservations({ future: true });
      if (managerResult.data) setManaged(managerResult.data);
    }
  }, [date, shopId, isManager]);

  React.useEffect(() => {
    getReservationCatalog().then(result => {
      if (result.data) {
        setCatalog(result.data);
        const first = result.data.shops[0];
        if (first) {
          setShopId(first.id);
          setScope(first.reservable ? "shop" : "tools");
        }
      } else {
        setError(result.error?.message || "Unable to load reservable resources.");
      }
      setLoading(false);
    });
  }, []);

  React.useEffect(() => { loadReservations(); }, [loadReservations]);

  React.useEffect(() => {
    if (!title.trim() || !shopId || (scope === "tools" && toolIds.length === 0)) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const result = editingManaged && editing
        ? await previewManagedReservation({ id: editing.id, body: input })
        : await previewReservation({ body: input });
      setPreview(result.data || null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [title, shopId, scope, toolIds.join(","), date, endDate, startTime, endTime, editingManaged, editing?.id]);

  const toggleTool = (id: string) =>
    setToolIds(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id]);

  const resetForm = () => {
    setEditing(null);
    setEditingManaged(false);
    setTitle("");
    setToolIds([]);
    setPreview(null);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const result = editing
      ? editingManaged
        ? await updateManagedReservation({ id: editing.id, body: input })
        : await updateReservation({ id: editing.id, body: input })
      : await createReservation({ body: input });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    resetForm();
    await loadReservations();
  };

  const edit = (reservation: Reservation, managedEdit = false) => {
    setEditing(reservation);
    setEditingManaged(managedEdit);
    setTitle(reservation.title);
    setShopId(reservation.shopId);
    setScope(reservation.reservationScope);
    setToolIds(reservation.toolIds || []);
    setDate(moment(reservation.startAt).tz(ZONE).format("YYYY-MM-DD"));
    setEndDate(moment(reservation.endAt).tz(ZONE).format("YYYY-MM-DD"));
    setStartTime(moment(reservation.startAt).tz(ZONE).format("HH:mm"));
    setEndTime(moment(reservation.endAt).tz(ZONE).format("HH:mm"));
  };

  const cancel = async (id: string) => {
    const result = await cancelReservation({ id });
    if (result.error) setError(result.error.message);
    else await loadReservations();
  };

  const decide = async (id: string, approve: boolean) => {
    const result = approve ? await approveReservation({ id }) : await denyReservation({ id });
    if (result.error) setError(result.error.message);
    else await loadReservations();
  };

  const managerCancel = async (id: string) => {
    const result = await cancelManagedReservation({ id });
    if (result.error) setError(result.error.message);
    else await loadReservations();
  };

  const upcomingReservations = mine.filter(item =>
    ["pending", "approved"].includes(item.status) && moment(item.endAt).isAfter(moment()));
  const reservationHistory = mine.filter(item => !upcomingReservations.includes(item)).reverse();
  const pendingManaged = managed.filter(item => item.status === "pending");
  const failedManaged = managed.filter(item => item.calendarSyncStatus === "failed");
  const slots = Array.from({ length: 48 }, (_, index) => moment.tz(date, ZONE).startOf("day").add(index * 30, "minutes"));

  if (loading) return <Grid container justifyContent="center"><CircularProgress /></Grid>;

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12, lg: 10 }}>
        <Typography variant="h5">Reservations</Typography>
        <Typography color="textSecondary">Reserve a shop or checked-out tools in 30-minute increments.</Typography>
      </Grid>
      {error && <Grid size={{ xs: 12, lg: 10 }}><Alert severity="error" onClose={() => setError("")}>{error}</Alert></Grid>}

      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Paper style={{ padding: 20 }}>
          <Typography variant="h6">{editing ? "Edit Reservation" : "New Reservation"}</Typography>
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth required label="Title" value={title} onChange={event => setTitle(event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormLabel>Shop</FormLabel>
              <Select native fullWidth value={shopId} onChange={event => {
                const next = event.target.value as string;
                const shop = catalog.shops.find(item => item.id === next);
                setShopId(next); setToolIds([]); setScope(shop?.reservable ? "shop" : "tools");
              }}>
                {editing && !catalog.shops.some(shop => shop.id === editing.shopId) &&
                  <option value={editing.shopId}>{editing.shopName} (existing reservation)</option>}
                {catalog.shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
              </Select>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormLabel>Resource</FormLabel>
              <Select native fullWidth value={scope} onChange={event => setScope(event.target.value as any)}>
                {selectedShop?.reservable && <option value="shop">Entire shop</option>}
                {shopTools.length > 0 && <option value="tools">One or more tools</option>}
                {editing && editing.reservationScope === "shop" && !selectedShop?.reservable &&
                  <option value="shop">Entire shop (existing reservation)</option>}
                {editing && editing.reservationScope === "tools" && shopTools.length === 0 &&
                  <option value="tools">Tools (existing reservation)</option>}
              </Select>
            </Grid>
            {scope === "tools" && <Grid size={{ xs: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {shopTools.map(tool => <Chip key={tool.id} label={tool.name} clickable onClick={() => toggleTool(tool.id)}
                  color={toolIds.includes(tool.id) ? "primary" : "default"}
                  variant={toolIds.includes(tool.id) ? "filled" : "outlined"} />)}
                {editing && editing.toolIds.filter(id => !shopTools.some(tool => tool.id === id)).map(id => {
                  const index = editing.toolIds.indexOf(id);
                  return <Chip key={id} label={`${editing.toolNames[index] || "Tool"} (existing)`}
                    color="primary" variant="filled" />;
                })}
              </div>
            </Grid>}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="date" label="Start date" value={date} onChange={event => {
                setDate(event.target.value);
                if (endDate < event.target.value) setEndDate(event.target.value);
              }}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="date" label="End date" value={endDate} onChange={event => setEndDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="time" label="Start" value={startTime} onChange={event => setStartTime(event.target.value)}
                slotProps={{ htmlInput: { step: 1800 }, inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="time" label="End" value={endTime} onChange={event => setEndTime(event.target.value)}
                slotProps={{ htmlInput: { step: 1800 }, inputLabel: { shrink: true } }} />
            </Grid>
            {preview && <Grid size={{ xs: 12 }}>
              {preview.requiresApproval && <Alert severity="warning">This reservation will require approval.</Alert>}
              {preview.missingPrerequisites.length > 0 &&
                <Alert severity="error" style={{ marginTop: 6 }}>
                  Missing checkouts: {preview.missingPrerequisites.map(tool => tool.name).join(", ")}
                </Alert>}
              {[...preview.errors, ...preview.conflicts].map(message =>
                <Typography key={message} color="error" variant="body2">{message}</Typography>)}
            </Grid>}
            <Grid size={{ xs: 12 }} style={{ display: "flex", gap: 8 }}>
              <Button variant="contained" disabled={saving || !preview?.eligible} onClick={submit}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Reserve"}
              </Button>
              {editing && <Button onClick={resetForm}>Cancel Edit</Button>}
            </Grid>
          </Grid>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 7, lg: 6 }}>
        <Paper style={{ padding: 16, maxHeight: 650, overflowY: "auto" }}>
          <Typography variant="h6">Day Agenda</Typography>
          {slots.map(slot => {
            const active = reservations.filter(item =>
              moment(item.startAt).isBefore(slot.clone().add(30, "minutes")) &&
              moment(item.endAt).isAfter(slot));
            return <div key={slot.toISOString()} style={{ display: "grid", gridTemplateColumns: "75px 1fr",
              minHeight: 38, borderTop: "1px solid #eee", padding: "5px 0" }}>
              <Typography variant="caption">{slot.format("h:mm A")}</Typography>
              <div>{active.map(item => <Chip key={item.id}
                label={`${item.title} — ${item.memberName} · ${item.toolNames?.join(", ") || item.shopName} · ${moment(item.startAt).tz(ZONE).format("h:mm A")}–${moment(item.endAt).tz(ZONE).format("h:mm A")} · ${item.status}`}
                color={statusColor(item.status)} size="small" style={{ margin: 2 }} />)}</div>
            </div>;
          })}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, lg: 10 }}>
        <Typography variant="h6">My Reservations</Typography>
        <Typography variant="subtitle2" style={{ marginTop: 8 }}>Upcoming</Typography>
        {upcomingReservations.length === 0 && <Typography color="textSecondary">No upcoming reservations.</Typography>}
        {upcomingReservations.map(item => <Paper key={item.id} style={{ padding: 12, marginTop: 8 }}>
          <Grid container alignItems="center" spacing={1}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <strong>{item.title}</strong>{" "}
              <Chip label={item.status} color={statusColor(item.status)} size="small" />
              <Typography variant="body2">{moment(item.startAt).tz(ZONE).format("MMM D, h:mm A")}–{moment(item.endAt).tz(ZONE).format("h:mm A")} · {item.toolNames?.join(", ") || item.shopName}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }} style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              {["pending", "approved"].includes(item.status) && moment(item.endAt).isAfter(moment()) && <>
                <Button size="small" onClick={() => edit(item)}>Edit</Button>
                <Button size="small" color="secondary" onClick={() => cancel(item.id)}>Cancel</Button>
              </>}
            </Grid>
          </Grid>
        </Paper>)}
        <Typography variant="subtitle2" style={{ marginTop: 16 }}>History</Typography>
        {reservationHistory.length === 0 && <Typography color="textSecondary">No reservation history.</Typography>}
        {reservationHistory.map(item => <Paper key={item.id} style={{ padding: 12, marginTop: 8 }}>
          <strong>{item.title}</strong>{" "}
          <Chip label={item.status} color={statusColor(item.status)} size="small" />
          <Typography variant="body2">
            {moment(item.startAt).tz(ZONE).format("MMM D, YYYY h:mm A")}–
            {moment(item.endAt).tz(ZONE).format("MMM D, YYYY h:mm A")} · {item.toolNames?.join(", ") || item.shopName}
          </Typography>
        </Paper>)}
      </Grid>

      {isManager && <Grid size={{ xs: 12, lg: 10 }}>
        <Typography variant="h6">Pending Approval</Typography>
        {pendingManaged.length === 0 && <Typography color="textSecondary">No pending reservations in your managed shops.</Typography>}
        {pendingManaged.map(item => <Paper key={item.id} style={{ padding: 12, marginTop: 8 }}>
          <Grid container alignItems="center">
            <Grid size={{ xs: 12, sm: 8 }}>
              <strong>{item.title}</strong> — {item.memberName}
              <Typography variant="body2">{item.shopName}: {item.toolNames?.join(", ") || "Entire shop"} · {moment(item.startAt).tz(ZONE).format("MMM D, h:mm A")}–{moment(item.endAt).tz(ZONE).format("h:mm A")}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button size="small" color="primary" onClick={() => decide(item.id, true)}>Approve</Button>
              <Button size="small" color="secondary" onClick={() => decide(item.id, false)}>Deny</Button>
              <Button size="small" onClick={() => edit(item, true)}>Edit</Button>
              <Button size="small" onClick={() => managerCancel(item.id)}>Cancel</Button>
            </Grid>
          </Grid>
        </Paper>)}
        {failedManaged.length > 0 && <>
          <Typography variant="h6" style={{ marginTop: 18 }}>Calendar Sync Warnings</Typography>
          {failedManaged.map(item => <Alert key={item.id} severity="warning" style={{ marginTop: 8 }}>
            <strong>{item.title}</strong>: {item.calendarSyncError || "Calendar synchronization failed."}
          </Alert>)}
        </>}
      </Grid>}
    </Grid>
  );
};

export default ReservationsPage;
