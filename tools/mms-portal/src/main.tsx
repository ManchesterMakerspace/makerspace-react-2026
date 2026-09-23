import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { initializeNative, setFirebaseProjectId } from './native';
import './native.scss';

initializeNative();
document.documentElement.classList.add('mms-native');
const container = document.body.appendChild(document.createElement('div'));
const root = createRoot(container);
const Bootstrap = () => {
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const { loadClientConfig } = await import('api/clientConfig');
        const config = await loadClientConfig();
        setFirebaseProjectId(String(config.firebase_project_id || ''));
        if (cancelled) return;
        await import('app/main');
        setTimeout(() => { root.unmount(); container.remove(); }, 0);
      } catch {
        if (!cancelled) setError('Unable to connect to the Makerspace portal. Check your connection and try again.');
      }
    };
    void start();
    return () => { cancelled = true; };
  }, [attempt]);
  return <Stack spacing={2} sx={{ p: 3, maxWidth: 520, mx: 'auto' }}>
    <Typography component="h1" variant="h4">MMS Portal</Typography>
    {error ? <><Alert severity="error">{error}</Alert><Button variant="contained" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Try again</Button></>
      : <CircularProgress aria-label="Connecting to Makerspace" />}
  </Stack>;
};
root.render(<Bootstrap />);
