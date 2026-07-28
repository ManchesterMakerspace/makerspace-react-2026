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

import { adminCreateShop } from "api/toolCheckouts";
import { listWorkshops } from "api/workshops";
import { getReservationAvailability } from "api/reservations";
import { Workshop, WorkshopsResponse } from "app/entities/workshop";
import { Reservation } from "app/entities/reservation";
import { Routing } from "app/constants";
import FormModal from "ui/common/FormModal";
import moment from "ui/utils/moment";

const ZONE = "America/New_York";
type WorkshopTab = "details" | "tools" | "reservations";

const AddShopModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [name, setName] = React.useState("");
  const [wikiUrl, setWikiUrl] = React.useState("");
  const [slackChannel, setSlackChannel] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const result = await adminCreateShop({
      body: { name: name.trim(), wikiUrlOverride: wikiUrl, slackChannel }
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      onCreated();
    }
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
          <TextField fullWidth label="Slack Channel" value={slackChannel}
            onChange={event => setSlackChannel(event.target.value)} />
        </Grid>
      </Grid>
    </FormModal>
  );
};

const WorkshopReservations: React.FC<{ workshop: Workshop }> = ({ workshop }) => {
  const [date, setDate] = React.useState(moment.tz(ZONE).format("YYYY-MM-DD"));
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    getReservationAvailability({ date, shopId: workshop.id }).then(result => {
      setReservations(result.data || []);
      setLoading(false);
    });
  }, [date, workshop.id]);

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
      <Grid size={{ xs: 12 }}>
        {loading && <CircularProgress size={24} />}
        {!loading && reservations.length === 0 &&
          <Typography color="textSecondary">No reservations for this day.</Typography>}
        {reservations.map(reservation => (
          <Paper key={reservation.id} variant="outlined" style={{ padding: 10, marginTop: 8 }}>
            <strong>{reservation.title}</strong>
            <Typography variant="body2">
              {moment(reservation.startAt).tz(ZONE).format("HH:mm")}–
              {moment(reservation.endAt).tz(ZONE).format("HH:mm")} · {reservation.status}
            </Typography>
          </Paper>
        ))}
      </Grid>
    </Grid>
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
  }, [selectedId, workshop?.reservationsAvailable, tab]);

  if (loading) {
    return <Grid container justifyContent="center"><CircularProgress /></Grid>;
  }

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={{ xs: 12, md: 10 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h5">Workshops</Typography>
            <Typography color="textSecondary">Workshop information, tools, and reservations.</Typography>
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
            onChange={event => setSelectedId(event.target.value)}>
            {data.workshops.map(shop => (
              <MenuItem key={shop.id} value={shop.id}>
                {shop.name}{shop.disabled ? " (disabled)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {workshop && <Grid size={{ xs: 12, md: 10 }}>
        <Paper style={{ padding: 18 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab value="details" label="Details" />
            <Tab value="tools" label="Tools" />
            {workshop.reservationsAvailable &&
              <Tab value="reservations" label="Reservations" />}
          </Tabs>

          <div style={{ marginTop: 18 }}>
            {tab === "details" && <>
              <Typography variant="h6">{workshop.name}</Typography>
              <Typography>
                Wiki: <a href={workshop.wikiUrl} target="_blank" rel="noopener noreferrer">
                  {workshop.wikiUrl}
                </a>
              </Typography>
              <Typography>
                Slack channel: {workshop.slackChannel ? `#${workshop.slackChannel}` : "Not configured"}
              </Typography>
              <Typography variant="subtitle1" style={{ marginTop: 14 }}>Resource Managers</Typography>
              {workshop.resourceManagers.length === 0 &&
                <Typography color="textSecondary">No resource managers assigned.</Typography>}
              {workshop.resourceManagers.map(manager => (
                <div key={manager.id}>
                  {manager.slackUrl
                    ? <a href={manager.slackUrl}>{manager.name}</a>
                    : manager.name}
                </div>
              ))}
            </>}

            {tab === "tools" && <>
              {workshop.tools.length === 0 &&
                <Typography color="textSecondary">No visible tools in this workshop.</Typography>}
              {workshop.tools.map(tool => (
                <Paper key={tool.id} variant="outlined" style={{ padding: 10, marginTop: 8 }}>
                  <a href={tool.wikiUrl} target="_blank" rel="noopener noreferrer">
                    <strong>{tool.name}</strong>
                  </a>{" "}
                  {tool.disabled && <Chip size="small" label="Hidden" />}
                  {tool.description && <Typography variant="body2">{tool.description}</Typography>}
                </Paper>
              ))}
            </>}

            {tab === "reservations" && <WorkshopReservations workshop={workshop} />}
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
