import * as React from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Tool } from "app/entities/toolCheckout";
import { adminUpdateToolAnnotation } from "api/toolCheckouts";
import FormModal from "ui/common/FormModal";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import RequestorAnnotationHelp from "./RequestorAnnotationHelp";

// The managed tool catalog includes only tools this viewer manages or approves.
const ToolAnnotationCell: React.FC<{ tool: Tool; onSaved: () => void }> = ({ tool, onSaved }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const { call, isRequesting, error } = useWriteTransaction(adminUpdateToolAnnotation, () => {
    setEditing(false);
    onSaved();
  });

  return <>
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {tool.requestorAnnotation || "Uses shop annotation, if set"}
      <RequestorAnnotationHelp level="tool" />
    </Typography>
    <Button size="small" onClick={() => { setValue(tool.requestorAnnotation || ""); setEditing(true); }}>
      Edit annotation
    </Button>
    <FormModal id={`tool-annotation-${tool.id}`} isOpen={editing}
      title={`Annotation for requestors: ${tool.name}`} closeHandler={() => setEditing(false)}
      onSubmit={() => call({ id: tool.id, annotation: value.trim() || null })}
      submitText="Save annotation" loading={isRequesting} error={error}>
      <TextField fullWidth multiline minRows={3} autoFocus label="Annotation for requestors"
        value={value} onChange={event => setValue(event.target.value)}
        helperText="Sent after a checkout request. Leave blank to use the shop annotation." />
    </FormModal>
  </>;
};

export default ToolAnnotationCell;
