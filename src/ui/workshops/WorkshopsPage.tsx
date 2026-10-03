import ToolAvailability from "ui/common/ToolAvailability";
import PublicCatalogQrCodeModal from "ui/common/PublicCatalogQrCodeModal";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useCapabilities } from "app/permissions";
import * as React from "react";
import ShopOutageAction from './ShopOutageAction';
import ToolOutageAction from 'ui/fixTickets/ToolOutageAction';
import { Link, useSearchParams } from "react-router-dom";
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
  adminCreateShop, adminUpdateShop, listManagedShops, listTools
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
import { Shop, Tool } from "app/entities/toolCheckout";
import { Routing } from "app/constants";
import { useAuthState } from "ui/reducer/hooks";
import moment from "ui/utils/moment";
import RequestCheckoutModal from "./RequestCheckoutModal";
import { googleDriveEmbeddedFolderUrl } from "./workshopUrls";
import { workshopReservationRows } from "./workshopReservations";
import { AddShopModal, EditShopModal } from "ui/toolCheckouts/ShopManager";
import ToolEditorModal from "ui/toolCheckouts/ToolEditorModal";
import ShopLocationMap from "ui/toolCheckouts/ShopLocationMap";

const ZONE = "America/New_York";
type WorkshopTab =
  "details" | "tools" | "reservations" | "documentation" | "volunteer";

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
  selectedToolId?: string;
  workshop: Workshop;
  managedShops: Shop[];
  managedTools: Tool[];
  catalogsReady: boolean;
  onRefresh: () => void;
  highlightToolId?: string;
  onFindTool?: (toolId: string) => void;
}> = ({ workshop, managedShops, managedTools, catalogsReady, onRefresh, selectedToolId, highlightToolId, onFindTool }) => {
  React.useEffect(() => {
    if (selectedToolId) document.getElementById(`tool-${selectedToolId}`)?.scrollIntoView({ block: 'center' });
  }, [selectedToolId]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [requestTool, setRequestTool] = React.useState<WorkshopTool | null>(null);
  const [editTool, setEditTool] = React.useState<Tool | null>(null);
  const managedShop = catalogsReady ? managedShops.find(shop => shop.id === workshop.id) : undefined;

  // Scrolls to and briefly highlights a specific tool when arriving here
  // from the shop's map (clicking a tool name there lands on this tab).
  React.useEffect(() => {
    if (!highlightToolId) return;
    document.getElementById(`tool-${highlightToolId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightToolId]);

  return (
    <>
      <Grid container justifyContent="space-between" alignItems="center" sx={{ columnGap: 2, rowGap: 1.5 }}>
        <Typography variant="h6">Tools</Typography>
        {workshop.canAddTool && managedShop &&
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}>Add Tool</Button>}
      </Grid>

      {workshop.tools.length === 0 &&
        <Typography color="textSecondary">No visible tools in this workshop.</Typography>}
      {workshop.tools.map(tool => (
        <Paper key={tool.id} id={`tool-${tool.id}`} variant="outlined" sx={{ borderColor: selectedToolId === tool.id ? 'primary.main' : 'divider' }} style={{
          padding: 12,
          marginTop: 10,
          opacity: tool.disabled ? 0.65 : 1,
          outline: tool.id === highlightToolId ? "2px solid #1976d2" : undefined
        }}>
          <Grid container spacing={1} justifyContent="space-between">
            {selectedToolId === tool.id && <Grid size={12}><Chip label="Scanned tool" size="small" /></Grid>}
            <Grid size={{ xs: 12, md: 8 }}>
              <a href={tool.wikiUrl} target="_blank" rel="noopener noreferrer">
                <strong>{tool.name}</strong>
              </a>{" "}
              {tool.open && <Chip size="small" label="No checkout required" />}
              <ToolAvailability outOfService={tool.outOfService} />
              {workshop.isShopManager && !tool.outOfService && <Chip size="small" label="Tool in service" variant="outlined" />}
              <Button href={`/fix-tickets?new=true&shop_id=${workshop.id}&tool_id=${tool.id}`}>Report a problem</Button>
              {tool.disabled && <Chip size="small" label="Hidden" />}
              {tool.description && <Typography variant="body2">{tool.description}</Typography>}
              {tool.locationName &&
                <Typography variant="body2" color="textSecondary">Location: {tool.locationName}</Typography>}
              {tool.prerequisiteNames.length > 0 &&
                <Typography variant="caption" style={{ display: "block" }}>
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
              {workshop.isShopManager && <ToolOutageAction tool={tool} onSaved={onRefresh} />}
              {tool.locationName && onFindTool &&
                <Button size="small" variant="outlined" onClick={() => onFindTool(tool.id)}>
                  Find tool
                </Button>}
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
                <Button size="small" variant="contained" component={Link as React.ElementType}
                  to={`${Routing.Reservations}?shop=${workshop.id}&tool=${tool.id}`}>
                  Reserve
                </Button>}
              {workshop.canAddTool && managedShop && managedTools.some(candidate => candidate.id === tool.id) &&
                <Button size="small" variant="outlined" startIcon={<EditIcon />}
                  onClick={() => {
                    setEditTool(managedTools.find(candidate => candidate.id === tool.id) || null);
                  }}>
                  Edit
                </Button>}
            </Grid>
          </Grid>
        </Paper>
      ))}

      {(addOpen || editTool) && managedShop && <ToolEditorModal
        key={editTool?.id || "new-" + workshop.id}
        tool={editTool || undefined} shops={managedShops} tools={managedTools}
        initialShopId={workshop.id}
        onClose={() => { setAddOpen(false); setEditTool(null); }}
        onSaved={() => { setAddOpen(false); setEditTool(null); onRefresh(); }}
      />}
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
        <Button component={Link as React.ElementType} to={`${Routing.Reservations}?shop=${workshop.id}`}
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
            <Grid container justifyContent="space-between" alignItems="center" sx={{ columnGap: 2, rowGap: 1.5 }}>
              <Grid>
                <strong>{row.reservation.title}</strong>{" "}
                <Chip size="small" label={row.reservation.status} /><ToolAvailability outOfService={!!row.reservation.outOfServiceToolNames?.length} />
                <Typography variant="body2">
                  {moment(row.reservation.startAt).tz(ZONE).format("HH:mm")}–
                  {moment(row.reservation.endAt).tz(ZONE).format("HH:mm")} ·{" "}
                  {row.reservation.memberName} ·{" "}
                  {row.reservation.toolNames?.join(", ") || "Entire shop"}
                </Typography>
              </Grid>
              {row.reservation.memberId === currentUser.id &&
                <Grid style={{ display: "flex", gap: 6 }}>
                  <Button size="small" startIcon={<EditIcon />} component={Link as React.ElementType}
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
      <Grid container justifyContent="space-between" alignItems="center" sx={{ columnGap: 2, rowGap: 1.5 }}>
        <Typography variant="h6">Available Bounty Tasks</Typography>
        {workshop.canCreateVolunteerTask &&
          <Button component={Link as React.ElementType}
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
          <Grid container justifyContent="space-between" alignItems="center" sx={{ columnGap: 2, rowGap: 1.5 }}>
            <Grid size={{ xs: 12, md: 9 }}>
              <strong>#{task.taskNumber} — {task.title}</strong>{task.ticketId && <Button href={`/fix-tickets/${task.ticketId}`}>View source ticket</Button>}{" "}
              <Chip size="small" label={`${task.creditValue} credits`} />
              <Typography variant="body2">{task.description}</Typography>
              {task.prerequisiteToolNames.length > 0 &&
                <Typography variant="caption" style={{ display: "block" }}>
                  Prerequisites: {task.prerequisiteToolNames.join(", ")}
                </Typography>}
              {!task.eligible && task.missingPrerequisiteToolNames.length > 0 &&
                <Typography variant="caption" style={{ display: "block" }}>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedShop = searchParams.get('shop');
  const requestedTool = searchParams.get('tool');
  // Set by the Tools tab's "Place on map" button (via a navigation from
  // ToolCheckoutsPage, not a same-page state update) -- selects this shop's
  // Details tab, where the map lives, with this tool preselected in its
  // "place a specific tool here" picker for the next new marker placed.
  const requestedPlaceTool = searchParams.get('placeTool');
  // Set by the public tool page's "Find where this tool should be stored"
  // link -- lands on the shop's Details tab with that tool's marker ringed on
  // the map, the same view the Tools tab's "Find tool" button produces.
  const requestedFindTool = searchParams.get('findTool');
  const [data, setData] = React.useState<WorkshopsResponse>({
    canAddShop: false,
    workshops: [],
  });
  const [selectedId, setSelectedId] = React.useState("");
  const [tab, setTab] = React.useState<WorkshopTab>("details");
  const [highlightToolId, setHighlightToolId] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  // Null means unavailable; an empty array is a successfully loaded catalog.
  const [managedShops, setManagedShops] = React.useState<Shop[] | null>(null);
  const [managedTools, setManagedTools] = React.useState<Tool[] | null>(null);
  const [catalogError, setCatalogError] = React.useState("");
  const [shopSaving, setShopSaving] = React.useState(false);
  const [shopError, setShopError] = React.useState("");
  const { canViewShopQrCodes } = useCapabilities();

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
      if (result.data.canAddShop || result.data.workshops.some(shop => shop.canAddTool)) {
        const [shopsResult, toolsResult] = await Promise.all([
          listManagedShops(),
          listTools(),
        ]);
        // Shop creation needs the shop catalog for duplicate names and colors,
        // even when the tool catalog (needed by the other editors) fails.
        setManagedShops(shopsResult.data ?? null);
        setManagedTools(toolsResult.data ?? null);
        setCatalogError([
          !shopsResult.data && `Shop catalog could not be loaded: ${shopsResult.error?.message || "Please retry."}`,
          !toolsResult.data && `Tool catalog could not be loaded: ${toolsResult.error?.message || "Please retry."}`,
        ].filter(Boolean).join(" "));
      } else {
        setManagedShops(null);
        setManagedTools(null);
        setCatalogError("");
      }
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const workshop = data.workshops.find(shop => shop.id === selectedId);
  React.useEffect(() => {
    if (loading || (!requestedShop && !requestedTool && !requestedFindTool)) return;
    const lookupToolId = requestedTool || requestedFindTool;
    const found = data.workshops.find(shop => lookupToolId ? shop.tools.some(tool => tool.id === lookupToolId) : shop.id === requestedShop);
    if (!found) { setError('This shop or tool is unavailable.'); return; }
    setSelectedId(found.id); setTab(requestedTool ? 'tools' : 'details'); setError('');
    if (requestedFindTool && !requestedTool) setHighlightToolId(requestedFindTool);
  }, [data, loading, requestedShop, requestedTool, requestedFindTool]);
  const managedShop = managedShops?.find(shop => shop.id === selectedId);
  const shopCatalogReady = !loading && managedShops !== null;
  const editorCatalogsReady = shopCatalogReady && managedTools !== null;

  const createShop = async (body: Partial<Shop>) => {
    setShopSaving(true);
    const result = await adminCreateShop({ body });
    setShopSaving(false);
    if (result.error) setShopError(result.error.message);
    else { setAddOpen(false); await load(); }
  };

  const updateShop = async (id: string, body: Partial<Shop>) => {
    setShopSaving(true);
    const result = await adminUpdateShop({ id, body });
    setShopSaving(false);
    if (result.error) setShopError(result.error.message);
    else { setEditOpen(false); await load(); }
  };
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
        <Grid container justifyContent="space-between" alignItems="center" sx={{ columnGap: 2, rowGap: 1.5 }}>
          <div>
            <Typography variant="h5">Workshops</Typography>
            <Typography color="textSecondary">
              Workshop information, tools, reservations, documentation, and volunteer work.
            </Typography>
          </div>
          {data.canAddShop &&
            <Button startIcon={<AddIcon />} variant="contained" disabled={!shopCatalogReady}
              onClick={() => { setShopError(""); setAddOpen(true); }}>
              Add Shop
            </Button>}
        </Grid>
      </Grid>
      {error && <Grid size={{ xs: 12, md: 10 }}><Alert severity="error">{error}</Alert></Grid>}
      {catalogError && <Grid size={{ xs: 12, md: 10 }}>
        <Alert severity="error" action={<Button disabled={loading} onClick={load}>Retry</Button>}>
          {catalogError}
        </Alert>
      </Grid>}
      <Grid size={{ xs: 12, md: 10 }}>
        <FormControl fullWidth>
          <InputLabel>Workshop</InputLabel>
          <Select value={selectedId} label="Workshop"
            onChange={event => { setSearchParams({}); setError(""); setSelectedId(event.target.value); setTab("details"); }}>
            {data.workshops.map(shop => (
              <MenuItem key={shop.id} value={shop.id}>
                {shop.name}{shop.outOfService ? " (out of service)" : ""}{shop.disabled ? " (disabled)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {workshop && <Grid size={{ xs: 12, md: 10 }}>
        <Paper style={{ padding: 18, position: "relative" }}>
          {workshop.isShopManager && !workshop.outOfService && <Chip label="Shop in service" variant="outlined" sx={{ mb: 2 }} />}
          {workshop.outOfService && <Alert severity="warning" sx={{ mb: 2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
            Shop out of service. New shop and tool reservations are blocked. {workshop.outOfServiceNote}
          </Alert>}
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
            {tab === "details" && <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {workshop.isShopManager && <ShopOutageAction key={workshop.id} shop={workshop} onSaved={load} />}
                {data.canAddShop && managedShop && <Button startIcon={<EditIcon />} variant="outlined"
                  disabled={!editorCatalogsReady}
                  onClick={() => { setShopError(""); setEditOpen(true); }}>
                  Edit
                </Button>}
                {canViewShopQrCodes && <Button startIcon={<QrCodeIcon />} variant="outlined"
                  onClick={() => setQrOpen(true)}>QR Code</Button>}
                </div>
                <WorkshopDetails workshop={workshop} />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <ShopLocationMap shopId={workshop.id} shopName={workshop.name}
                  canEdit={workshop.isShopManager}
                  onSelectTool={toolId => { setHighlightToolId(toolId); setTab("tools"); }}
                  highlightToolId={tab === "details" ? highlightToolId : undefined}
                  preset={requestedPlaceTool ? { toolId: requestedPlaceTool } : undefined} />
              </Grid>
            </Grid>}
            {tab === "tools" &&
              <WorkshopTools key={workshop.id} workshop={workshop} managedShops={managedShops || []} selectedToolId={requestedTool}
                managedTools={managedTools || []} catalogsReady={editorCatalogsReady}
                onRefresh={load} highlightToolId={tab === "tools" ? highlightToolId : undefined}
                onFindTool={toolId => { setHighlightToolId(toolId); setTab("details"); }} />}
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

      {addOpen && shopCatalogReady && managedShops && <AddShopModal
        shops={managedShops}
        onClose={() => setAddOpen(false)}
        onSave={createShop}
        loading={shopSaving}
        error={shopError}
      />}
      {qrOpen && workshop && <PublicCatalogQrCodeModal key={workshop.id} kind="shop" resource={workshop} onClose={() => setQrOpen(false)} />}
      {editOpen && editorCatalogsReady && workshop && managedShop && <EditShopModal
        shop={{ ...managedShop, resourceManagers: managedShop.resourceManagers || workshop.resourceManagers }}
        shops={managedShops!}
        tools={managedTools!.filter(tool => tool.shopId === workshop.id)}
        onCancel={() => setEditOpen(false)}
        onSave={updateShop}
        saving={shopSaving}
        canManageResourceManagers
        error={shopError} />}
    </Grid>
  );
};

export default WorkshopsPage;
