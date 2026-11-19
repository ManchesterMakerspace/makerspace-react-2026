import * as React from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCapabilities } from 'app/permissions';
import { useAuthState } from 'ui/reducer/hooks';
import { ContinuousPaidMembership as Balance, getContinuousPaidMembership,
  increaseContinuousPaidMembership, PaidMembershipError } from 'api/continuousPaidMembership';

export default function ContinuousPaidMembership({ member }: {
  member: { id: string; status?: string; expirationTime?: number | string };
}) {
  const { currentUser } = useAuthState();
  const { canViewOtherPaidMembershipMonths, canIncreasePaidMembershipMonths } = useCapabilities();
  const allowed = !!member.id && (currentUser?.id === member.id || canViewOtherPaidMembershipMonths);
  const [balance, setBalance] = React.useState<Balance>();
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [proposed, setProposed] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [saveError, setSaveError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState('');
  const generation = React.useRef(0);

  const load = React.useCallback(async () => {
    const token = ++generation.current;
    setLoading(true); setLoadError('');
    try {
      const result = await getContinuousPaidMembership(member.id);
      if (token === generation.current) setBalance(result);
    } catch (failure) {
      if (token === generation.current) setLoadError((failure as Error).message);
    } finally { if (token === generation.current) setLoading(false); }
  }, [member.id]);

  React.useEffect(() => {
    setBalance(undefined); setOpen(false); setSuccess('');
    if (allowed) void load();
    return () => { generation.current++; };
  }, [allowed, load, member.status, member.expirationTime]);

  if (!allowed) return null;
  const eligible = member.status !== 'revoked' && !!member.expirationTime &&
    Date.now() < Number(member.expirationTime) + 240 * 60 * 60 * 1000;
  const validMonths = /^\d+$/.test(proposed) && Number.isSafeInteger(Number(proposed)) &&
    Number(proposed) > (balance?.continuousPaidMembershipMonths ?? 0);
  const validReason = reason.trim().length > 0 && reason.trim().length <= 2000;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!balance || !validMonths || !validReason || saving || loading || loadError || !eligible) return;
    setSaving(true); setSaveError('');
    const token = generation.current;
    try {
      const result = await increaseContinuousPaidMembership(member.id, {
        continuousPaidMembershipMonths: Number(proposed), expectedRevision: balance.revision, reason: reason.trim(),
      });
      if (token !== generation.current) return;
      setBalance(result); setOpen(false);
      setSuccess(`Paid membership months increased to ${result.continuousPaidMembershipMonths}.`);
    } catch (failure) {
      if (token !== generation.current) return;
      if ((failure as PaidMembershipError).status === 409) {
        setSaveError('Paid membership changed. The current value is refreshing; review it before saving again.');
        await load();
      } else setSaveError((failure as Error).message);
    } finally { setSaving(false); }
  };

  return <Stack spacing={1} sx={{ my: 2 }}>
    {loading && <Box role="status" aria-label="Loading paid membership months"><LinearProgress /></Box>}
    {loadError && <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{loadError}</Alert>}
    {balance && <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Typography>Continuous paid membership: {balance.continuousPaidMembershipMonths} months</Typography>
      {balance.estimated && <Tooltip title="Historical records are incomplete. Identifiable paid months are counted; some continuity is estimated.">
        <Chip size="small" label="Estimated history" />
      </Tooltip>}
      {canIncreasePaidMembershipMonths && <>
        <Button variant="outlined" size="small" disabled={loading || !!loadError || !eligible} onClick={() => {
          setProposed(''); setReason(''); setSaveError(''); setSuccess(''); setOpen(true);
        }}>Adjust months</Button>
        {!eligible && <Typography variant="body2" color="text.secondary">
          Restore membership eligibility and expiration before increasing paid membership months.
        </Typography>}
      </>}
    </Stack>}
    {success && <Alert severity="success" role="status">{success}</Alert>}
    <Dialog open={open && canIncreasePaidMembershipMonths} onClose={() => { if (!saving) setOpen(false); }}
      fullWidth maxWidth="sm" aria-labelledby="increase-paid-membership-title">
      <Box component="form" onSubmit={submit}>
        <DialogTitle id="increase-paid-membership-title">Increase paid membership months</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>Current value: {balance?.continuousPaidMembershipMonths ?? 'Loading'} months</Typography>
            {loading && <LinearProgress aria-label="Refreshing current paid membership" />}
            {saveError && <Alert severity="error">{saveError}</Alert>}
            {loadError && <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{loadError}</Alert>}
            <TextField autoFocus required fullWidth label="Proposed months" value={proposed}
              onChange={event => setProposed(event.target.value)} disabled={saving}
              error={!!proposed && !validMonths} slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]+' } }}
              helperText="Enter a whole number greater than the current value." />
            <TextField required fullWidth multiline minRows={3} label="Correction reason" value={reason}
              onChange={event => setReason(event.target.value)} disabled={saving}
              slotProps={{ htmlInput: { maxLength: 2000 } }} helperText="This reason is saved in the audit log." />
            <Typography variant="body2" color="text.secondary">This sets the paid balance to the proposed whole number. Membership expiration stays the same.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" type="submit" disabled={!validMonths || !validReason || saving || loading || !!loadError || !eligible}>
            {saving ? 'Saving…' : 'Save increase'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  </Stack>;
}
