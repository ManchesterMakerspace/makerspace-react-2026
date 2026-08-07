import { daySlotCount, positionReservations } from "ui/reservations/DayAgenda";
import { Reservation } from "app/entities/reservation";

const reservation = (
  id: string,
  startAt: string,
  endAt: string
): Reservation => ({
  id,
  title: id,
  memberId: "member",
  memberName: "Member",
  shopId: "shop",
  shopName: "Shop",
  reservationScope: "tools",
  toolIds: ["tool"],
  toolNames: ["Tool"],
  startAt,
  endAt,
  status: "approved",
  approvalReasons: [],
  approvalDetails: [],
  source: "portal",
  createdAt: startAt,
  updatedAt: startAt,
});

describe("DayAgenda positioning", () => {
  it("uses one vertically spanning item for a multi-slot reservation", () => {
    const result = positionReservations([
      reservation("long", "2026-07-28T14:00:00Z", "2026-07-28T16:00:00Z")
    ], "2026-07-28");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].endRow - result.items[0].startRow).toBe(4);
  });

  it("assigns overlapping reservations to separate lanes and reuses free lanes", () => {
    const result = positionReservations([
      reservation("first", "2026-07-28T14:00:00Z", "2026-07-28T15:00:00Z"),
      reservation("overlap", "2026-07-28T14:30:00Z", "2026-07-28T15:30:00Z"),
      reservation("later", "2026-07-28T15:30:00Z", "2026-07-28T16:00:00Z"),
    ], "2026-07-28");

    expect(result.lanes).toBe(2);
    expect(result.items.find(item => item.reservation.id === "later")?.lane).toBe(0);
  });

  it("uses the actual number of half-hours in DST transition days", () => {
    expect(daySlotCount("2026-03-08")).toBe(46);
    expect(daySlotCount("2026-11-01")).toBe(50);
    expect(daySlotCount("2026-07-28")).toBe(48);
  });

  it("keeps late reservations on the fall-back day", () => {
    const result = positionReservations([
      reservation(
        "late",
        "2026-11-02T04:00:00Z",
        "2026-11-02T04:30:00Z"
      )
    ], "2026-11-01");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ startRow: 48, endRow: 49 });
  });
});
