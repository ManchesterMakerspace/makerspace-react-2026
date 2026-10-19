import * as React from 'react';
import { Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { Tool, ToolCheckout } from 'app/entities/toolCheckout';
import { bulkUpdateCheckoutExpirations, createToolCheckoutRequest, listToolCheckouts, updateCheckoutExpiration } from 'api/toolCheckouts';
import FormModal from 'ui/common/FormModal';
import CheckoutTrainingPlanLink from './CheckoutTrainingPlanLink';

const easternToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const expirationLabel = (row: ToolCheckout) => !row.expiresOn ? 'Never expires' :
  `${row.expirationStatus === 'expired' || row.expiresOn < easternToday() ? 'Expired' : 'Expires'} ${row.expiresOn}`;

const announceChange = () => window.dispatchEvent(new Event('checkout-expiration-changed'));

export function CheckoutExpirationActions({ checkout, onSaved }: { checkout: ToolCheckout; onSaved: () => void }) {
  const [mode, setMode] = React.useState<'edit' | 'renew' | null>(null);
  const [stale, setStale] = React.useState(false);
  const [date, setDate] = React.useState(checkout.expiresOn || '');
  const [never, setNever] = React.useState(!checkout.expiresOn);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const save = async () => {
    if (saving || stale) return;
    setSaving(true); setError('');
    try {
      const result = mode === 'edit' ? await updateCheckoutExpiration(checkout, never ? null : date) :
        await createToolCheckoutRequest({ body: { toolId: checkout.toolId, note } });
      if (result.error) {
        setError(result.error.message);
        if (result.error.status === 409) { setStale(true); setError(`${result.error.message} Close and reopen to review the latest expiration.`); onSaved(); }
      } else { setMode(null); announceChange(); onSaved(); }
    } catch { setError('Unable to save. Refresh and try again.'); }
    finally { setSaving(false); }
  };
  return <Stack spacing={1}>
    <Typography variant="body2">{expirationLabel(checkout)}</Typography>
    <CheckoutTrainingPlanLink url={checkout.checkoutTrainingPlanUrl} />
    {checkout.canManageExpiration && <Button size="small" onClick={() => {
      setDate(checkout.expiresOn || ''); setNever(!checkout.expiresOn); setError(''); setStale(false); setMode('edit');
    }}>Edit expiration</Button>}
    {checkout.canRenew && <Button size="small" onClick={() => { setError(''); setStale(false); setNote(''); setMode('renew'); }}>Request renewal</Button>}
    {mode && <FormModal id={`checkout-expiration-${checkout.id}`} isOpen
      title={mode === 'edit' ? 'Edit checkout expiration' : 'Request checkout renewal'}
      closeHandler={() => { if (!saving) setMode(null); }} onSubmit={save} loading={saving} error={error}
      submitText={mode === 'edit' ? 'Save expiration' : 'Request renewal'}
      submitDisabled={saving || stale || (mode === 'edit' && !never && !date)}>
      <Stack spacing={2}>
        <Typography>{checkout.toolName} — {checkout.memberName}</Typography>
        {mode === 'edit' ? <>
          <FormControlLabel label="Never expires" control={<Checkbox checked={never} disabled={saving} onChange={e => setNever(e.target.checked)} />} />
          <TextField label="Expiration date (Eastern time)" type="date" value={date} disabled={never || saving}
            onChange={e => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
            helperText="Valid through this date. Earlier dates can immediately expire this checkout. Existing reservations are rechecked when edited." />
        </> : <>
          <CheckoutTrainingPlanLink url={checkout.checkoutTrainingPlanUrl} />
          <TextField label="Note" value={note} disabled={saving} multiline
            slotProps={{ htmlInput: { maxLength: 128 } }} onChange={e => setNote(e.target.value)} />
        </>}
      </Stack>
    </FormModal>}
  </Stack>;
}

export function BulkCheckoutExpirationButton({ tool, onSaved }: { tool: Tool; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState<number | null>(null);
  const [date, setDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const today = easternToday();
  const loadCount = async () => {
    setCount(null); setError('');
    try {
      const result = await listToolCheckouts({ toolId: tool.id });
      if (result.error) setError(result.error.message);
      else setCount(result.data.filter(row => !row.revokedAt && !row.supersededById).length);
    } catch { setError('Unable to load checkout count. Retry before confirming.'); }
  };
  const save = async () => {
    if (saving || !date || date <= today) return;
    setSaving(true); setError('');
    try {
      const result = await bulkUpdateCheckoutExpirations(tool.id, date);
      if (result.error) setError(result.error.message);
      else {
        setMessage(`Updated ${result.data.affectedCount} checkouts.`); setOpen(false); announceChange(); onSaved();
      }
    } catch { setError('Unable to update expirations. Please try again.'); }
    finally { setSaving(false); }
  };
  if (!tool.canManageCheckoutExpiration) return null;
  return <>
    <Button variant="outlined" onClick={() => { setOpen(true); setDate(''); setMessage(''); void loadCount(); }}>Set checkout expirations</Button>
    {message && <Typography role="status">{message}</Typography>}
    {open && <FormModal id="bulk-checkout-expiration" isOpen title={`Set checkout expirations: ${tool.name}`}
      closeHandler={() => { if (!saving) setOpen(false); }} onSubmit={save} loading={saving} error={error}
      submitText="Confirm expiration update" submitDisabled={saving || count === null || !date || date <= today}>
      <Stack spacing={2}>
        <Typography>{count === null ? 'Loading affected checkouts…' : `${count} current non-revoked checkouts will receive this date, including expired checkouts and checkouts with no expiration.`}</Typography>
        <Typography variant="body2">Revoked and superseded history is preserved. The final count includes changes made before this update executes.</Typography>
        {count === null && error && <Button onClick={loadCount}>Retry checkout count</Button>}
        <TextField type="date" label="Expiration date (Eastern time)" value={date} disabled={saving}
          onChange={e => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
          error={!!date && date <= today} helperText="Choose a date later than today. Checkouts remain valid through that date." />
      </Stack>
    </FormModal>}
  </>;
}
