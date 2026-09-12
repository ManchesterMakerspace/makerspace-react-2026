import * as React from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { fixRequest } from 'api/fixTickets';
export default function TicketLimitSetting() {
  const [value, setValue] = React.useState('10'); const [error, setError] = React.useState(''); const [saved, setSaved] = React.useState(false); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { fixRequest<any>('/api/admin/system_configs').then(r => setValue(String(r.security?.ticket_open_limit ?? r.security?.ticketOpenLimit ?? 10))).catch(e => setError(e.message)); }, []);
  const save = async () => { setBusy(true); setSaved(false); setError(''); try { await fixRequest('/api/admin/system_configs/update_setting', { key: 'ticket_open_limit', value }, 'PUT'); setSaved(true); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return <Stack spacing={2} sx={{ my: 3 }}><Typography variant="h6">Repair tickets</Typography>{error && <Alert severity="error">{error}</Alert>}{saved && <Alert severity="success">Ticket limit saved.</Alert>}
    <TextField label="Open ticket limit per reporter" type="number" value={value} onChange={e => setValue(e.target.value)} helperText="Admins and board are exempt while holding those roles." />
    <Button variant="contained" disabled={busy || !/^[1-9]\d*$/.test(value)} onClick={save}>Save ticket limit</Button></Stack>;
}
