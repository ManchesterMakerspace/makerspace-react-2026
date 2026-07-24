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
import Slider from "@mui/material/Slider";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import {
  approveReservation, cancelManagedReservation, cancelReservation, createManagedReservation,
  createReservation, denyReservation,
  getReservationAvailability, getReservationCatalog, listManagedReservations, listReservations,
  previewManagedReservation, previewManagedReservationCreation, previewReservation,
  updateManagedReservation, updateReservation
} from "api/reservations";
import { Reservation, ReservationCatalog, ReservationInput, ReservationPreview } from "app/entities/reservation";
import { Shop, Tool } from "app/entities/toolCheckout";
import moment from "ui/utils/moment";
import { useAuthState } from "ui/reducer/hooks";
import MemberSearchInput from "ui/common/MemberSearchInput";

const ZONE = "America/New_York";
const nextWholeHour = () => moment.tz(ZONE).add(1, "hour").startOf("hour");
const parseStart = (date: string, time: string) => moment.tz(
  `${date} ${time.trim()}`,
  ["YYYY-MM-DD HH:mm", "YYYY-MM-DD H:mm", "YYYY-MM-DD h:mm A", "YYYY-MM-DD h A"],
  true,
  ZONE
);
const statusColor = (status: string): "default" | "primary" | "warning" | "success" | "error" =>
  status === "pending" ? "warning" : status === "approved" ? "success" : status === "denied" ? "error" : "default";

