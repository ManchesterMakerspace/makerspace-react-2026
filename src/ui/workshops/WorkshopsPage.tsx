import * as React from "react";
import { Link } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";

import {
  adminCreateShop, adminCreateTool
} from "api/toolCheckouts";
import { listWorkshops } from "api/workshops";
import {
  cancelReservation, getReservationAvailability, getReservationBlackouts
} from "api/reservations";
import { claimVolunteerTask } from "api/volunteer";
import {
  SlackChannelDetails, Workshop, WorkshopTool, WorkshopsResponse
} from "app/entities/workshop";
import {
  Reservation, ReservationBlackoutOccurrence
} from "app/entities/reservation";
import { Routing } from "app/constants";
import FormModal from "ui/common/FormModal";
import { useAuthState } from "ui/reducer/hooks";
import moment from "ui/utils/moment";
import RequestCheckoutModal from "./RequestCheckoutModal";
import { googleDriveEmbeddedFolderUrl } from "./workshopUrls";
import { workshopReservationRows } from "./workshopReservations";

const ZONE = "America/New_York";
type WorkshopTab =
  "details" | "tools" | "reservations" | "documentation" | "volunteer";

const normalizeChannel = (value: string) =>
  value.replace(/^#+/, "");

const SlackChannel: React.FC<{
  name?: string;
  details?: SlackChannelDetails;
}> = ({ name, details }) => {
  if (!name) return <>Not configured</>;
  const label = `#${name}`;
  return details?.slackUrl
    ? <a href={details.slackUrl}>{label}</a>
    : <>{label}</>;
};

const AddShopModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [name, setName] = React.useState("");
  const [wikiUrl, setWikiUrl] = React.useState("");
  const [gdriveId, setGdriveId] = React.useState("");
  const [slackChannel, setSlackChannel] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const result = await adminCreateShop({
      body: {
        name: name.trim(),
        wikiUrlOverride: wikiUrl,
        gdriveId,
        slackChannel
      }
    });
    setSaving(false);
    if (result.error) setError(result.error.message);
    else onCreated();
  };

  return (
    <FormModal id="workshops-add-shop" isOpen title="Add Shop"
      closeHandler={onClose} onSubmit={submit} submitText="Add Shop"
      loading={saving} error={error}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth required label="Shop Name" value={name}
            onChange={event => setName(event.target.value)} autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Wiki URL" value={wikiUrl}
            onChange={event => setWikiUrl(event.target.value)}
            helperText="Leave blank to generate WIKI_URL/workshops/slugified-shop-name." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="GDrive ID" value={gdriveId}
            onChange={event => setGdriveId(event.target.value)}
            helperText="Optional Google Drive folder ID." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Slack Channel" value={slackChannel}
            onChange={event => setSlackChannel(normalizeChannel(event.target.value))} />
        </Grid>
      </Grid>
    </FormModal>
  );
};

const AddToolModal: React.FC<{
  workshop: Workshop;
  onClose: () => void;
  onCreated: () => void;
}> = ({ workshop, onClose, onCreated }) => {
  const [name, setName] = React.useState("");
  const [wikiUrl, setWikiUrl] = React.useState("");
  const [gdriveId, setGdriveId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [usersChannel, setUsersChannel] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const result = await adminCreateTool({
      body: {
        name: name.trim(),
        shopId: workshop.id,
        wikiUrlOverride: wikiUrl,
        gdriveId,
        description,
        usersChannel,
        prerequisiteIds: [],
        reservationPrerequisiteToolIds: []
      }
    });
    setSaving(false);
    if (result.error) setError(result.error.message);
    else onCreated();
  };

  return (
    <FormModal id="workshops-add-tool" isOpen title={`Add Tool to ${workshop.name}`}
      closeHandler={onClose} onSubmit={submit} submitText="Add Tool"
      loading={saving} error={error}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth required label="Tool Name" value={name}
            onChange={event => setName(event.target.value)} autoFocus />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Description" value={description}
            onChange={event => setDescription(event.target.value)} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Wiki URL" value={wikiUrl}
            onChange={event => setWikiUrl(event.target.value)}
            helperText="Leave blank to generate the workshop/tool Wiki URL." />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="GDrive ID" value={gdriveId}
            onChange={event => setGdriveId(event.target.value)} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField fullWidth label="Users Channel" value={usersChannel}
            onChange={event => setUsersChannel(normalizeChannel(event.target.value))} />
        </Grid>
      </Grid>
    </FormModal>
  );
};

