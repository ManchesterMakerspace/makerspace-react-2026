import * as React from "react";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { Member } from "makerspace-ts-api-client";

import { listManagedReservations, listReservations } from "api/reservations";
import { Reservation } from "app/entities/reservation";
import { useAuthState } from "ui/reducer/hooks";
import moment from "ui/utils/moment";

const ZONE = "America/New_York";

const statusColor = (
  status: string
): "default" | "warning" | "success" | "error" =>
  status === "pending"
    ? "warning"
    : status === "approved"
      ? "success"
      : status === "denied"
        ? "error"
        : "default";

const ReservationTitle: React.FC<{ reservation: Reservation }> = ({
  reservation,
}) => (
  reservation.calendarHtmlLink
    ? (
      <a
        href={reservation.calendarHtmlLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        {reservation.title}
      </a>
    )
    : <>{reservation.title}</>
);

const ReservationDetails: React.FC<{ reservation: Reservation }> = ({
  reservation,
}) => {
  const resources = reservation.toolNames?.length
    ? reservation.toolNames.join(", ")
    : reservation.shopName;

  return (
    <Paper
      data-reservation-id={reservation.id}
      style={{ padding: 12, marginTop: 8 }}
    >
      <strong><ReservationTitle reservation={reservation} /></strong>{" "}
      <Chip
        label={reservation.status}
        color={statusColor(reservation.status)}
        size="small"
      />
      <Typography variant="body2">
        {moment(reservation.startAt).tz(ZONE).format("MMM D, YYYY HH:mm")}–
        {moment(reservation.endAt).tz(ZONE).format("MMM D, YYYY HH:mm")} ·{" "}
        {resources}
      </Typography>
    </Paper>
  );
};

interface Props {
  member: Member;
}

const MemberReservationsTab: React.FC<Props> = ({ member }) => {
  const { currentUser } = useAuthState();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const isOwnProfile = currentUser.id === member.id;

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      const result = isOwnProfile
        ? await listReservations({ mine: true })
        : await listManagedReservations();

      if (!active) return;

      if (result.error) {
        setReservations([]);
        setError(result.error.message || "Unable to load reservations.");
      } else {
        const memberReservations = (result.data || []).filter(
          reservation => reservation.memberId === member.id
        );
        setReservations(memberReservations);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [isOwnProfile, member.id]);

  const upcoming = reservations.filter(reservation =>
    ["pending", "approved"].includes(reservation.status) &&
    moment(reservation.endAt).isAfter(moment())
  );
  const history = reservations
    .filter(reservation => !upcoming.includes(reservation))
    .slice()
    .reverse();

  return (
    <div id="member-reservations-tab">
      <Typography variant="h6">My Reservations</Typography>

      {loading && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <CircularProgress size={28} />
        </div>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <>
          <Typography variant="subtitle2" style={{ marginTop: 8 }}>
            Upcoming
          </Typography>
          {upcoming.length === 0 && (
            <Typography color="textSecondary">
              No upcoming reservations.
            </Typography>
          )}
          {upcoming.map(reservation => (
            <ReservationDetails
              key={reservation.id}
              reservation={reservation}
            />
          ))}

          <Typography variant="subtitle2" style={{ marginTop: 16 }}>
            History
          </Typography>
          {history.length === 0 && (
            <Typography color="textSecondary">
              No reservation history.
            </Typography>
          )}
          {history.map(reservation => (
            <ReservationDetails
              key={reservation.id}
              reservation={reservation}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default MemberReservationsTab;
