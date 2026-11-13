import * as React from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { EventbriteRecord, listEventbrite, getEventbrite, eventLabel } from 'api/eventbrite';
import { useCapabilities } from 'app/permissions';
import { buildProfileRouting } from 'ui/member/utils';

const RecordSummary: React.FC<{ record: EventbriteRecord }> = ({ record }) => <Stack spacing={1}>
  <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{record.name || record.eventbriteId}</Typography>
  {record.email && <Typography sx={{ overflowWrap: 'anywhere' }}>{record.email}</Typography>}
  {(record.event || record.startsAt) && <Typography>{eventLabel(record.event || { name: record.name, startsAt: record.startsAt, timezone: record.timezone })}</Typography>}
  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
    {record.status && <Chip label={record.status} size="small" />}
    {(record.refundedAt || record.refunded) && <Chip label="Refunded" color="warning" size="small" />}
    {record.invalidatedAt && <Chip label={`Invalid: ${record.invalidationReason || 'unavailable'}`} size="small" />}
    {record.linkConflict && <Chip label="Email link mismatch" color="warning" size="small" />}
  </Stack>
  {record.ticketClassId && <Typography variant="body2">Ticket: {record.ticketClassName || record.ticketClassId}</Typography>}
  <Typography variant="caption">Organization {record.organizationId} · Eventbrite ID {record.eventbriteId}</Typography>
  {[...new Set([record.memberId, ...(record.memberIds || [])].filter(Boolean))].map(id => <Link key={id} to={buildProfileRouting(id)}>View linked member profile</Link>)}
</Stack>;

export default function EventbriteBrowser({ memberId }: { memberId?: string }) {
  const { canViewEventbriteHistory } = useCapabilities();
  const kinds = memberId ? ['orders', 'attendees'] : ['events', 'orders', 'attendees'];
  const [kind, setKind] = React.useState(kinds[0]);
  const [filters, setFilters] = React.useState({ search: '', organization_id: '', event_id: '', status: '', linked: '' });
  const [page, setPage] = React.useState(0);
  const [revision, refresh] = React.useReducer(n => n + 1, 0);
  const [data, setData] = React.useState<{ records: EventbriteRecord[]; total: number }>({ records: [], total: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [detail, setDetail] = React.useState<EventbriteRecord>();
  const [detailId, setDetailId] = React.useState<string>();
  const [detailError, setDetailError] = React.useState(false);
  const [detailRevision, retryDetail] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    if (!canViewEventbriteHistory) return;
    let active = true;
    setLoading(true); setError(''); setData({ records: [], total: 0 });
    listEventbrite(kind, { ...filters, pageNum: page }, memberId).then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError('Could not load Eventbrite records.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, filters, page, memberId, revision, canViewEventbriteHistory]);
  React.useEffect(() => {
    if (!detailId || !canViewEventbriteHistory) return;
    let active = true; setDetail(undefined); setDetailError(false);
    getEventbrite(kind, detailId).then(record => { if (active) setDetail(record); }).catch(() => { if (active) setDetailError(true); });
    return () => { active = false; };
  }, [detailId, kind, detailRevision, canViewEventbriteHistory]);
  if (!canViewEventbriteHistory) return null;
  return <Box sx={{ maxWidth: 1000, mx: 'auto', p: 1 }}>
    <Typography variant="h4" component="h1">Eventbrite</Typography>
    <Tabs value={kind} onChange={(_, value) => { setKind(value); setPage(0); }} variant="scrollable" aria-label="Eventbrite records">
      {kinds.map(value => <Tab key={value} value={value} label={value[0].toUpperCase() + value.slice(1)} />)}
    </Tabs>
    <Stack spacing={2} sx={{ my: 2 }}>
      {Object.entries(filters).filter(([key]) => kind !== 'events' || !['event_id', 'linked'].includes(key)).map(([key, value]) =>
        <TextField key={key} size="small" fullWidth label={{ search: 'Name or email', organization_id: 'Organization ID', event_id: 'Event ID', status: 'Provider status', linked: 'Member link' }[key]}
          select={key === 'linked'} value={value} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(0); }}>
          {key === 'linked' && ['', 'linked', 'unlinked', 'conflict'].map(option => <MenuItem key={option} value={option}>{option || 'All'}</MenuItem>)}
        </TextField>)}
      {loading && <Typography role="status">Loading Eventbrite records…</Typography>}
      {error && <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>}>{error}</Alert>}
      {!loading && !error && data.records.length === 0 && <Typography>No matching Eventbrite records.</Typography>}
      {data.records.map(record => <Paper key={record.id} sx={{ p: 2 }}><RecordSummary record={record} /><Button onClick={() => setDetailId(record.id)}>View details</Button></Paper>)}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</Button>
        <Typography variant="body2">Page {page + 1} · {data.total} records</Typography>
        <Button disabled={(page + 1) * 50 >= data.total || loading} onClick={() => setPage(page + 1)}>Next</Button>
      </Stack>
    </Stack>
    <Dialog open={!!detailId} onClose={() => setDetailId(undefined)} fullWidth maxWidth="sm" aria-labelledby="eventbrite-detail-title">
      <DialogTitle id="eventbrite-detail-title">Eventbrite details</DialogTitle>
      <DialogContent><Stack spacing={2}>
        {!detail && !detailError && <Typography role="status">Loading details…</Typography>}
        {detailError && <Alert severity="error" action={<Button onClick={retryDetail}>Retry</Button>}>Could not load details.</Alert>}
        {detail && <><RecordSummary record={detail} />{[...(detail.ticketClasses || []), ...(detail.attendees || [])].map(record => <Paper variant="outlined" sx={{ p: 2 }} key={record.id}><RecordSummary record={record} /></Paper>)}</>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDetailId(undefined)}>Close</Button></DialogActions>
    </Dialog>
  </Box>;
}
