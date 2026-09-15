import * as React from 'react';
import { Alert, Autocomplete, Button, Stack, TextField, Tooltip } from '@mui/material';
import { fixRequest, FixPerson } from 'api/fixTickets';

export default function ShopResourceManagersField({ value, onChange, disabled }: {
  value: FixPerson[]; onChange: (people: FixPerson[]) => void; disabled?: boolean;
}) {
  const [options, setOptions] = React.useState<FixPerson[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fixRequest<FixPerson[]>('/api/admin/shops/resource_manager_options')
      .then(data => { if (active) setOptions(data); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  return <Stack spacing={1} sx={{ mb: 2 }}>
    {error && <Alert severity="error" action={<Button onClick={() => setRetry(n => n + 1)}>Retry</Button>}>{error}</Alert>}
    <Autocomplete multiple value={value} options={options} loading={loading} disabled={disabled || loading || !!error}
      isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={p => p.name}
      onChange={(_, people) => onChange(people)} renderInput={p => <TextField {...p} label="Resource Managers"
        helperText="Assign Resource Managers, Admins, or Board members to this shop without changing their roles." />} />
    <Tooltip describeChild title="To add a new RM, first change the member's role to RM">
      <Button size="small" sx={{ alignSelf: 'flex-start' }}>How to add a new RM</Button>
    </Tooltip>
  </Stack>;
}
