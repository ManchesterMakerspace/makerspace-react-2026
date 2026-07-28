import * as React from "react";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { Reservation, ReservationBlackoutOccurrence } from "app/entities/reservation";
import moment from "ui/utils/moment";

const ZONE = "America/New_York";
const ROW_HEIGHT = 38;

interface PositionedReservation {
  reservation: Reservation;
  startRow: number;
  endRow: number;
  lane: number;
}

const gridRows = (startAt: string, endAt: string, date: string) => {
  const dayStart = moment.tz(date, ZONE).startOf("day");
  const dayEnd = dayStart.clone().add(1, "day");
  const start = moment.max(moment(startAt).tz(ZONE), dayStart);
  const end = moment.min(moment(endAt).tz(ZONE), dayEnd);
  const startRow = Math.max(0, Math.floor(start.diff(dayStart, "minutes") / 30));
  const endRow = Math.min(48, Math.ceil(end.diff(dayStart, "minutes") / 30));
  return { startRow, endRow: Math.max(startRow + 1, endRow) };
};

const positionReservations = (
  reservations: Reservation[],
  date: string
): { items: PositionedReservation[]; lanes: number } => {
  const laneEnds: number[] = [];
  const items = reservations
    .map(reservation => ({ reservation, ...gridRows(reservation.startAt, reservation.endAt, date) }))
    .filter(item => item.startRow < 48 && item.endRow > 0)
    .sort((left, right) => left.startRow - right.startRow || left.endRow - right.endRow)
    .map(item => {
      let lane = laneEnds.findIndex(endRow => endRow <= item.startRow);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(item.endRow);
      } else {
        laneEnds[lane] = item.endRow;
      }
      return { ...item, lane };
    });

  return { items, lanes: Math.max(1, laneEnds.length) };
};

const statusColor = (status: string): "warning" | "success" | "default" =>
  status === "pending" ? "warning" : status === "approved" ? "success" : "default";

const DayAgenda: React.FC<{
  date: string;
  reservations: Reservation[];
  blackouts: ReservationBlackoutOccurrence[];
}> = ({ date, reservations, blackouts }) => {
  const positioned = React.useMemo(
    () => positionReservations(reservations, date),
    [reservations, date]
  );
  const slots = React.useMemo(
    () => Array.from({ length: 48 }, (_, index) =>
      moment.tz(date, ZONE).startOf("day").add(index * 30, "minutes")
    ),
    [date]
  );

  return (
    <Paper style={{ padding: 16, maxHeight: 720, overflowY: "auto" }}>
      <Typography variant="h6">Day Agenda</Typography>
      <div style={{ display: "grid", gridTemplateColumns: "68px minmax(0, 1fr)", marginTop: 8 }}>
        <div>
          {slots.map(slot => (
            <div key={slot.toISOString()} style={{
              height: ROW_HEIGHT,
              borderTop: "1px solid #e4e4e4",
              boxSizing: "border-box",
              paddingTop: 4,
            }}>
              <Typography variant="caption">{slot.format("HH:mm")}</Typography>
            </div>
          ))}
        </div>
        <div style={{
          display: "grid",
          gridTemplateRows: `repeat(48, ${ROW_HEIGHT}px)`,
          gridTemplateColumns: `repeat(${positioned.lanes}, minmax(0, 1fr))`,
          position: "relative",
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_HEIGHT - 1}px, #e4e4e4 ${ROW_HEIGHT - 1}px, #e4e4e4 ${ROW_HEIGHT}px)`,
        }}>
          {blackouts.map(blackout => {
            const rows = gridRows(blackout.startAt, blackout.endAt, date);
            return (
              <div key={`${blackout.blackoutId}-${blackout.startAt}`} style={{
                gridRow: `${rows.startRow + 1} / ${rows.endRow + 1}`,
                gridColumn: "1 / -1",
                zIndex: 0,
                background: "rgba(97, 97, 97, 0.20)",
                borderLeft: "4px solid rgba(66, 66, 66, 0.7)",
                padding: "4px 8px",
                overflow: "hidden",
              }}>
                <Typography variant="caption">
                  <strong>No Reservations Available: {blackout.title}</strong>
                </Typography>
              </div>
            );
          })}
          {positioned.items.map(({ reservation, startRow, endRow, lane }) => (
            <div key={reservation.id} style={{
              gridRow: `${startRow + 1} / ${endRow + 1}`,
              gridColumn: `${lane + 1}`,
              zIndex: 1,
              padding: 2,
              minWidth: 0,
            }}>
              <Paper elevation={2} style={{
                height: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                overflow: "hidden",
                borderLeft: reservation.status === "pending"
                  ? "4px solid #ed6c02"
                  : "4px solid #2e7d32",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <strong>
                    {reservation.calendarHtmlLink
                      ? <a href={reservation.calendarHtmlLink} target="_blank" rel="noopener noreferrer">
                          {reservation.title}
                        </a>
                      : reservation.title}
                  </strong>
                  <Chip label={reservation.status} color={statusColor(reservation.status)} size="small" />
                </div>
                <Typography variant="caption" component="div">
                  {reservation.memberName} ·{" "}
                  {reservation.toolNames?.length
                    ? reservation.toolNames.join(", ")
                    : "Entire shop"}
                </Typography>
                <Typography variant="caption" component="div">
                  {moment(reservation.startAt).tz(ZONE).format("HH:mm")}–
                  {moment(reservation.endAt).tz(ZONE).format("HH:mm")}
                </Typography>
              </Paper>
            </div>
          ))}
        </div>
      </div>
    </Paper>
  );
};

export { gridRows, positionReservations };
export default DayAgenda;
