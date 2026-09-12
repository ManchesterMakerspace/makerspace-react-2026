import * as React from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, FormLabel, Link, MenuItem, Paper,
  Radio, RadioGroup, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, Typography } from '@mui/material';
import { activeStatuses, categories, confirmations, FixCatalog, FixPerson, FixTicket, fixLabel, fixRequest, statuses } from 'api/fixTickets';
import ToolAvailability from 'ui/common/ToolAvailability';

const base = '/api/fix_tickets';
const date = (value: string) => new Date(value).toLocaleString();
const fieldsSx = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2 };
const SelectField: React.FC<{ label: string; value: string; options: { id: string; name: string }[]; onChange: (v: string) => void; all?: string }> = p =>
  <TextField select fullWidth label={p.label} value={p.value} onChange={e => p.onChange(e.target.value)}>
    {p.all !== undefined && <MenuItem value="">{p.all}</MenuItem>}
    {p.options.map(o => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
  </TextField>;
const opts = (values: string[]) => values.map(v => ({ id: v, name: fixLabel(v) }));

export default function FixTicketsPage() {
  const { id } = useParams();
  const [query, setQuery] = useSearchParams();
  const [catalog, setCatalog] = React.useState<FixCatalog>();
  const [ticket, setTicket] = React.useState<FixTicket>();
  const [rows, setRows] = React.useState<FixTicket[]>([]);
  const [total, setTotal] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [create, setCreate] = React.useState(query.get('new') === 'true');
  const [action, setAction] = React.useState('');
  const [form, setForm] = React.useState<Record<string, any>>({});
  const [people, setPeople] = React.useState<FixPerson[]>([]);
  const [peopleSearch, setPeopleSearch] = React.useState('');
  const [selectedPeople, setSelectedPeople] = React.useState<FixPerson[]>([]);
  const [revealed, setRevealed] = React.useState('');
  const mode = query.get('mode') || 'mine';
  const page = Number(query.get('page') || 0);
  const size = Number(query.get('page_size') || 25);
  const selectedStatuses = query.has('statuses') ? query.get('statuses')!.split(',').filter(Boolean) : activeStatuses;
  const changeQuery = (key: string, value: string) => {
    const next = new URLSearchParams(query); value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '0');
    setQuery(next);
  };
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setRevealed('');
    const q = new URLSearchParams(query); q.delete('new'); q.delete('statuses');
    q.set('mode', mode); selectedStatuses.forEach(s => q.append('statuses[]', s));
    Promise.all([fixRequest<FixCatalog>(`${base}/catalog`), id ? fixRequest<FixTicket>(`${base}/${id}`) : fixRequest<{ tickets: FixTicket[]; total: number }>(`${base}?${q}`)])
      .then(([cat, data]) => {
        if (cancelled) return;
        setCatalog(cat);
        if (id) setTicket(data as FixTicket); else { setRows((data as any).tickets); setTotal((data as any).total); setTicket(undefined); }
      }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, query.toString(), refresh]);
  React.useEffect(() => {
    if (action !== 'assignments' || !id) return;
    let cancelled = false;
    const timer = setTimeout(() => fixRequest<FixPerson[]>(`${base}/${id}/assignee_options?search=${encodeURIComponent(peopleSearch)}`)
      .then(data => { if (!cancelled) setPeople(data); }).catch(e => { if (!cancelled) setError(e.message); }), 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [action, peopleSearch, id]);
  const mutate = async (path: string, body: unknown, method = 'POST') => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await fixRequest<any>(path, body, method);
      if (action === 'reveal') setRevealed(result.name);
      else { setRefresh(n => n + 1); setMessage(result.affectedCount !== undefined ? `Tool availability updated. ${result.affectedCount} existing reservations need review.` : 'Saved.'); }
      setAction('');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const openAction = (name: string) => {
    setError(''); setAction(name); setRevealed('');
    setSelectedPeople(ticket?.assignees || []);
    setForm(name === 'edit' && ticket ? { title: ticket.title, description: ticket.description, category: ticket.category,
      shop_id: ticket.shopId || '', tool_id: ticket.toolId || '', uncatalogued_tool: ticket.uncataloguedTool || '',
      public_read_only: ticket.publicReadOnly, announce_to_slack: ticket.announceToSlack, announcement_note: ticket.announcementNote } :
      name === 'status' ? { status: ticket?.status, confirmation: ticket?.confirmation, note: '', nominate_reward: false } :
      name === 'bounty' ? { title: ticket?.title, description: '', credit_value: 1 } : { note: '' });
  };
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const submitAction = () => {
    if (!ticket) return;
    const path = `${base}/${ticket.id}`;
    if (action === 'status' || action === 'edit') return mutate(path, { ...form, revision: ticket.revision }, 'PATCH');
    if (action === 'assignments') return mutate(`${path}/assignments`, { member_ids: selectedPeople.map(p => p.id) });
    if (action === 'reveal') return mutate(`${path}/reveal`, { acknowledged: true });
    if (action === 'unassign') return mutate(`${path}/assignments`, { unassign_self: true });
    if (action === 'outage') return mutate(`${path}/outage`, { out_of_service: !ticket.outOfService });
    return mutate(`${path}/${action}`, action === 'withdraw' ? {} : form);
  };
  const privacy = <Alert severity="info">Reporter identity is hidden unless an admin explicitly reveals it. Text you write may identify you.
    {catalog?.centralSlackEnabled && ' Full notes are also shared in the central tickets Slack channel.'}</Alert>;
  return <Box sx={{ py: 3, maxWidth: 1400, mx: 'auto', overflowWrap: 'anywhere' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: "space-between", mb: 2 }}>
      <Typography variant="h4" component="h1">{id ? 'Fix ticket' : 'Fix tickets'}</Typography>
      <Stack direction="row" spacing={1}>
        {id && <Button href={`/fix-tickets?${query}`}>All tickets</Button>}
        <Button variant="contained" disabled={!catalog?.canCreate || busy} onClick={() => setCreate(true)}>Report a problem</Button>
      </Stack>
    </Stack>
    {catalog && <Typography color="text.secondary" sx={{ mb: 2 }}>{catalog.openCount} open reports · {catalog.openLimit === null ? 'No ticket cap' : `Limit ${catalog.openLimit}`}</Typography>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
    {loading ? <CircularProgress aria-label="Loading tickets" /> : !id ? <>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={fieldsSx}>
        <SelectField label="List" value={mode} onChange={v => changeQuery('mode', v)} options={[
          { id: 'mine', name: 'My reports' }, { id: 'assigned', name: 'Assigned to me' }, { id: 'queue', name: 'Repair queue' }, { id: 'public', name: 'Public tickets' }]} />
        <SelectField label="Shop" value={query.get('shop_id') || ''} all="All shops" onChange={v => changeQuery('shop_id', v)} options={[{ id: 'none', name: 'No shop' }, ...(catalog?.shops || [])]} />
        <SelectField label="Priority" value={query.get('priority') || ''} all="All priorities" onChange={v => changeQuery('priority', v)} options={[{ id: 'none', name: 'Unprioritized' }, ...Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), name: String(i + 1) }))]} />
        <Autocomplete multiple options={statuses} value={selectedStatuses} getOptionLabel={fixLabel}
          onChange={(_, v) => changeQuery('statuses', (v.length ? v : statuses).join(','))} renderInput={p => <TextField {...p} label="Statuses (clear for all)" />} />
        <SelectField label="Sort by" value={query.get('sort') || 'priority'} onChange={v => changeQuery('sort', v)} options={opts(['priority', 'created_at', 'updated_at'])} />
        <SelectField label="Direction" value={query.get('direction') || 'asc'} onChange={v => changeQuery('direction', v)} options={[{ id: 'asc', name: 'Ascending' }, { id: 'desc', name: 'Descending' }]} />
        <SelectField label="Category" value={query.get('category') || ''} all="All categories" onChange={v => changeQuery('category', v)} options={opts(categories)} />
        <SelectField label="Confirmation" value={query.get('confirmation') || ''} all="All confirmations" onChange={v => changeQuery('confirmation', v)} options={opts(confirmations)} />
        <SelectField label="Tool" value={query.get('tool_id') || ''} all="All tools" onChange={v => changeQuery('tool_id', v)} options={catalog?.tools || []} />
        <SelectField label="Assignee" value={query.get('assignee_id') || ''} all="All assignees" onChange={v => changeQuery('assignee_id', v)} options={catalog?.assignees || []} />
      </Box></Paper>
      <TableContainer component={Paper}><Table size="small" aria-label="Fix tickets" sx={{ minWidth: 850, overflowWrap: 'normal' }}>
        <TableHead><TableRow>{['Ticket', 'Priority', 'Status', 'Shop / tool', 'Created', 'Last update'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{rows.map(t => <TableRow key={t.id}><TableCell><Link href={`/fix-tickets/${t.id}?${query}`}>{t.title}</Link></TableCell>
          <TableCell>{t.priority ?? '—'}</TableCell><TableCell>{fixLabel(t.status)}</TableCell>
          <TableCell>{t.shopName} / {t.toolName || t.uncataloguedTool || '—'} <ToolAvailability outOfService={t.outOfService} /></TableCell>
          <TableCell>{date(t.createdAt)}</TableCell><TableCell>{date(t.updatedAt)}</TableCell></TableRow>)}</TableBody>
      </Table>{!rows.length && <Typography sx={{ p: 3 }}>No tickets match these filters.</Typography>}</TableContainer>
      <TablePagination component="div" count={total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_, p) => changeQuery('page', String(p))} onRowsPerPageChange={e => changeQuery('page_size', e.target.value)} />
    </> : ticket && <Stack spacing={2}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h2">{ticket.title}</Typography>
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", my: 2 }}>
          <Chip label={fixLabel(ticket.status)} /><Chip variant="outlined" label={fixLabel(ticket.confirmation)} />
          <Chip variant="outlined" label={`Priority ${ticket.priority ?? 'unspecified'}`} />
          <Chip label={ticket.publicReadOnly ? 'Public (read-only)' : 'Private'} /><ToolAvailability outOfService={ticket.outOfService} />{ticket.toolHidden && <Chip label="Hidden" />}
        </Stack>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</Typography>
        <Typography sx={{ mt: 2 }}>{ticket.shopName} {ticket.toolName || ticket.uncataloguedTool}</Typography>
        <Typography color="text.secondary">Created {date(ticket.createdAt)} · Last update {date(ticket.updatedAt)}</Typography>
        <Typography>Assignees: {ticket.assignees.map(p => p.name).join(', ') || 'Unassigned'}</Typography>
        {ticket.iBrokeIt && <Typography>Reporter indicated: I broke it</Typography>}
        {ticket.iCanFixIt && <Typography>Reporter indicated: I can fix it!</Typography>}
        {ticket.bountyUrl && <Link href={ticket.bountyUrl}>View volunteer bounty</Link>}
        {ticket.rewardStatus && <Typography>Reporter reward: {ticket.rewardStatus}</Typography>}
        {ticket.capabilities.publicLocked && <Alert severity="info">This ticket stays public while the linked bounty is active.</Alert>}
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", mt: 2 }}>
          {ticket.capabilities.canAddNote && <Button variant="contained" onClick={() => openAction('notes')}>Add note</Button>}
          {ticket.capabilities.canChangeStatus && <Button onClick={() => openAction('status')}>Change status</Button>}
          {ticket.capabilities.canManage && <><Button onClick={() => openAction('edit')}>Edit ticket</Button><Button onClick={() => openAction('assignments')}>Assignees</Button></>}
          {ticket.capabilities.canUnassign && <Button onClick={() => openAction('unassign')}>Unassign myself</Button>}
          {ticket.capabilities.canWithdraw && <Button color="error" onClick={() => openAction('withdraw')}>Withdraw</Button>}
          {ticket.capabilities.canCreateBounty && <Button onClick={() => openAction('bounty')}>Make this a bounty</Button>}
          {ticket.capabilities.canManage && ticket.toolId && <Button onClick={() => openAction('outage')}>{ticket.outOfService ? 'Restore service' : 'Mark out of service'}</Button>}
          {ticket.capabilities.canReveal && <Button onClick={() => openAction('reveal')}>Reveal reporter</Button>}
          {ticket.capabilities.canReviewReward && <><Button onClick={() => mutate(`${base}/${id}/reward`, { decision: 'approve' })}>Approve reporter point</Button><Button onClick={() => mutate(`${base}/${id}/reward`, { decision: 'reject' })}>Reject reporter point</Button></>}
          {ticket.deliveryFailed && <Button onClick={() => mutate(`${base}/${id}/retry_delivery`, {})}>Retry notifications</Button>}
        </Stack>
        {revealed && <Alert severity="warning" sx={{ mt: 2 }}>Reporter: {revealed}</Alert>}
      </Paper>
      {privacy}
      <Typography variant="h6" component="h2">History and notes</Typography>
      {ticket.events?.map(e => <Paper key={e.id} sx={{ p: 2 }}><Typography variant="subtitle2">{e.actor} · {date(e.createdAt)} · {fixLabel(e.kind)}</Typography>
        {e.note && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{e.note}</Typography>}
        {Object.entries(e.changes).map(([key, value]) => <Typography key={key} variant="body2">{fixLabel(key)}: {JSON.stringify(value)}</Typography>)}
      </Paper>)}
    </Stack>}
    <Dialog open={!!action} onClose={() => !busy && setAction('')} fullWidth maxWidth="sm">
      <DialogTitle>{fixLabel(action)}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {action === 'notes' && <>{privacy}<TextField label="Note" multiline minRows={4} value={form.note || ''} onChange={e => set('note', e.target.value)} /></>}
        {action === 'status' && <>
          <SelectField label="Status" value={form.status || ''} options={opts(statuses.filter(s => s !== 'withdrawn'))} onChange={v => set('status', v)} />
          <SelectField label="Confirmation" value={form.confirmation || ''} options={opts(confirmations)} onChange={v => set('confirmation', v)} />
          <TextField multiline minRows={3} label="Note (required to close, reopen, or cannot confirm)" value={form.note || ''} onChange={e => set('note', e.target.value)} />
          {ticket?.capabilities.canNominateReward && form.status === 'resolved' && <FormControlLabel label="Nominate reporter for 1 volunteer point (separate approval)" control={<Checkbox checked={!!form.nominate_reward} onChange={e => set('nominate_reward', e.target.checked)} />} />}
        </>}
        {action === 'edit' && <>
          <TextField label="Title" value={form.title || ''} onChange={e => set('title', e.target.value)} />
          <TextField label="Description" multiline minRows={3} value={form.description || ''} onChange={e => set('description', e.target.value)} />
          <SelectField label="Category" value={form.category || ''} options={opts(categories)} onChange={v => set('category', v)} />
          <SelectField label="Shop" value={form.shop_id || ''} all="No shop" options={catalog?.shops || []} onChange={v => { set('shop_id', v); set('tool_id', ''); }} />
          <SelectField label="Tool" value={form.tool_id || ''} all="No catalog tool" options={catalog?.tools.filter(t => t.shopId === form.shop_id) || []} onChange={v => { set('tool_id', v); if (v) set('uncatalogued_tool', ''); }} />
          {!form.tool_id && <TextField label="Uncatalogued tool" value={form.uncatalogued_tool || ''} onChange={e => set('uncatalogued_tool', e.target.value)} />}
          <Alert severity="info">Publishing exposes the full ticket and its existing notes to current members.</Alert>
          <FormControlLabel label="Public (read-only)" control={<Checkbox disabled={ticket?.capabilities.publicLocked} checked={!!form.public_read_only} onChange={e => set('public_read_only', e.target.checked)} />} />
          <FormControlLabel label="Announce to shop/tool Slack channel" control={<Checkbox checked={!!form.announce_to_slack} onChange={e => set('announce_to_slack', e.target.checked)} />} />
          <TextField label="Shop/tool Slack announcement note" multiline value={form.announcement_note || ''} onChange={e => set('announcement_note', e.target.value)} />
        </>}
        {action === 'assignments' && <Autocomplete multiple options={people} value={selectedPeople} getOptionLabel={p => p.name} isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, v) => setSelectedPeople(v)} onInputChange={(_, v) => setPeopleSearch(v)} renderInput={p => <TextField {...p} label="Search active members" />} />}
        {action === 'bounty' && <><Alert severity="warning">Saving publishes this ticket and all its notes to current members. Review the bounty text before publishing.</Alert>
          <TextField label="Bounty title" value={form.title || ''} onChange={e => set('title', e.target.value)} />
          <TextField label="Public bounty description" multiline minRows={4} value={form.description || ''} onChange={e => set('description', e.target.value)} />
          <TextField label="Volunteer points" type="number" value={form.credit_value ?? 1} onChange={e => set('credit_value', Number(e.target.value))} />
        </>}
        {action === 'reveal' && <Alert severity="warning">Reporter identity is private. Continue only for a legitimate administrative need. This access will be audited.</Alert>}
        {action === 'withdraw' && <Typography>Withdraw this ticket? Its history is retained and any unclaimed bounty is cancelled.</Typography>}
        {action === 'unassign' && <Typography>Remove yourself? You may lose access to this ticket.</Typography>}
        {action === 'outage' && <Typography>{ticket?.outOfService ? 'Restore this tool to service? Verify that all outstanding issues are addressed.' : 'Mark this tool out of service? Existing bookings remain and require staff review.'} The Hidden flag is unchanged.</Typography>}
      </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setAction('')}>Cancel</Button><Button variant="contained" disabled={busy} onClick={submitAction}>{busy ? 'Saving…' : 'Confirm'}</Button></DialogActions>
    </Dialog>
    <NewTicket open={create} catalog={catalog} initialShop={query.get('shop_id') || ''} initialTool={query.get('tool_id') || ''} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); setRefresh(n => n + 1); setMessage('Report submitted.'); }} />
  </Box>;
}

