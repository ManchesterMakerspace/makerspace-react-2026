import * as React from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import {
  FeedbackSeverity,
  useDisplayedFeedbackMessage,
} from "components/Feedback/DisplayedFeedback";

interface WarningProps {
  warning: string | React.ReactElement;
  id?: string;
}

const WarningMessage: React.FC<WarningProps> = props => {
  const { warning, id } = props;
  useDisplayedFeedbackMessage(FeedbackSeverity.Warning, warning);

  return warning ? (
    <Grid container direction="row" alignItems="center">
      <WarningAmberIcon fontSize="small" color="warning" />
      <Typography id={id} color="warning.dark">
        {warning}
      </Typography>
    </Grid>
  ) : null;
};

export default WarningMessage;