const WorkshopDetails: React.FC<{ workshop: Workshop }> = ({ workshop }) => (
  <>
    <Typography variant="h6">{workshop.name}</Typography>
    <Typography>
      Wiki: <a href={workshop.wikiUrl} target="_blank" rel="noopener noreferrer">
        {workshop.wikiUrl}
      </a>
    </Typography>
    <Typography>
      Slack channel:{" "}
      <SlackChannel name={workshop.slackChannel}
        details={workshop.slackChannelDetails} />
    </Typography>
    {workshop.slackChannelDetails?.topic &&
      <Typography variant="body2">Topic: {workshop.slackChannelDetails.topic}</Typography>}
    {workshop.slackChannelDetails?.purpose &&
      <Typography variant="body2">Purpose: {workshop.slackChannelDetails.purpose}</Typography>}

    <Typography variant="subtitle1" style={{ marginTop: 14 }}>
      <a href={workshop.resourceManagersWikiUrl} target="_blank" rel="noopener noreferrer">
        Resource Managers
      </a>
    </Typography>
    {workshop.resourceManagers.length === 0 &&
      <Typography color="textSecondary">No resource managers assigned.</Typography>}
    {workshop.resourceManagers.map(manager => (
      <div key={manager.id}>
        {manager.slackUrl
          ? <a href={manager.slackUrl}>{manager.name}</a>
          : manager.name}
      </div>
    ))}

    <Typography variant="subtitle1" style={{ marginTop: 18 }}>
      Upcoming Volunteer Events
    </Typography>
    {workshop.upcomingVolunteerEvents.length === 0 &&
      <Typography color="textSecondary">No upcoming volunteer events.</Typography>}
    {workshop.upcomingVolunteerEvents.map(event => (
      <Paper key={event.id} variant="outlined" style={{ padding: 10, marginTop: 8 }}>
        <strong>{event.title}</strong>{" "}
        <Chip size="small" label={`${event.creditValue} credits`} />
        <Typography variant="body2">
          {moment(event.eventDate).format("MMM D, YYYY")}
        </Typography>
        {event.description && <Typography variant="body2">{event.description}</Typography>}
      </Paper>
    ))}
  </>
);

