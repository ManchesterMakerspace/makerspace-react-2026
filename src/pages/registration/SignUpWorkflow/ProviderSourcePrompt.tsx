import * as React from 'react';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import { SignupSourceQuestion } from 'ui/member/SignupSourceQuestion';
import { saveSignupSource, sourcePayload } from 'api/eventbrite';
import { Action } from 'ui/auth/constants';
import { useAuthState } from 'ui/reducer/hooks';

export function ProviderSourcePrompt() {
  const [value, setValue] = React.useState('');
  const [detail, setDetail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const dispatch = useDispatch<any>();
  const { permissions } = useAuthState();
  const save = async (skip = false) => {
    setBusy(true); setError('');
    try {
      const member = await saveSignupSource(sourcePayload(skip ? '' : value, detail));
      dispatch({ type: Action.AuthUserSuccess, data: { member, permissions } });
    }
    catch { setError('Could not save your answer. Refresh event choices, try another answer, or skip.'); }
    finally { setBusy(false); }
  };
  return <Paper sx={{ maxWidth: 650, mx: 'auto', p: 2 }}><Stack spacing={2}>
    <Typography variant="h5">Welcome to the makerspace</Typography>
    <SignupSourceQuestion value={value} detail={detail} onChange={setValue} onDetail={setDetail} />
    {error && <Alert severity="error">{error}</Alert>}
    <Button variant="contained" disabled={busy} onClick={() => save()}>Continue</Button>
    <Button disabled={busy} onClick={() => save(true)}>Skip this question</Button>
  </Stack></Paper>;
}
