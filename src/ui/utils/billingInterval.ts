import { numberAsCurrency } from "ui/utils/numberAsCurrency";

// quantity is in months -- for a subscription-backed InvoiceOption (has a
// planId) it's copied directly from the attached Braintree plan's
// billingFrequency (see ui/billing/BillingForm.tsx's planToOptionMap), so it's
// a genuine recurring interval. Only call this when a plan is actually
// attached -- see formatBillingAmount, which is the one that decides that.
const recurringIntervalSuffix = (quantity: number): string => {
  if (quantity === 1) return "/mo";
  if (quantity === 3) return "/quarter";
  if (quantity === 12) return "/yr";
  return ` every ${quantity} mo`;
};

// Formats a billing amount with the correct interval, distinguishing a real
// recurring subscription (hasPlan true -- Braintree will keep charging this
// on the interval above) from a one-time charge that just happens to cover
// multiple months up front (hasPlan false -- quantity is not a recurring
// cadence, so labeling it "/quarter" would incorrectly imply automatic
// rebilling that isn't actually configured).
export const formatBillingAmount = (
  amount: number | string,
  quantity: number | null | undefined,
  hasPlan: boolean
): string => {
  const formattedAmount = numberAsCurrency(amount);
  if (!quantity) return formattedAmount;

  return hasPlan
    ? `${formattedAmount}${recurringIntervalSuffix(quantity)}`
    : `${formattedAmount} (one-time, covers ${quantity} mo)`;
};