const ReservationsPage: React.FC = () => {
  const { currentUser } = useAuthState();
  const initialStart = React.useMemo(nextWholeHour, []);
  const [catalog, setCatalog] = React.useState<ReservationCatalog>({ shops: [], tools: [] });
  const [shopId, setShopId] = React.useState("");
  const [scope, setScope] = React.useState<"shop" | "tools">("tools");
  const [toolIds, setToolIds] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(initialStart.format("YYYY-MM-DD"));
  const [startTime, setStartTime] = React.useState(initialStart.format("HH:mm"));
  const [durationHours, setDurationHours] = React.useState(1);
  const [preview, setPreview] = React.useState<ReservationPreview | null>(null);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [mine, setMine] = React.useState<Reservation[]>([]);
  const [managed, setManaged] = React.useState<Reservation[]>([]);
  const [editing, setEditing] = React.useState<Reservation | null>(null);
  const [editingManaged, setEditingManaged] = React.useState(false);
  const [creatingForMember, setCreatingForMember] = React.useState(false);
  const [targetMemberId, setTargetMemberId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const canCreateReservation = !!currentUser.isBoardMember ||
    (currentUser.status === "activeMember" &&
      !!currentUser.expirationTime && currentUser.expirationTime > Date.now());
  const isManager = !!(currentUser.isAdmin || currentUser.isBoardMember ||
    (currentUser.isResourceManager && (currentUser.resourceManagerShopIds || []).length));
  const canUseCreateUi = canCreateReservation;
  const managedShopIds = currentUser.resourceManagerShopIds || [];
  const availableShops = creatingForMember && currentUser.isResourceManager &&
    !currentUser.isAdmin && !currentUser.isBoardMember
    ? catalog.shops.filter(shop => managedShopIds.includes(shop.id))
    : catalog.shops;
  const selectedShop = availableShops.find(shop => shop.id === shopId);
  const shopTools = catalog.tools.filter(tool => tool.shopId === shopId);
  const selectedTools = shopTools.filter(tool => toolIds.includes(tool.id));
  const resourceConfiguredMaximum = scope === "shop"
    ? Number(selectedShop?.maxReservationDurationHours || 8)
    : selectedTools.length
      ? Math.min(...selectedTools.map(tool => Number(tool.maxReservationDurationHours || 8)))
      : 8;
  const originalDuration = editing
    ? moment(editing.endAt).diff(moment(editing.startAt), "minutes") / 60
    : 0;
  const configuredMaximum = editing
    ? Math.max(resourceConfiguredMaximum, originalDuration)
    : resourceConfiguredMaximum;
  const previewMaximum = preview?.maximumDurationHours;
  const effectiveMaximum = previewMaximum === undefined ? configuredMaximum : previewMaximum;
  const sliderMaximum = Math.max(0.5, effectiveMaximum);
  const startMoment = parseStart(date, startTime);
  const validStart = startMoment.isValid();
  const endMoment = validStart ? startMoment.clone().add(durationHours, "hours") : null;
  const usesMeridiem = /\b(am|pm)\b/i.test(startTime);
  const input: ReservationInput = {
    title, shopId, reservationScope: scope, toolIds,
    startAt: validStart ? startMoment.toISOString() : "",
    endAt: endMoment ? endMoment.toISOString() : ""
  };

  const loadReservations = React.useCallback(async () => {
    const [availabilityResult, mineResult] = await Promise.all([
      canUseCreateUi
        ? getReservationAvailability({ date, shopId: shopId || undefined })
        : Promise.resolve({ data: [] as Reservation[] }),
      listReservations({ mine: true })
    ]);
    if (availabilityResult.data) setReservations(availabilityResult.data);
    if (mineResult.data) setMine(mineResult.data);
    if (isManager) {
      const [futureResult, cancelledResult] = await Promise.all([
        listManagedReservations({ future: true }),
        listManagedReservations({ status: "cancelled" })
      ]);
      const combined = [...(futureResult.data || []), ...(cancelledResult.data || [])];
      setManaged(Array.from(new Map(combined.map(item => [item.id, item])).values()));
    }
  }, [date, shopId, isManager, canUseCreateUi]);

  React.useEffect(() => {
    if (!canUseCreateUi) {
      setLoading(false);
      return;
    }
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
  }, [canUseCreateUi]);

  React.useEffect(() => {
    if (!creatingForMember || availableShops.some(shop => shop.id === shopId)) return;
    const first = availableShops[0];
    setShopId(first?.id || "");
    setToolIds([]);
    setScope(first?.reservable ? "shop" : "tools");
  }, [creatingForMember, shopId, availableShops.map(shop => shop.id).join(",")]);

  React.useEffect(() => { loadReservations(); }, [loadReservations]);

  React.useEffect(() => {
    if (!canUseCreateUi || !validStart || !title.trim() || !shopId ||
        (creatingForMember && !targetMemberId) ||
        (scope === "tools" && toolIds.length === 0)) {
      setPreview(null);
      return;
    }
    setPreview(null);
    const timer = window.setTimeout(async () => {
      const result = editingManaged && editing
        ? await previewManagedReservation({ id: editing.id, body: input })
        : creatingForMember
          ? await previewManagedReservationCreation({ memberId: targetMemberId, body: input })
        : await previewReservation({ body: input });
      setPreview(result.data || null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [canUseCreateUi, creatingForMember, targetMemberId, validStart, title, shopId, scope,
      toolIds.join(","), date, startTime, durationHours, editingManaged, editing?.id]);

  React.useEffect(() => {
    if (effectiveMaximum < 0.5 && durationHours !== 0.5) {
      setDurationHours(0.5);
    } else if (effectiveMaximum >= 0.5 && durationHours > effectiveMaximum) {
      setDurationHours(Math.floor(effectiveMaximum * 2) / 2);
    }
  }, [effectiveMaximum, durationHours]);

  const toggleTool = (id: string) =>
    setToolIds(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id]);

  const resetForm = () => {
    const nextStart = nextWholeHour();
    const firstShop = catalog.shops[0];
    setEditing(null);
    setEditingManaged(false);
    setCreatingForMember(false);
    setTargetMemberId("");
    setTitle("");
    setShopId(firstShop?.id || "");
    setScope(firstShop?.reservable ? "shop" : "tools");
    setToolIds([]);
    setDate(nextStart.format("YYYY-MM-DD"));
    setStartTime(nextStart.format("HH:mm"));
    setDurationHours(1);
    setPreview(null);
    setError("");
    setSuccess("");
  };

  const submit = async () => {
    const creating = !editing;
    setSaving(true);
    setError("");
    setSuccess("");
    const result = editing
      ? editingManaged
        ? await updateManagedReservation({ id: editing.id, body: input })
        : await updateReservation({ id: editing.id, body: input })
      : creatingForMember
        ? await createManagedReservation({ memberId: targetMemberId, body: input })
        : await createReservation({ body: input });
    setSaving(false);
    if (result.error) {
      setError(
        result.error.message ||
        result.response?.data?.message ||
        "The reservation could not be saved."
      );
      return;
    }

    const savedReservation = result.data;
    resetForm();
    setSuccess(
      creating
        ? `Reservation "${savedReservation?.title || input.title}" was created successfully` +
          `${savedReservation?.status ? ` with status ${savedReservation.status}` : ""}.`
        : `Reservation "${savedReservation?.title || input.title}" was updated successfully.`
    );
    await loadReservations();
  };

  const edit = (reservation: Reservation, managedEdit = false) => {
    setError("");
    setSuccess("");
    setEditing(reservation);
    setEditingManaged(managedEdit);
    setTitle(reservation.title);
    setShopId(reservation.shopId);
    setScope(reservation.reservationScope);
    setToolIds(reservation.toolIds || []);
    setDate(moment(reservation.startAt).tz(ZONE).format("YYYY-MM-DD"));
    setStartTime(moment(reservation.startAt).tz(ZONE).format("HH:mm"));
    setDurationHours(moment(reservation.endAt).diff(moment(reservation.startAt), "minutes") / 60);
  };

  const cancel = async (id: string) => {
    setError("");
    setSuccess("");
    const result = await cancelReservation({ id });
    if (result.error) setError(result.error.message);
    else await loadReservations();
  };

  const decide = async (id: string, approve: boolean) => {
    setError("");
    setSuccess("");
    const result = approve ? await approveReservation({ id }) : await denyReservation({ id });
    if (result.error) setError(result.error.message);
    else await loadReservations();
  };

  const managerCancel = async (id: string) => {
    setError("");
    setSuccess("");
    const result = await cancelManagedReservation({ id });
    if (result.error) setError(result.error.message);
    else await loadReservations();
  };

  const upcomingReservations = mine.filter(item =>
    ["pending", "approved"].includes(item.status) && moment(item.endAt).isAfter(moment()));
  const reservationHistory = mine.filter(item => !upcomingReservations.includes(item)).reverse();
  const pendingManaged = managed.filter(item => item.status === "pending");
  const cancelledManaged = managed.filter(item => item.status === "cancelled").reverse();
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
      {success && <Grid size={{ xs: 12, lg: 10 }}>
        <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>
      </Grid>}
      {!canCreateReservation && <Grid size={{ xs: 12, lg: 10 }}>
        <Alert severity="info">
          Your membership is inactive or expired. You may cancel your existing reservations,
          but cannot create or edit reservations.
        </Alert>
      </Grid>}

      {canUseCreateUi && <><Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Paper style={{ padding: 20 }}>
          <Typography variant="h6">{editing ? "Edit Reservation" : "New Reservation"}</Typography>
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            {isManager && !editing && <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox checked={creatingForMember}
                  disabled={!canCreateReservation}
                  onChange={event => {
                    setCreatingForMember(event.target.checked);
                    setTargetMemberId("");
                    setPreview(null);
                  }} />}
                label="Create on behalf of another member"
              />
              {creatingForMember && (
                <MemberSearchInput
                  name="reservation-target-member"
                  placeholder="Search active members by name or email"
                  excludeExpired
                  excludeIds={[currentUser.id]}
                  onChange={selection => setTargetMemberId(selection?.value || "")}
                />
              )}
            </Grid>}
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth required label="Title" value={title} onChange={event => setTitle(event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormLabel>Shop</FormLabel>
              <Select native fullWidth value={shopId} onChange={event => {
                const next = event.target.value as string;
                const shop = availableShops.find(item => item.id === next);
                setShopId(next); setToolIds([]); setScope(shop?.reservable ? "shop" : "tools");
              }}>
                {editing && !catalog.shops.some(shop => shop.id === editing.shopId) &&
                  <option value={editing.shopId}>{editing.shopName} (existing reservation)</option>}
                {availableShops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
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
              <TextField fullWidth type="date" label="Start date" value={date}
                onChange={event => setDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Start time" value={startTime}
                onChange={event => setStartTime(event.target.value)}
                placeholder="09:00"
                error={!!startTime && !validStart}
                helperText={validStart ? "24-hour time (00:00–23:30), or enter AM/PM explicitly" : "Enter HH:mm, such as 18:30, or 6:30 PM"} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth type="number" label="Duration (hours)" value={durationHours}
                disabled={effectiveMaximum < 0.5}
                onChange={event => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  const rounded = Math.round(value * 2) / 2;
                  setDurationHours(Math.max(0.5, Math.min(sliderMaximum, rounded)));
                }}
                slotProps={{ htmlInput: { min: 0.5, max: sliderMaximum, step: 0.5 } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }} style={{ paddingLeft: 12, paddingRight: 12 }}>
              <Typography variant="caption">Duration: {durationHours} hour{durationHours === 1 ? "" : "s"}</Typography>
              <Slider min={0.5} max={sliderMaximum} step={0.5} value={Math.min(durationHours, sliderMaximum)}
                disabled={effectiveMaximum < 0.5}
                valueLabelDisplay="auto"
                marks={sliderMaximum <= 12}
                onChange={(_, value) => setDurationHours(value as number)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Alert severity={effectiveMaximum < 0.5 ? "warning" : "info"}>
                {endMoment
                  ? `Computed end: ${endMoment.format(usesMeridiem ? "MMM D, YYYY h:mm A" : "MMM D, YYYY HH:mm")}`
                  : "Enter a valid start date and time."}
                {effectiveMaximum < 0.5
                  ? " No 30-minute reservation fits within the current availability and membership limits."
                  : ` Maximum available duration: ${effectiveMaximum} hour${effectiveMaximum === 1 ? "" : "s"}.`}
              </Alert>
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
              {editing && <Button onClick={() => resetForm()}>Cancel Edit</Button>}
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
              <Typography variant="caption">{slot.format("HH:mm")}</Typography>
              <div>{active.map(item => <Chip key={item.id}
                label={`${item.title} — ${item.memberName} · ${item.toolNames?.join(", ") || item.shopName} · ${moment(item.startAt).tz(ZONE).format("HH:mm")}–${moment(item.endAt).tz(ZONE).format("HH:mm")} · ${item.status}`}
                color={statusColor(item.status)} size="small" style={{ margin: 2 }} />)}</div>
            </div>;
          })}
        </Paper>
      </Grid></>}

      <Grid size={{ xs: 12, lg: 10 }}>
        <Typography variant="h6">My Reservations</Typography>
        <Typography variant="subtitle2" style={{ marginTop: 8 }}>Upcoming</Typography>
        {upcomingReservations.length === 0 && <Typography color="textSecondary">No upcoming reservations.</Typography>}
        {upcomingReservations.map(item => <Paper key={item.id} style={{ padding: 12, marginTop: 8 }}>
          <Grid container alignItems="center" spacing={1}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <strong>{item.title}</strong>{" "}
              <Chip label={item.status} color={statusColor(item.status)} size="small" />
              <Typography variant="body2">{moment(item.startAt).tz(ZONE).format("MMM D, HH:mm")}–{moment(item.endAt).tz(ZONE).format("HH:mm")} · {item.toolNames?.join(", ") || item.shopName}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }} style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              {["pending", "approved"].includes(item.status) && moment(item.endAt).isAfter(moment()) && <>
                {canCreateReservation && <Button size="small" onClick={() => edit(item)}>Edit</Button>}
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
            {moment(item.startAt).tz(ZONE).format("MMM D, YYYY HH:mm")}–
            {moment(item.endAt).tz(ZONE).format("MMM D, YYYY HH:mm")} · {item.toolNames?.join(", ") || item.shopName}
          </Typography>
        </Paper>)}
      </Grid>

      {isManager && <Grid size={{ xs: 12, lg: 10 }}>
        {canCreateReservation && <>
          <Typography variant="h6">Pending Approval</Typography>
          {pendingManaged.length === 0 && <Typography color="textSecondary">No pending reservations in your managed shops.</Typography>}
          {pendingManaged.map(item => <Paper key={item.id} style={{ padding: 12, marginTop: 8 }}>
            <Grid container alignItems="center">
              <Grid size={{ xs: 12, sm: 8 }}>
                <strong>{item.title}</strong> — {item.memberName}
                <Typography variant="body2">{item.shopName}: {item.toolNames?.join(", ") || "Entire shop"} · {moment(item.startAt).tz(ZONE).format("MMM D, HH:mm")}–{moment(item.endAt).tz(ZONE).format("HH:mm")}</Typography>
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
        </>}
        <Typography variant="h6" style={{ marginTop: 18 }}>Cancelled in Managed Shops</Typography>
        {cancelledManaged.length === 0 &&
          <Typography color="textSecondary">No cancelled reservations in your managed shops.</Typography>}
        {cancelledManaged.map(item => <Paper key={item.id} style={{ padding: 12, marginTop: 8 }}>
          <strong>{item.title}</strong> — {item.memberName}{" "}
          <Chip label={item.status} color={statusColor(item.status)} size="small" />
          <Typography variant="body2">
            {item.shopName}: {item.toolNames?.join(", ") || "Entire shop"} ·{" "}
            {moment(item.startAt).tz(ZONE).format("MMM D, YYYY HH:mm")}–
            {moment(item.endAt).tz(ZONE).format("MMM D, YYYY HH:mm")}
          </Typography>
        </Paper>)}
      </Grid>}
    </Grid>
  );
};

export default ReservationsPage;