function NewTicket({ open, catalog, initialShop, initialTool, onClose, onSaved }: { open: boolean; catalog?: FixCatalog; initialShop: string; initialTool: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<Record<string, any>>({});
  const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) { setForm({ title: '', description: '', category: 'broken', shop_id: catalog?.tools.find(t => t.id === initialTool)?.shopId || (initialShop === 'none' ? '' : initialShop), tool_id: initialTool, uncatalogued_tool: '', priority: '', i_broke_it: false, i_can_fix_it: false, public_read_only: false, submission_key: crypto.randomUUID() }); setError(''); } }, [open]);
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const submit = async () => { setBusy(true); setError(''); try { await fixRequest(base, { ...form, priority: form.priority ? Number(form.priority) : null }); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="sm"><DialogTitle>Report a problem</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
    {error && <Alert severity="error">{error}</Alert>}
    <Alert severity="info">Your identity is hidden except from admins after a privacy acknowledgment. Text you write may identify you.{catalog?.centralSlackEnabled && ' Full notes will also be shared in the central tickets Slack channel.'}</Alert>
    <TextField required label="Title" value={form.title || ''} onChange={e => set('title', e.target.value)} slotProps={{ htmlInput: { maxLength: 150 } }} />
    <TextField required label="Description" multiline minRows={4} value={form.description || ''} onChange={e => set('description', e.target.value)} />
    <FormControl><FormLabel>Issue type</FormLabel><RadioGroup row value={form.category || 'broken'} onChange={e => set('category', e.target.value)}>{categories.map(c => <FormControlLabel key={c} value={c} control={<Radio />} label={fixLabel(c)} />)}</RadioGroup></FormControl>
    <SelectField label="Shop (optional)" value={form.shop_id || ''} all="No shop" options={catalog?.shops || []} onChange={v => { set('shop_id', v); set('tool_id', ''); }} />
    <SelectField label="Tool (optional)" value={form.tool_id || ''} all="No catalog tool" options={catalog?.tools.filter(t => t.shopId === form.shop_id) || []} onChange={v => { set('tool_id', v); if (v) set('uncatalogued_tool', ''); }} />
    {!form.tool_id && <TextField label="Uncatalogued tool name (optional)" value={form.uncatalogued_tool || ''} onChange={e => set('uncatalogued_tool', e.target.value)} />}
    <SelectField label="Priority (1 highest, 10 lowest)" value={String(form.priority || '')} all="Unprioritized" options={Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), name: String(i + 1) }))} onChange={v => set('priority', v)} />
    <Typography variant="caption">Cannot be manually changed later. Existing tickets at this priority shift down; beyond 10 becomes unprioritized.</Typography>
    {(['i_broke_it', 'i_can_fix_it', 'public_read_only'] as const).map((key, i) => <FormControlLabel key={key} label={['I broke it', 'I can fix it!', 'Public (read-only): current members can read the full ticket and notes'][i]} control={<Checkbox checked={!!form[key]} onChange={e => set(key, e.target.checked)} />} />)}
  </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>Cancel</Button><Button variant="contained" disabled={busy || !form.title?.trim() || !form.description?.trim()} onClick={submit}>{busy ? 'Submitting…' : 'Submit report'}</Button></DialogActions></Dialog>;
}
