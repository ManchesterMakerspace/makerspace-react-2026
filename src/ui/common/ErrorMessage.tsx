import * as React from "react";
import Typography from "@mui/material/Typography";
import ErrorIcon from '@mui/icons-material/Error';
import Grid from '@mui/material/Grid';

interface ErrorProps {
  error: string | JSX.Element;
  id?: string;
}

const ErrorMessage: React.FC<ErrorProps> = (props) => {
  const { error, id } = props;
  return error ? (
    <Grid
      container
      direction="row"
      alignItems="center"
    >
      <ErrorIcon fontSize="small" color="error"/>
      <Typography id={id} color="error">{error}</Typography>
    </Grid>
  ) : null;
}

export default ErrorMessage;