import * as React from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Grid from "@mui/material/Grid2";
import CircularProgress from '@mui/material/CircularProgress';
import ErrorMessage from 'ui/common/ErrorMessage';

interface Props {
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
  isRequesting: boolean;
  error: string;
}

const TotpVerifyForm: React.FC<Props> = ({ onSubmit, onCancel, isRequesting, error }) => {
  const [code, setCode] = React.useState('');

  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      await onSubmit(code.trim());
    }
  }, [code, onSubmit]);

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 6
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }} style={{ textAlign: 'center' }}>
          <Typography variant='h6' gutterBottom>
            Two-Factor Authentication
          </Typography>
          <Typography variant='body2' color='textSecondary'>
            Enter the 6-digit code from your authenticator app.
          </Typography>
        </Grid>

        <Grid size={{ xs: 12 }} style={{ display: 'flex', justifyContent: 'center' }}>
          <TextField
            id='totp-code-input'
            label='Authentication Code'
            value={code}
            onChange={handleChange}
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9]*',
              maxLength: 6,
              style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em' }
            }}
            style={{ width: 200 }}
            autoFocus
            autoComplete='one-time-code'
          />
        </Grid>

        {error && (
          <Grid size={{ xs: 12 }}>
            <ErrorMessage id='totp-error' error={error} />
          </Grid>
        )}

        <Grid size={{ xs: 12 }} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            id='totp-cancel'
            variant='outlined'
            onClick={onCancel}
            disabled={isRequesting}
          >
            Back
          </Button>
          <Button
            id='totp-submit'
            type='submit'
            variant='contained'
            color='primary'
            disabled={isRequesting || code.length !== 6}
          >
            {isRequesting ? <CircularProgress size={20} /> : 'Verify'}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
};

export default TotpVerifyForm;
