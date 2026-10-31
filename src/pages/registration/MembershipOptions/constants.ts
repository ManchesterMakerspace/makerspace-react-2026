import { InvoiceOption } from "makerspace-ts-api-client";

export const noneInvoiceOption: InvoiceOption = {
  id: "none",
  name: "Other",
  description: "Prepaid with class or voucher",
  amount: undefined,
  resourceClass: undefined,
  quantity: 0,
  disabled: false,
  isPromotion: false,
  planId: null,
  discountId: null
};

export const prepaidInvoiceOption: InvoiceOption = {
  id: "none",
  name: "Prepaid",
  description: "Prepaid via Eventbrite or other voucher",
  amount: undefined,
  resourceClass: undefined,
  quantity: 0,
  disabled: false,
  isPromotion: false,
  planId: null,
  discountId: null
};

export const invoiceOptionParam = "optionId";
export const discountParam = "discountId";

export const byAmount = (a: InvoiceOption, b: InvoiceOption) => Number(a.amount) - Number(b.amount);
export const defaultPlanId = "membership-one-month-recurring";

export const promotionActionLabel = "Use Discount";
export const actionLabel = "Sign Up";
export const ssmDiscount = "MMS_10%";
