import * as React from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

const RequestorAnnotationHelp: React.FC<{ level: "shop" | "tool" }> = ({ level }) => {
  const title = level === "tool"
    ? "Sent to the member after a checkout request. A tool annotation overrides its shop annotation."
    : "Sent to the member after a checkout request when the tool does not have its own annotation.";

  return <Tooltip title={title}>
    <IconButton size="small" aria-label={`About ${level} requestor annotations`} sx={{ ml: 0.5, p: 0.25 }}>
      <InfoOutlinedIcon fontSize="inherit" />
    </IconButton>
  </Tooltip>;
};

export default RequestorAnnotationHelp;
