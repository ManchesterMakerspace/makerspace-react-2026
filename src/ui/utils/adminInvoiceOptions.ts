// Admin pickers (e.g. Create Invoice) intentionally list disabled invoice options
// so admins can bill a member on a plan that is hidden from the public/member
// catalog (founding-member rates, one-off arrangements). Without a marker these
// look identical to active options, so label them and list them last.

export const HIDDEN_OPTION_SUFFIX = " - hidden from members";

interface LabelableOption {
  name?: string | null;
  disabled?: boolean | null;
}

export const adminInvoiceOptionLabel = (option: LabelableOption): string => {
  const name = option.name || "";
  return option.disabled ? `${name}${HIDDEN_OPTION_SUFFIX}` : name;
};

// Stable: preserves the API's order within the enabled and hidden groups.
export const sortEnabledFirst = <T extends { disabled?: boolean | null }>(options: T[]): T[] => [
  ...options.filter(option => !option.disabled),
  ...options.filter(option => !!option.disabled),
];
