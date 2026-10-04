import * as React from "react";
import Box from "@mui/material/Box";
import { Theme } from "@mui/material/styles";
import { Status } from "ui/constants";

interface StatusLabelProps {
  label: string;
  color: Status;
  id?: string;
}

const circleStyle = {
  height: "1em",
  width: "1em",
  borderRadius: "50%",
  display: "inline-block",
  marginRight: "5px",
} as const;

// The dot's color per status, read from the theme so it matches chips, alerts
// and icons of the same status.
const statusColor: Record<Status, (theme: Theme) => string> = {
  [Status.Danger]: theme => theme.palette.error.main,
  [Status.Default]: theme => theme.palette.action.disabledBackground,
  [Status.Success]: theme => theme.palette.success.main,
  [Status.Info]: theme => theme.palette.action.disabledBackground,
  [Status.Primary]: theme => theme.palette.primary.main,
  [Status.Warn]: theme => theme.palette.warning.main,
};

const StatusLabel: React.SFC<StatusLabelProps> = (props) => {
  return (
    <span style={{whiteSpace: "nowrap"}}>
      <Box component="span" sx={theme => ({ ...circleStyle, backgroundColor: statusColor[props.color](theme) })}>&nbsp;</Box>
      <span id={props.id}>{props.label}</span>
    </span>
  );
}

export default StatusLabel;