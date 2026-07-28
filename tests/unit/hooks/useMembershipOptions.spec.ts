import {
  InvoiceableResource,
  listInvoiceOptions,
} from "makerspace-ts-api-client";
import { listSignupInvoiceOptions } from "api/invoiceOptions";
import { getMembershipOptionsRequest } from "hooks/membershipOptionsRequest";

describe("membership options request selection", () => {
  it("uses the restricted catalog when signup has no explicit parameters", () => {
    expect(getMembershipOptionsRequest()).toEqual({
      apiFunction: listSignupInvoiceOptions,
      args: {},
    });
  });

  it.each([
    ["an explicit option", "63dda79f724abf0002042ed8", undefined],
    ["an explicit discount", undefined, "2026_Membership_Annual_Old"],
    [
      "an explicit option and discount",
      "63dda79f724abf0002042ed8",
      "2026_Membership_Annual_Old",
    ],
  ])("uses the legacy member catalog for %s", (_label, optionId, discountId) => {
    expect(getMembershipOptionsRequest(optionId, discountId)).toEqual({
      apiFunction: listInvoiceOptions,
      args: { types: [InvoiceableResource.Member] },
    });
  });
});