const WorkshopTools: React.FC<{
  workshop: Workshop;
  onRefresh: () => void;
}> = ({ workshop, onRefresh }) => {
  const [addOpen, setAddOpen] = React.useState(false);
  const [requestTool, setRequestTool] = React.useState<WorkshopTool | null>(null);

  return (
    <>
      <Grid container justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Tools</Typography>
        {workshop.canAddTool &&
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}>Add Tool</Button>}
      </Grid>

      {workshop.tools.length === 0 &&
        <Typography color="textSecondary">No visible tools in this workshop.</Typography>}
      {workshop.tools.map(tool => (
        <Paper key={tool.id} variant="outlined" style={{
          padding: 12,
          marginTop: 10,
          opacity: tool.disabled ? 0.65 : 1
        }}>
          <Grid container spacing={1} justifyContent="space-between">
            <Grid size={{ xs: 12, md: 8 }}>
              <a href={tool.wikiUrl} target="_blank" rel="noopener noreferrer">
                <strong>{tool.name}</strong>
              </a>{" "}
              {tool.disabled && <Chip size="small" label="Hidden" />}
              {tool.description && <Typography variant="body2">{tool.description}</Typography>}
              {tool.prerequisiteNames.length > 0 &&
                <Typography variant="caption" display="block">
                  Checkout prerequisites: {tool.prerequisiteNames.join(", ")}
                </Typography>}

              {tool.checkout && <>
                <Typography variant="body2" style={{ marginTop: 5 }}>
                  Checkout: {tool.checkout.active ? "Active" : "Revoked"}
                  {tool.checkout.checkedOutAt
                    ? ` since ${moment(tool.checkout.checkedOutAt).format("MMM D, YYYY")}`
                    : ""}
                  {tool.checkout.approvedByName
                    ? `, approved by ${tool.checkout.approvedByName}`
                    : ""}
                </Typography>
              </>}

              {tool.checkoutRequest &&
                <Typography variant="body2" style={{ marginTop: 5 }}>
                  Checkout request pending
                  {tool.checkoutRequest.requestDate
                    ? ` since ${moment(tool.checkoutRequest.requestDate).format("MMM D, YYYY")}`
                    : ""}
                  {tool.checkoutRequest.note ? ` — ${tool.checkoutRequest.note}` : ""}
                </Typography>}

              {tool.checkout?.active && tool.usersChannel &&
                <Typography variant="body2">
                  Users channel:{" "}
                  <SlackChannel name={tool.usersChannel}
                    details={tool.usersChannelDetails} />
                </Typography>}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} style={{
              display: "flex",
              gap: 7,
              justifyContent: "flex-end",
              alignItems: "flex-start",
              flexWrap: "wrap"
            }}>
              {tool.gdriveId &&
                <Button size="small" variant="outlined"
                  href={`https://drive.google.com/drive/folders/${encodeURIComponent(tool.gdriveId)}`}
                  target="_blank" rel="noopener noreferrer">
                  Docs
                </Button>}
              {tool.checkoutRequestable &&
                <Button size="small" variant="outlined"
                  onClick={() => setRequestTool(tool)}>
                  Request Checkout
                </Button>}
              {tool.reservationAvailable &&
                <Button size="small" variant="contained" component={Link}
                  to={`${Routing.Reservations}?shop=${workshop.id}&tool=${tool.id}`}>
                  Reserve
                </Button>}
            </Grid>
          </Grid>
        </Paper>
      ))}

      {addOpen && <AddToolModal workshop={workshop}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); onRefresh(); }} />}
      <RequestCheckoutModal tool={requestTool}
        onClose={() => setRequestTool(null)}
        onCreated={() => { setRequestTool(null); onRefresh(); }} />
    </>
  );
};

const WorkshopReservations: React.FC<{ workshop: Workshop }> = ({ workshop }) => {
  const { currentUser } = useAuthState();
  const [date, setDate] = React.useState(moment.tz(ZONE).format("YYYY-MM-DD"));
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [blackouts, setBlackouts] = React.useState<ReservationBlackoutOccurrence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const [reservationResult, blackoutResult] = await Promise.all([
      getReservationAvailability({ date, shopId: workshop.id }),
      getReservationBlackouts({ date, shopId: workshop.id })
    ]);
    setReservations(reservationResult.data || []);
    setBlackouts(blackoutResult.data || []);
    setError(reservationResult.error?.message || blackoutResult.error?.message || "");
    setLoading(false);
  }, [date, workshop.id]);

  React.useEffect(() => { load(); }, [load]);

  const cancel = async (reservation: Reservation) => {
    if (!window.confirm(`Cancel "${reservation.title}"?`)) return;
    const result = await cancelReservation({ id: reservation.id });
    if (result.error) setError(result.error.message);
    else load();
  };

  const rows = workshopReservationRows(reservations, blackouts);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 5 }}>
        <TextField fullWidth type="date" label="Day" value={date}
          onChange={event => setDate(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }} />
      </Grid>
      <Grid size={{ xs: 12, sm: 7 }} style={{ textAlign: "right" }}>
        <Button component={Link} to={`${Routing.Reservations}?shop=${workshop.id}`}
          variant="contained">Make a Reservation</Button>
      </Grid>
      {error && <Grid size={{ xs: 12 }}><Alert severity="error">{error}</Alert></Grid>}
      <Grid size={{ xs: 12 }}>
        {loading && <CircularProgress size={24} />}
        {!loading && rows.length === 0 &&
          <Typography color="textSecondary">No reservations or blackouts for this day.</Typography>}
        {rows.map(row => row.kind === "blackout" ? (
          <Paper key={`${row.blackout.blackoutId}-${row.blackout.startAt}`}
            variant="outlined" style={{
              padding: 10,
              marginTop: 8,
              background: "rgba(97, 97, 97, 0.18)"
            }}>
            <strong>No Reservations Available: {row.blackout.title}</strong>
            <Typography variant="body2">
              {moment(row.blackout.startAt).tz(ZONE).format("HH:mm")}–
              {moment(row.blackout.endAt).tz(ZONE).format("HH:mm")}
            </Typography>
          </Paper>
        ) : (
          <Paper key={row.reservation.id} variant="outlined"
            style={{ padding: 10, marginTop: 8 }}>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid>
                <strong>{row.reservation.title}</strong>{" "}
                <Chip size="small" label={row.reservation.status} />
                <Typography variant="body2">
                  {moment(row.reservation.startAt).tz(ZONE).format("HH:mm")}–
                  {moment(row.reservation.endAt).tz(ZONE).format("HH:mm")} ·{" "}
                  {row.reservation.memberName} ·{" "}
                  {row.reservation.toolNames?.join(", ") || "Entire shop"}
                </Typography>
              </Grid>
              {row.reservation.memberId === currentUser.id &&
                <Grid style={{ display: "flex", gap: 6 }}>
                  <Button size="small" startIcon={<EditIcon />} component={Link}
                    to={`${Routing.Reservations}?edit=${row.reservation.id}`}>
                    Edit
                  </Button>
                  <Button size="small" color="secondary" startIcon={<CancelIcon />}
                    onClick={() => cancel(row.reservation)}>
                    Cancel
                  </Button>
                </Grid>}
            </Grid>
          </Paper>
        ))}
      </Grid>
    </Grid>
  );
};

