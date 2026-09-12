import * as React from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Button, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material';
import { fixRequest } from 'api/fixTickets';
export default function FixBountyPage() {
  const { id } = useParams(); const [task, setTask] = React.useState<any>();
  const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { let active = true; fixRequest(`/api/volunteer/tasks/${id}/detail`).then(t => { if (active) setTask(t); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id]);
  const act = async (action: string) => { setBusy(true); try { await fixRequest(`/api/volunteer/tasks/${id}/${action}`, {}); setTask(await fixRequest(`/api/volunteer/tasks/${id}/detail`)); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const ticketId = task?.ticketId || task?.ticket_id;
  return <Paper sx={{ p: 3, my: 3, maxWidth: 900, mx: 'auto' }}>{error && <Alert severity="error">{error}</Alert>}{!task ? <CircularProgress aria-label="Loading bounty" /> : <Stack spacing={2}>
    <Typography component="h1" variant="h4">{task.title}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.description}</Typography>
    <Typography>{task.status} · {task.creditValue ?? task.credit_value} volunteer points</Typography>
    {ticketId && <Link href={`/fix-tickets/${ticketId}`}>View source ticket</Link>}
    {task.status === 'available' && <><Typography>Claiming adds you as a ticket assignee with permission to add notes and update its status.</Typography><Button disabled={busy} variant="contained" onClick={() => act('claim')}>Claim bounty</Button></>}
    {task.status === 'claimed' && <Button disabled={busy} onClick={() => act('complete')}>Submit completion for verification</Button>}
  </Stack>}</Paper>;
}
