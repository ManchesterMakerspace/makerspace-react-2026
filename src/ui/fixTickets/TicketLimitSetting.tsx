import * as React from 'react';
import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { fixRequest } from 'api/fixTickets';
export default function TicketLimitSetting() {
  const [value, setValue] = React.useState(''); const [error, setError] = React.useState(''); const [saved, setSaved] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true); const [loaded, setLoaded] = React.useState(false); const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoaded(false); setError('');
    fixRequest<any>('/api/admin/system_configs').then(r => {
      const current = String(r.security?.ticket_open_limit ?? r.security?.ticketOpenLimit ?? '');
      if (!/^[1-9]\d*$/.test(current)) throw new Error('The current ticket limit could not be retrieved. Retry loading before saving.');
      if (!cancelled) { setValue(current); setLoaded(true); }
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);
  const canSave = loaded && !loading && !busy && /^[1-9]\d*$/.test(value);
  const save = async () => { if (!canSave) return; setBusy(true); setSaved(false); setError(''); try { await fixRequest('/api/admin/system_configs/update_setting', { key: 'ticket_open_limit', value }, 'PUT'); setSaved(true); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return <Stack spacing={2} sx={{ my: 3 }}><Typography variant="h6">Repair tickets</Typography>{error && <Alert severity="error">{error}</Alert>}{saved && <Alert severity="success">Ticket limit saved.</Alert>}
    {loading && <CircularProgress aria-label="Loading ticket limit" size={24} />}
    {!loading && !loaded && <Button onClick={() => setRetry(n => n + 1)}>Retry loading ticket limit</Button>}
    <TextField disabled={!loaded || loading || busy} label="Open ticket limit per reporter" type="number" value={value} onChange={e => { setValue(e.target.value); setSaved(false); }} helperText="Admins and board are exempt while holding those roles." />
    <Button variant="contained" disabled={!canSave} onClick={save}>{busy ? 'Saving…' : 'Save ticket limit'}</Button></Stack>;
}
