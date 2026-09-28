import * as React from 'react';
import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { ToolGroup, Tool, Shop } from 'app/entities/toolCheckout';
import { archiveToolGroup, listToolGroups, saveToolGroup } from 'api/toolCheckouts';
import FormModal from 'ui/common/FormModal';
import ToolGroupForm from './ToolGroupForm';

export function GroupDetails({ group }: { group: ToolGroup }) {
  return <Stack spacing={1}>
    <Typography>{group.description}</Typography>
    {group.includedTools.map(tool => <div key={tool.id}>
      <Typography><a href={tool.wikiUrl} target="_blank" rel="noopener noreferrer">{tool.name}</a>
        {tool.gdriveId && <> · <a href={`https://drive.google.com/drive/folders/${tool.gdriveId}`} target="_blank" rel="noopener noreferrer">Drive</a></>}
      </Typography>
      {tool.requestorAnnotation && <Typography variant="body2">{tool.requestorAnnotation}</Typography>}
      {tool.notes && <Typography variant="body2">{tool.notes}</Typography>}
    </div>)}
  </Stack>;
}

export default function ToolGroupList({ shops, tools, shopId }: { shops: Shop[]; tools: Tool[]; shopId?: string }) {
  const [groups, setGroups] = React.useState<ToolGroup[]>([]);
  const [editing, setEditing] = React.useState<Partial<ToolGroup> | null>(null);
  const [deleting, setDeleting] = React.useState<ToolGroup | null>(null);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const refresh = React.useCallback(async () => {
    const result = await listToolGroups(shopId);
    if (result.error) setError(result.error.message); else setGroups(result.data || []);
  }, [shopId]);
  React.useEffect(() => { void refresh(); }, [refresh, tools]);
  React.useEffect(() => {
    const changed = () => { void refresh(); };
    window.addEventListener('tool-groups-changed', changed);
    return () => window.removeEventListener('tool-groups-changed', changed);
  }, [refresh]);
  const save = async () => {
    if (!editing?.name?.trim() || !editing.includedToolIds?.length) { setError('Enter a name and include at least one tool.'); return; }
    setSaving(true);
    const result = await saveToolGroup(editing);
    setSaving(false);
    if (result.error) setError(result.error.message); else { setEditing(null); setError(''); await refresh(); }
  };
  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    const result = await archiveToolGroup(deleting);
    setSaving(false);
    if (result.error) setError(result.error.message); else { setDeleting(null); setError(''); await refresh(); }
  };
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    {groups.map(group => <Paper key={group.id} sx={{ p: 2, overflowWrap: 'anywhere' }}>
      <Typography variant="h6">{group.name} <Chip label="Group" size="small" /></Typography>
      <GroupDetails group={group} />
      {group.canManage && <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button onClick={() => { setError(''); setEditing(group); }}>Edit</Button>
        <Button color="error" onClick={() => setDeleting(group)}>Delete</Button>
      </Stack>}
    </Paper>)}
    {editing && <FormModal id="edit-group" isOpen title="Edit group" closeHandler={() => setEditing(null)}
      onSubmit={save} submitText="Save" loading={saving} error={error}>
      <ToolGroupForm value={editing} onChange={setEditing} tools={tools} shops={shops} />
    </FormModal>}
    {deleting && <FormModal id="delete-group" isOpen title="Delete group" closeHandler={() => setDeleting(null)}
      onSubmit={remove} submitText="Delete" loading={saving} error={error}>
      <Typography>Delete {deleting.name}? Open requests will be cancelled. Existing checkouts and reservations are retained.</Typography>
    </FormModal>}
  </Stack>;
}
