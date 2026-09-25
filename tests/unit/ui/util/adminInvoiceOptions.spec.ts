import {
  adminInvoiceOptionLabel,
  sortEnabledFirst,
  HIDDEN_OPTION_SUFFIX,
} from "ui/utils/adminInvoiceOptions";

describe("adminInvoiceOptionLabel", () => {
  it("returns the plain name for an active option", () => {
    expect(adminInvoiceOptionLabel({ name: "Monthly Membership", disabled: false })).toEqual("Monthly Membership");
  });

  it("appends the hidden suffix for a disabled option", () => {
    expect(adminInvoiceOptionLabel({ name: "Founding Member", disabled: true }))
      .toEqual(`Founding Member${HIDDEN_OPTION_SUFFIX}`);
    expect(HIDDEN_OPTION_SUFFIX).toEqual(" - hidden from members");
  });

  it("treats a missing disabled flag as active", () => {
    expect(adminInvoiceOptionLabel({ name: "Legacy" })).toEqual("Legacy");
  });

  it("tolerates a missing name", () => {
    expect(adminInvoiceOptionLabel({ name: null, disabled: true })).toEqual(HIDDEN_OPTION_SUFFIX);
  });
});

describe("sortEnabledFirst", () => {
  it("moves hidden options after active ones, preserving order within each group", () => {
    const options = [
      { id: "a", disabled: true },
      { id: "b", disabled: false },
      { id: "c" },
      { id: "d", disabled: true },
      { id: "e", disabled: false },
    ];
    expect(sortEnabledFirst(options).map(o => o.id)).toEqual(["b", "c", "e", "a", "d"]);
  });

  it("does not mutate the input array", () => {
    const options = [{ id: "a", disabled: true }, { id: "b", disabled: false }];
    sortEnabledFirst(options);
    expect(options.map(o => o.id)).toEqual(["a", "b"]);
  });
});
