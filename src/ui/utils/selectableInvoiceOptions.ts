import { InvoiceOption, InvoiceableResource } from "makerspace-ts-api-client";

interface CurrentOption {
  id: string | null | undefined;
  name: string | null;
  amount: number | null;
  quantity: number | null;
  planId: string | null;
  resourceClass: InvoiceableResource;
}

// A list of enabled options for a picker won't include the currently-assigned
// option once it's later disabled. Append it (clearly labeled) so an existing
// selection doesn't look like it silently reset to "None" when editing.
export const withCurrentOptionIncluded = (
  options: InvoiceOption[],
  current: CurrentOption
): InvoiceOption[] => {
  if (!current.id || options.some(opt => opt.id === current.id)) {
    return options;
  }

  return [
    ...options,
    {
      id: current.id,
      name: `${current.name || "Current plan"} (disabled)`,
      amount: String(current.amount),
      quantity: current.quantity,
      planId: current.planId,
      resourceClass: current.resourceClass,
      disabled: true,
    } as InvoiceOption,
  ];
};
