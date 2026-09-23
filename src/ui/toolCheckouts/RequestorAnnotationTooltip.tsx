import * as React from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";

const RequestorAnnotationTooltip: React.FC<{ annotation?: string | null }> = ({ annotation }) => {
  if (!annotation) return null;
  return <Tooltip describeChild title={<span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{annotation}</span>}>
    <Button size="small" onClick={event => event.stopPropagation()}>Annotation for requestors</Button>
  </Tooltip>;
};

export default RequestorAnnotationTooltip;
