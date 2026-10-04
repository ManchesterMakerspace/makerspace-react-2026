import * as React from 'react';
import { Alert, Button, Typography } from '@mui/material';

export default function ToolGroupLoadStatus({ loading, error, onRetry }: {
  loading: boolean; error: string; onRetry: () => void;
}) {
  if (error) return <Alert severity="error" action={<Button color="inherit" onClick={onRetry}>Retry tool groups</Button>}>{error}</Alert>;
  return loading ? <Typography role="status">Loading tool groups…</Typography> : null;
}
