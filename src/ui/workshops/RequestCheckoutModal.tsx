import * as React from "react";
import TextField from "@mui/material/TextField";

import { createToolCheckoutRequest } from "api/toolCheckouts";
import { WorkshopTool } from "app/entities/workshop";
import FormModal from "ui/common/FormModal";

const RequestCheckoutModal: React.FC<{
  tool: WorkshopTool | null;
  onClose: () => void;
  onCreated: () => void;
}> = ({ tool, onClose, onCreated }) => {
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setNote("");
    setError("");
  }, [tool?.id]);

  const submit = async () => {
    if (!tool) return;
    setSaving(true);
    const result = await createToolCheckoutRequest({
      body: { toolId: tool.id, note }
    });
    setSaving(false);
    if (result.error) setError(result.error.message);
    else onCreated();
  };

  return (
    <FormModal id="workshops-request-checkout" isOpen={!!tool}
      title={`Request Checkout: ${tool?.name || ""}`}
      closeHandler={onClose} onSubmit={submit} submitText="Submit Request"
      loading={saving} error={error}>
      <TextField fullWidth label="Note" value={note}
        onChange={event => setNote(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 128 } }} multiline rows={2} />
    </FormModal>
  );
};

export default RequestCheckoutModal;
