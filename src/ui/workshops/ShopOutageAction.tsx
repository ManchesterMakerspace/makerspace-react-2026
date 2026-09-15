import * as React from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { fixRequest } from 'api/fixTickets';
import { Workshop } from 'app/entities/workshop';

export default function ShopOutageAction({ shop, onSaved }: { shop: Workshop; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');
  const save = async () => {
    if (!shop.outOfService && !note.trim()) return;
    setBusy(true);
    setError('');
    try {
      await fixRequest(`/api/shops/${shop.id}/outage`, { out_of_service: !shop.outOfService, note: note.trim() });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return <>
    <Button variant="outlined" onClick={() => { setOpen(true); setNote(''); setError(''); }}>
      {shop.outOfService ? 'Restore shop service' : 'Mark shop out of service'}
    </Button>
    <Dialog open={open} fullWidth maxWidth="sm" aria-labelledby="shop-outage-title"
      onClose={() => !busy && setOpen(false)}>
      <DialogTitle id="shop-outage-title" sx={{ overflowWrap: 'anywhere' }}>Shop availability: {shop.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography>{shop.outOfService
          ? 'Confirm the shop is ready to accept reservations again. Tools marked out of service will remain unavailable.'
          : 'This blocks new reservations for the entire shop and every tool in it. Existing reservations remain in place.'}</Typography>
        {!shop.outOfService && <TextField autoFocus fullWidth required multiline minRows={3}
          label="Reason for outage" value={note} disabled={busy}
          onChange={event => setNote(event.target.value)} sx={{ mt: 2 }}
          helperText="Shown to members, sent to the shop’s resource managers on Slack, and posted to its Slack channel if configured." />}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" disabled={busy || (!shop.outOfService && !note.trim())} onClick={save}>
          {busy ? 'Saving…' : shop.outOfService ? 'Restore service' : 'Mark out of service'}
        </Button>
        <Button disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </DialogActions>
    </Dialog>
  </>;
}
