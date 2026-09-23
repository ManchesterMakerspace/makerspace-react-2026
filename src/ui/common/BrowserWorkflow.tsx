import * as React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { openPortal } from 'app/platform';

/** Native flows intentionally keep browser sessions and carts separate. */
export const BrowserWorkflow: React.FC<{ path: string; label?: string }> = ({ path, label = 'Continue in browser' }) => {
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  return <Stack spacing={2} sx={{ my: 2 }}>
    <Alert severity="info">Continue on the Makerspace website. You may need to sign in and select your invoice again. Return to this app when finished.</Alert>
    <Button variant="contained" disabled={loading} onClick={async () => {
      setLoading(true); setError('');
      try { await openPortal(path); } catch { setError('Unable to open the browser. Please try again.'); }
      finally { setLoading(false); }
    }}>{label}</Button>
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
};
