import * as React from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Button, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material';
import { fixRequest } from 'api/fixTickets';
import { VOLUNTEER_CREDIT_TIMING_MESSAGE, VOLUNTEER_REVIEW_MESSAGE } from 'ui/volunteer/volunteerMessages';
export default function FixBountyPage() {
  const { id } = useParams(); const [task, setTask] = React.useState<any>();
  const [loading, setLoading] = React.useState(true);
  const [reload, setReload] = React.useState(0);
  const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const [successNotice, setSuccessNotice] = React.useState('');
  React.useEffect(() => {
    let active = true; setLoading(true); setTask(undefined); setError(''); setSuccessNotice('');
    fixRequest(`/api/volunteer/tasks/${id}/detail`)
      .then(t => { if (active) setTask(t); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload]);
  const act = async (action: string) => {
    if (busy || loading || !task) return;
    setBusy(true); setError(''); setSuccessNotice('');
    let saved = false;
    try {
      await fixRequest(`/api/volunteer/tasks/${id}/${action}`, {});
      setSuccessNotice(action === 'claim'
        ? 'Task claimed. When you finish the work, submit completion for verification.'
        : 'Completion submitted for verification.');
      saved = true; setTask(undefined); setLoading(true);
      setTask(await fixRequest(`/api/volunteer/tasks/${id}/detail`));
    } catch (e: any) {
      setError(saved ? `Your action succeeded, but refreshing the bounty failed: ${e.message}. Retry loading its current state.` : e.message);
    } finally { setBusy(false); setLoading(false); }
  };
  const ticketId = task?.ticketId || task?.ticket_id;
  return <Paper sx={{ p: 3, my: 3, maxWidth: 900, mx: 'auto' }}>
    {(successNotice || task?.status === 'pending') && <Alert severity={successNotice ? 'success' : 'info'} role='status' sx={{ mb: 2 }}>
      {successNotice && <Typography>{successNotice}</Typography>}
      <Typography sx={{ mt: successNotice ? 1 : 0 }}>{VOLUNTEER_CREDIT_TIMING_MESSAGE}</Typography>
      <Typography sx={{ mt: 1 }}>{VOLUNTEER_REVIEW_MESSAGE}</Typography>
    </Alert>}
    {error && <Alert severity="error">{error}</Alert>}{loading ? <CircularProgress aria-label="Loading bounty" /> : !task ? <Button onClick={() => setReload(n => n + 1)}>Retry loading bounty</Button> : <Stack spacing={2}>
    <Typography component="h1" variant="h4">{task.title}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.description}</Typography>
    <Typography>{task.status} · {task.creditValue ?? task.credit_value} volunteer points</Typography>
    {ticketId && <Link href={`/fix-tickets/${ticketId}`}>View source ticket</Link>}
    {task.capabilities?.canClaim && <><Typography>Claiming adds you as a ticket assignee with permission to add notes and update its status.</Typography><Button disabled={busy} variant="contained" onClick={() => act('claim')}>Claim bounty</Button></>}
    {task.capabilities?.canSubmitCompletion && <Button disabled={busy} onClick={() => act('complete')}>Submit completion for verification</Button>}
  </Stack>}</Paper>;
}
