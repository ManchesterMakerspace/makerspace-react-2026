import * as React from 'react';
import { Autocomplete, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material';
import { Tool, ToolGroup, Shop } from 'app/entities/toolCheckout';

export const emptyGroup = (shopId: string): Partial<ToolGroup> => ({
  shopId, name: '', description: '', includedToolIds: [], prerequisiteIds: [],
  requestable: false, reservable: false, announce: false, announceChannel: '',
});

export default function ToolGroupForm({ value, onChange, tools, shops }: {
  value: Partial<ToolGroup>; onChange: (value: Partial<ToolGroup>) => void; tools: Tool[]; shops: Shop[];
}) {
  const options = tools.filter(tool => tool.shopId === value.shopId).sort((a, b) => a.name.localeCompare(b.name));
  const change = (patch: Partial<ToolGroup>) => onChange({ ...value, ...patch });
  return <Stack spacing={2}>
    <TextField select fullWidth label="Shop" value={value.shopId || ''} disabled={!!value.id}
      slotProps={{ select: { native: true } }}
      onChange={event => change({ shopId: event.target.value, includedToolIds: [], prerequisiteIds: [] })}>
      {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
    </TextField>
    <TextField required label="Group name" value={value.name || ''} onChange={event => change({ name: event.target.value })} />
    <TextField multiline label="Description" value={value.description || ''} onChange={event => change({ description: event.target.value })} />
    <Autocomplete multiple options={options.filter(tool => !value.prerequisiteIds?.includes(tool.id))}
      getOptionLabel={tool => tool.name} value={options.filter(tool => value.includedToolIds?.includes(tool.id))}
      onChange={(_, selected) => change({ includedToolIds: selected.map(tool => tool.id) })}
      renderInput={params => <TextField {...params} label="Included tools" helperText="Include at least one physical tool." />} />
    <Autocomplete multiple options={options.filter(tool => !value.includedToolIds?.includes(tool.id))}
      getOptionLabel={tool => tool.name} value={options.filter(tool => value.prerequisiteIds?.includes(tool.id))}
      onChange={(_, selected) => change({ prerequisiteIds: selected.map(tool => tool.id) })}
      renderInput={params => <TextField {...params} label="Prerequisite tools" />} />
    {(['requestable', 'reservable', 'announce'] as const).map(flag => <FormControlLabel key={flag}
      label={{ requestable: 'Requestable', reservable: 'Reservable', announce: 'Announce requests and checkouts' }[flag]}
      control={<Checkbox checked={!!value[flag]} onChange={event => change({ [flag]: event.target.checked })} />} />)}
    <TextField label="Announcement channel" value={value.announceChannel || ''}
      helperText="Optional. Defaults to the shop channel."
      onChange={event => change({ announceChannel: event.target.value })} />
  </Stack>;
}
