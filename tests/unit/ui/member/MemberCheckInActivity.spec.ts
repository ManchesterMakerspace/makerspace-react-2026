import { getCheckInTimestamp } from "ui/member/checkInTimestamp";

describe("getCheckInTimestamp", () => {
  it("parses the timeOf ISO date", () => {
    expect(getCheckInTimestamp({ timeOf: "2026-09-05T12:34:56.789Z", time: 1688426197 }))
      .toBe(1788611696789);
  });

  it.each([
    [1788210909042.0, 1788210909042],
    [1788563249722, 1788563249722],
    [1787264451042, 1787264451042],
    [1686607290042, 1686607290042],
    [1688426197, 1688426197000],
  ])("normalizes legacy numeric time %s", (time, expected) => {
    expect(getCheckInTimestamp({ time })).toBe(expected);
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid legacy time %s",
    (time) => {
      expect(getCheckInTimestamp({ time })).toBeUndefined();
    },
  );
});
