import { Reservation } from "app/entities/reservation";
import {
  buildReservationPageTabs,
  groupMemberReservations,
} from "ui/reservations/reservationPageTabs";

const reservation = (
  id: string,
  status: string,
  endAt: string
) => ({ id, status, endAt } as Reservation);

describe("reservation page tabs", () => {
  it("always starts with the three member tabs", () => {
    expect(buildReservationPageTabs({
      canManageReservations: false,
      canManageBlackouts: false,
      canManageShops: false,
      canManageTools: false,
    })).toEqual([
      { key: "new", label: "New Reservation" },
      { key: "mine", label: "My Reservations" },
      { key: "history", label: "History" },
    ]);
  });

  it("adds reservation and resource-management tabs independently", () => {
    expect(buildReservationPageTabs({
      canManageReservations: true,
      canManageBlackouts: true,
      canManageShops: true,
      canManageTools: true,
    }).map(tab => tab.key)).toEqual([
      "new", "mine", "history", "managed", "blackouts", "manageShops", "manageTools",
    ]);
  });
});

describe("member reservation grouping", () => {
  const now = Date.parse("2026-08-06T12:00:00Z");
  const future = "2026-08-06T13:00:00Z";
  const past = "2026-08-06T11:00:00Z";

  it("separates upcoming, pending, terminal future, and past reservations", () => {
    const grouped = groupMemberReservations([
      reservation("approved", "approved", future),
      reservation("pending", "pending", future),
      reservation("cancelled", "cancelled", future),
      reservation("denied", "denied", future),
      reservation("past", "approved", past),
    ], now);

    expect(grouped.upcoming.map(item => item.id)).toEqual(["approved"]);
    expect(grouped.pending.map(item => item.id)).toEqual(["pending"]);
    expect(grouped.cancelled.map(item => item.id)).toEqual(["cancelled", "denied"]);
    expect(grouped.history.map(item => item.id)).toEqual(["past"]);
  });
});