const WorkshopVolunteer: React.FC<{
  workshop: Workshop;
  onRefresh: () => void;
}> = ({ workshop, onRefresh }) => {
  const [claimingId, setClaimingId] = React.useState("");
  const [error, setError] = React.useState("");

  const claim = async (id: string) => {
    setClaimingId(id);
    const result = await claimVolunteerTask({ id });
    setClaimingId("");
    if (result.error) setError(
      typeof result.error === "string" ? result.error : result.error.message
    );
    else onRefresh();
  };

  return (
    <>
      <Grid container justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Available Bounty Tasks</Typography>
        {workshop.canCreateVolunteerTask &&
          <Button component={Link}
            to={`${Routing.Volunteer}?shop=${workshop.id}&createTask=true`}
            variant="contained" startIcon={<AddIcon />}>
            Create Bounty Task
          </Button>}
      </Grid>
      {error && <Alert severity="error" style={{ marginTop: 8 }}>{error}</Alert>}

      {workshop.volunteerTasks.length === 0 && !workshop.isShopManager && <>
        <Typography style={{ marginTop: 12 }}>
          Contact a Resource Manager to ask about volunteer opportunities in this workshop.
        </Typography>
        {workshop.resourceManagers.map(manager => (
          <div key={manager.id}>
            {manager.slackUrl
              ? <a href={manager.slackUrl}>{manager.name}</a>
              : manager.name}
          </div>
        ))}
      </>}
      {workshop.volunteerTasks.length === 0 && workshop.isShopManager &&
        <Typography color="textSecondary" style={{ marginTop: 12 }}>
          No visible bounty tasks are currently available.
        </Typography>}

      {workshop.volunteerTasks.map(task => (
        <Paper key={task.id} variant="outlined" style={{
          padding: 12,
          marginTop: 10,
          opacity: task.eligible ? 1 : 0.45,
          background: task.eligible ? undefined : "rgba(0, 0, 0, 0.04)"
        }}>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid size={{ xs: 12, md: 9 }}>
              <strong>#{task.taskNumber} — {task.title}</strong>{" "}
              <Chip size="small" label={`${task.creditValue} credits`} />
              <Typography variant="body2">{task.description}</Typography>
              {task.prerequisiteToolNames.length > 0 &&
                <Typography variant="caption" display="block">
                  Prerequisites: {task.prerequisiteToolNames.join(", ")}
                </Typography>}
              {!task.eligible && task.missingPrerequisiteToolNames.length > 0 &&
                <Typography variant="caption" display="block">
                  Missing checkouts: {task.missingPrerequisiteToolNames.join(", ")}
                </Typography>}
            </Grid>
            <Grid>
              {task.eligible &&
                <Button variant="contained" size="small"
                  startIcon={<AssignmentIcon />}
                  disabled={claimingId === task.id}
                  onClick={() => claim(task.id)}>
                  Claim
                </Button>}
            </Grid>
          </Grid>
        </Paper>
      ))}
    </>
  );
};

