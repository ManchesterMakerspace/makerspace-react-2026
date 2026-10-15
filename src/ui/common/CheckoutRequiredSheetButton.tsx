import * as React from "react";
import Button from "@mui/material/Button";
import PrintIcon from "@mui/icons-material/Print";
import CheckoutRequiredSheetModal from "./CheckoutRequiredSheetModal";

export interface CheckoutSheetResource {
  id: string;
  name: string;
  canGenerateCheckoutRequiredSheet?: boolean;
}

const CheckoutRequiredSheetButton: React.FC<{
  kind: "shop" | "tool";
  resource: CheckoutSheetResource;
}> = ({ kind, resource }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [kind, resource.id]);
  if (!resource.canGenerateCheckoutRequiredSheet) return null;
  return <>
    <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => setOpen(true)}>
      Checkout Required Sheet
    </Button>
    {open && <CheckoutRequiredSheetModal key={`${kind}-${resource.id}`} kind={kind}
      resource={resource} onClose={() => setOpen(false)} />}
  </>;
};

export default CheckoutRequiredSheetButton;
