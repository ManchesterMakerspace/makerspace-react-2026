import * as React from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, Link } from '@mui/material';
import { fixRequest, ToolOutageResult } from 'api/fixTickets';
import AffectedReservations from './AffectedReservations';
export default function ToolOutageAction({ tool, onSaved }: { tool: { id: string; name: string; outOfService?: boolean }; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(''); const [count, setCount] = React.useState<number>();
  const [affected, setAffected] = React.useState<ToolOutageResult['affectedReservations']>([]);
  const save = async () => {
    setBusy(true); setError('');
    try { const result = await fixRequest<ToolOutageResult>(`/api/tools/${tool.id}/outage`, { out_of_service: !tool.outOfService }); setCount(result.affectedCount); setAffected(result.affectedReservations); onSaved(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <><Button size="small" onClick={() => { setError(''); setAffected([]); setCount(undefined); setOpen(true); }}>{tool.outOfService ? 'Restore service' : 'Mark out of service'}</Button>
    <Dialog open={open} onClose={() => !busy && setOpen(false)}><DialogTitle>Tool availability: {tool.name}</DialogTitle>
      <DialogContent>{error && <Alert severity="error">{error}</Alert>}{count !== undefined ? <Alert severity="success">Saved. {count} existing reservations need review.</Alert> :
        <Typography>{tool.outOfService ? 'Verify all outstanding issues are addressed before restoring service.' : 'New reservations will be blocked. Existing bookings and billing remain for staff review.'} The Hidden setting is unchanged.</Typography>}
        <Typography sx={{ mt: 2 }}><Link href={`/fix-tickets?mode=queue&tool_id=${tool.id}`}>Review open tickets for this tool</Link></Typography>
        {count !== undefined && <AffectedReservations reservations={affected} />}
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)} disabled={busy}>Close</Button>{count === undefined && <Button variant="contained" disabled={busy} onClick={save}>Confirm</Button>}</DialogActions></Dialog></>;
}
