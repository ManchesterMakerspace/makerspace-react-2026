import {
  Reservation, ReservationBlackoutOccurrence
} from "app/entities/reservation";

type WorkshopReservationRow =
  | {
      kind: "reservation";
      startAt: string;
      reservation: Reservation;
    }
  | {
      kind: "blackout";
      startAt: string;
      blackout: ReservationBlackoutOccurrence;
    };

const workshopReservationRows = (
  reservations: Reservation[],
  blackouts: ReservationBlackoutOccurrence[]
): WorkshopReservationRow[] => [
  ...reservations.map(reservation => ({
    kind: "reservation" as const,
    startAt: reservation.startAt,
    reservation,
  })),
  ...blackouts.map(blackout => ({
    kind: "blackout" as const,
    startAt: blackout.startAt,
    blackout,
  })),
].sort((left, right) => left.startAt.localeCompare(right.startAt));

export { workshopReservationRows };
