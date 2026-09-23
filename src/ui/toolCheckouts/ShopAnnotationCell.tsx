import * as React from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Shop } from "app/entities/toolCheckout";
import { adminUpdateShopAnnotation } from "api/toolCheckouts";
import FormModal from "ui/common/FormModal";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import RequestorAnnotationHelp from "./RequestorAnnotationHelp";

const ShopAnnotationCell: React.FC<{ shop: Shop; onSaved: () => void }> = ({ shop, onSaved }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const { call, isRequesting, error } = useWriteTransaction(adminUpdateShopAnnotation, () => {
    setEditing(false);
    onSaved();
  });

  return <>
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {shop.requestorAnnotation || "No shop annotation"}
      <RequestorAnnotationHelp level="shop" />
    </Typography>
    <Button size="small" onClick={() => { setValue(shop.requestorAnnotation || ""); setEditing(true); }}>
      Edit annotation
    </Button>
    <FormModal id={`shop-annotation-${shop.id}`} isOpen={editing}
      title={`Annotation for requestors: ${shop.name}`} closeHandler={() => setEditing(false)}
      onSubmit={() => call({ id: shop.id, annotation: value.trim() || null })}
      submitText="Save annotation" loading={isRequesting} error={error}>
      <TextField fullWidth multiline minRows={3} autoFocus label="Annotation for requestors"
        value={value} onChange={event => setValue(event.target.value)}
        helperText="Sent after a checkout request when the tool has no annotation. Leave blank for no shop message." />
    </FormModal>
  </>;
};

export default ShopAnnotationCell;
