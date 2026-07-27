import {
  InvoiceableResource,
  listInvoiceOptions,
} from "makerspace-ts-api-client";
import { listSignupInvoiceOptions } from "api/invoiceOptions";

export const getMembershipOptionsRequest = (
  invoiceOptionId?: string,
  discountId?: string
) => {
  if (invoiceOptionId || discountId) {
    return {
      apiFunction: listInvoiceOptions,
      args: { types: [InvoiceableResource.Member] },
    };
  }

  return {
    apiFunction: listSignupInvoiceOptions,
    args: {},
  };
};