const WorkshopsPage: React.FC = () => {
  const [data, setData] = React.useState<WorkshopsResponse>({
    canAddShop: false,
    workshops: [],
  });
  const [selectedId, setSelectedId] = React.useState("");
  const [tab, setTab] = React.useState<WorkshopTab>("details");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const result = await listWorkshops();
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setData(result.data);
      setSelectedId(current =>
        result.data!.workshops.some(shop => shop.id === current)
          ? current
          : result.data!.workshops[0]?.id || ""
      );
      setError("");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const workshop = data.workshops.find(shop => shop.id === selectedId);
  React.useEffect(() => {
    if (tab === "reservations" && !workshop?.reservationsAvailable) {
      setTab("details");
    }
    if (tab === "documentation" && !workshop?.gdriveId) {
      setTab("details");
    }
  }, [selectedId, workshop?.reservationsAvailable, workshop?.gdriveId, tab]);

  if (loading && data.workshops.length === 0) {
    return <Grid container justifyContent="center"><CircularProgress /></Grid>;
  }

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12, md: 10 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h5">Workshops</Typography>
            <Typography color="textSecondary">
              Workshop information, tools, reservations, documentation, and volunteer work.
            </Typography>
          </div>
          {data.canAddShop &&
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
              Add Shop
            </Button>}
        </Grid>
      </Grid>
      {error && <Grid size={{ xs: 12, md: 10 }}><Alert severity="error">{error}</Alert></Grid>}
      <Grid size={{ xs: 12, md: 10 }}>
        <FormControl fullWidth>
          <InputLabel>Workshop</InputLabel>
          <Select value={selectedId} label="Workshop"
            onChange={event => { setSelectedId(event.target.value); setTab("details"); }}>
            {data.workshops.map(shop => (
              <MenuItem key={shop.id} value={shop.id}>
                {shop.name}{shop.disabled ? " (disabled)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {workshop && <Grid size={{ xs: 12, md: 10 }}>
        <Paper style={{ padding: 18, position: "relative" }}>
          {loading && <CircularProgress size={20}
            style={{ position: "absolute", right: 18, top: 18 }} />}
          <Tabs value={tab} onChange={(_, value) => setTab(value)}
            variant="scrollable" scrollButtons="auto">
            <Tab value="details" label="Details" />
            <Tab value="tools" label="Tools" />
            {workshop.reservationsAvailable &&
              <Tab value="reservations" label="Reservations" />}
            {workshop.gdriveId &&
              <Tab value="documentation" label="Documentation" />}
            <Tab value="volunteer" label="Volunteer" />
          </Tabs>

          <div style={{ marginTop: 18 }}>
            {tab === "details" && <WorkshopDetails workshop={workshop} />}
            {tab === "tools" &&
              <WorkshopTools workshop={workshop} onRefresh={load} />}
            {tab === "reservations" &&
              <WorkshopReservations workshop={workshop} />}
            {tab === "documentation" && workshop.gdriveId &&
              <iframe
                title={`${workshop.name} documentation`}
                src={googleDriveEmbeddedFolderUrl(workshop.gdriveId)}
                style={{ width: "100%", height: "70vh", border: 0 }}
              />}
            {tab === "volunteer" &&
              <WorkshopVolunteer workshop={workshop} onRefresh={load} />}
          </div>
        </Paper>
      </Grid>}

      {addOpen && <AddShopModal
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); load(); }}
      />}
    </Grid>
  );
};

export default WorkshopsPage;
