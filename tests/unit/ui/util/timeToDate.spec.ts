import { timeToDate, timeToDateAndTime } from "ui/utils/timeToDate";

describe("timeToDate util", () => {
  it("Can import the util", () => {
    expect(timeToDate).toBeTruthy();
  })
})

describe("timeToDateAndTime util", () => {
  it("formats a timestamp with the date and a 12-hour time", () => {
    // 2026-09-09T19:45:00Z -> 3:45 PM in America/New_York (EDT, UTC-4)
    const result = timeToDateAndTime("2026-09-09T19:45:00Z");
    expect(result).toEqual("09 Sep 2026, 3:45 PM");
  });
})