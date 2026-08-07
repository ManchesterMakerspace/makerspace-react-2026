import { reservationBlackoutBody } from "api/reservations";

describe("reservationBlackoutBody", () => {
  it("serializes weekly blackouts and optional bounds", () => {
    expect(reservationBlackoutBody({
      title: "Open House",
      shopId: "shop-1",
      recurrence: "weekly",
      weekday: 1,
      startTime: "17:00",
      endTime: "20:00",
      startDate: "2026-07-01",
      endDate: "",
    })).toEqual({
      title: "Open House",
      shop_id: "shop-1",
      recurrence: "weekly",
      weekday: 1,
      start_time: "17:00",
      end_time: "20:00",
      start_date: "2026-07-01",
      end_date: null,
    });
  });

  it("clears the weekday for daily blackouts", () => {
    expect(reservationBlackoutBody({
      title: "Cleanup",
      shopId: "shop-1",
      recurrence: "daily",
      weekday: 5,
      startTime: "22:00",
      endTime: "02:00",
    }).weekday).toBeNull();
  });
});
