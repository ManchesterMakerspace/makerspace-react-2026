import { InvoiceableResource } from "makerspace-ts-api-client";
import { withCurrentOptionIncluded } from "ui/utils/selectableInvoiceOptions";

const enabledOption = {
  id: "opt-1",
  name: "Standard Spot",
  amount: "50",
  quantity: 1,
  planId: "plan-1",
  resourceClass: InvoiceableResource.Rental,
  disabled: false,
} as any;

describe("withCurrentOptionIncluded", () => {
  it("returns the list unchanged when there is no current selection", () => {
    expect(withCurrentOptionIncluded([enabledOption], {
      id: null,
      name: null,
      amount: null,
      quantity: null,
      planId: null,
      resourceClass: InvoiceableResource.Rental,
    })).toEqual([enabledOption]);
  });

  it("returns the list unchanged when the current selection is already present", () => {
    expect(withCurrentOptionIncluded([enabledOption], {
      id: "opt-1",
      name: "Standard Spot",
      amount: 50,
      quantity: 1,
      planId: "plan-1",
      resourceClass: InvoiceableResource.Rental,
    })).toEqual([enabledOption]);
  });

  it("appends the current selection, labeled disabled, when it's missing from the list", () => {
    const result = withCurrentOptionIncluded([enabledOption], {
      id: "opt-2",
      name: "Retired Spot",
      amount: 75,
      quantity: 3,
      planId: "plan-2",
      resourceClass: InvoiceableResource.Rental,
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      id: "opt-2",
      name: "Retired Spot (disabled)",
      amount: "75",
      quantity: 3,
      planId: "plan-2",
      disabled: true,
    });
  });

  it("falls back to a generic label when the disabled option has no name", () => {
    const result = withCurrentOptionIncluded([], {
      id: "opt-3",
      name: null,
      amount: 10,
      quantity: 1,
      planId: null,
      resourceClass: InvoiceableResource.Rental,
    });

    expect(result[0].name).toEqual("Current plan (disabled)");
  });
});
