import { formatBillingAmount } from "ui/utils/billingInterval";

describe("formatBillingAmount", () => {
  it("labels a monthly subscription plan as /mo", () => {
    expect(formatBillingAmount(65, 1, true)).toEqual("$65.00/mo");
  });

  it("labels a quarterly subscription plan as /quarter", () => {
    expect(formatBillingAmount(180, 3, true)).toEqual("$180.00/quarter");
  });

  it("labels an annual subscription plan as /yr", () => {
    expect(formatBillingAmount(600, 12, true)).toEqual("$600.00/yr");
  });

  it("labels an unusual subscription interval as every N mo", () => {
    expect(formatBillingAmount(300, 6, true)).toEqual("$300.00 every 6 mo");
  });

  it("never implies recurring billing for a one-time charge, even at a common interval count", () => {
    expect(formatBillingAmount(180, 3, false)).toEqual("$180.00 (one-time, covers 3 mo)");
  });

  it("labels a one-time single-month charge without implying recurrence", () => {
    expect(formatBillingAmount(65, 1, false)).toEqual("$65.00 (one-time, covers 1 mo)");
  });

  it("falls back to a bare amount when quantity is missing", () => {
    expect(formatBillingAmount(65, null, true)).toEqual("$65.00");
    expect(formatBillingAmount(65, undefined, false)).toEqual("$65.00");
  });
});
