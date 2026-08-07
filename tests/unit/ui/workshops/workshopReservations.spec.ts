import { Reservation } from "app/entities/reservation";
import { workshopReservationRows } from "ui/workshops/workshopReservations";

const pastReservation = {
  id: "past-reservation",
  title: "Historical reservation",
  startAt: "2020-01-01T15:00:00Z",
  endAt: "2020-01-01T16:00:00Z",
} as Reservation;

const pastBlackout = {
  blackoutId: "past-blackout",
  title: "Historical blackout",
  startAt: "2020-01-01T13:00:00Z",
  endAt: "2020-01-01T14:00:00Z",
};

describe("workshopReservationRows", () => {
  it("retains and sorts date-scoped historical reservations and blackouts", () => {
    const rows = workshopReservationRows([pastReservation], [pastBlackout]);

    expect(rows.map(row => row.kind)).toEqual(["blackout", "reservation"]);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "reservation",
        reservation: pastReservation,
      }),
      expect.objectContaining({
        kind: "blackout",
        blackout: pastBlackout,
      }),
    ]));
  });
});
