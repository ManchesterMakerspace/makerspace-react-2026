import * as React from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { SignupEvent, signupEvents, eventLabel } from 'api/eventbrite';
import { signupSourceOptions, signupSourceDetailPrompt } from './signupSources';

export const SignupSourceQuestion: React.FC<{
  value: string; detail: string; onChange: (value: string) => void; onDetail: (value: string) => void;
  savedEvent?: SignupEvent;
}> = ({ value, detail, onChange, onDetail, savedEvent }) => {
  const [events, setEvents] = React.useState<SignupEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [revision, reload] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    signupEvents().then(data => { if (active) setEvents(data); }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const prompt = signupSourceDetailPrompt(value);
  const choices = savedEvent && !events.some(e => e.id === savedEvent.id) ? [savedEvent, ...events] : events;
  return <Stack spacing={1}>
    <TextField select fullWidth label="How did you hear about us? (optional)" value={value || ''} onChange={e => onChange(e.target.value)}>
      <MenuItem value="">Skip this question</MenuItem>
      {choices.map(event => <MenuItem sx={{ whiteSpace: 'normal' }} key={event.id} value={`event:${event.id}`}>{eventLabel(event)}</MenuItem>)}
      {signupSourceOptions('').filter(option => option.value).map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </TextField>
    {loading && <Typography role="status" variant="body2">Loading events…</Typography>}
    {error && <Alert severity="warning" action={<Button onClick={reload}>Retry</Button>}>Events could not be loaded. You can choose another answer or skip.</Alert>}
    {!loading && !error && <Button size="small" onClick={reload}>Refresh event choices</Button>}
    {prompt && <TextField fullWidth label={prompt.signupLabel} value={detail || ''} onChange={e => onDetail(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />}
  </Stack>;
};
