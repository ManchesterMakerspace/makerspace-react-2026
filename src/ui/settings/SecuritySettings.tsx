import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import ErrorMessage from 'ui/common/ErrorMessage';
import ChangePasswordForm from 'ui/member/ChangePasswordForm';
import { useAuthState } from 'ui/reducer/hooks';
import { useDispatch } from 'react-redux';
import { Action as AuthAction } from 'ui/auth/constants';

type EnrollStep = 'idle' | 'qr' | 'verify' | 'done';

const getCsrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const apiCall = async (method: string, path: string, body?: object) => {
  return fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': getCsrfToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
};

const TotpSection: React.FC<{ memberId: string; initialEnabled: boolean; onEnrollmentComplete?: () => void }> = ({ memberId, initialEnabled, onEnrollmentComplete }) => {
  const [enabled, setEnabled]     = React.useState(initialEnabled);
  const [step, setStep]           = React.useState<EnrollStep>('idle');
  const [qrSvg, setQrSvg]         = React.useState('');
  const [secret, setSecret]       = React.useState('');
  const [code, setCode]           = React.useState('');
  const [loading, setLoading]     = React.useState(false);
  const [error, setError]         = React.useState('');

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiCall('POST', '/api/members/totp/setup');
      if (res.ok) {
        const data = await res.json();
        setQrSvg(data.qr_code);
        setSecret(data.secret);
        setStep('qr');
      } else {
        setError('Failed to start setup. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiCall('POST', '/api/members/totp/verify', { code });
      if (res.ok) {
        setEnabled(true);
        setStep('done');
        setCode('');
        // Clear the enrollment requirement from Redux so App.tsx stops redirecting here
        if (onEnrollmentComplete) {
          onEnrollmentComplete();
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || 'Invalid code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const disableTotp = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiCall('DELETE', '/api/members/totp');
      if (res.ok) {
        setEnabled(false);
        setStep('idle');
      } else {
        setError('Failed to disable 2FA. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LockIcon color='primary' />
          <Typography variant='h6'>Two-Factor Authentication (TOTP)</Typography>
          {enabled && (
            <Chip
              label='Enabled'
              size='small'
              icon={<CheckCircleIcon />}
              style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
            />
          )}
        </div>
        <Typography variant='body2' color='textSecondary' style={{ marginTop: 4 }}>
          Use an authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
          to generate one-time codes for login.
        </Typography>
      </Grid>

      {error && (
        <Grid item xs={12}>
          <ErrorMessage id='totp-error' error={error} />
        </Grid>
      )}

      {/* Idle — not enrolled */}
      {!enabled && step === 'idle' && (
        <Grid item xs={12}>
          <Button
            id='totp-setup-start'
            variant='contained'
            color='primary'
            disabled={loading}
            onClick={startSetup}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            Enable Two-Factor Authentication
          </Button>
        </Grid>
      )}

      {/* Step 1 — show QR code */}
      {step === 'qr' && (
        <>
          <Grid item xs={12}>
            <Typography variant='body1' gutterBottom>
              <strong>Step 1:</strong> Scan this QR code with your authenticator app.
            </Typography>
            <div
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              style={{ display: 'inline-block', border: '1px solid #ddd', padding: 8, borderRadius: 4 }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant='body2' color='textSecondary' gutterBottom>
              Can't scan? Enter this key manually:
            </Typography>
            <Typography
              variant='body2'
              style={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'inline-block', letterSpacing: '0.15em' }}
            >
              {secret}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant='body1' gutterBottom>
              <strong>Step 2:</strong> Enter the 6-digit code shown in your app to confirm.
            </Typography>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TextField
                id='totp-verify-code'
                label='Authentication Code'
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6, style: { textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.3em' } }}
                style={{ width: 180 }}
                autoComplete='one-time-code'
              />
              <Button
                id='totp-verify-submit'
                variant='contained'
                color='primary'
                disabled={loading || code.length !== 6}
                onClick={verifyCode}
              >
                {loading ? <CircularProgress size={20} /> : 'Confirm'}
              </Button>
              <Button variant='outlined' onClick={() => { setStep('idle'); setCode(''); setError(''); }}>
                Cancel
              </Button>
            </div>
          </Grid>
        </>
      )}

      {/* Done — successfully enrolled */}
      {step === 'done' && (
        <Grid item xs={12}>
          <Typography variant='body1' style={{ color: '#2e7d32' }}>
            ✓ Two-factor authentication has been enabled on your account.
          </Typography>
        </Grid>
      )}

      {/* Already enabled — offer disable */}
      {enabled && step !== 'done' && (
        <Grid item xs={12}>
          <Typography variant='body2' color='textSecondary' style={{ marginBottom: 8 }}>
            Two-factor authentication is active on your account. You will be prompted for a code each time you log in.
          </Typography>
          <Button
            id='totp-disable'
            variant='outlined'
            color='secondary'
            disabled={loading}
            onClick={disableTotp}
          >
            Disable Two-Factor Authentication
          </Button>
        </Grid>
      )}
    </Grid>
  );
};

interface Props {
  memberId: string;
  memberEmail?: string;
}

const SecuritySettings: React.FC<Props> = ({ memberId, memberEmail }) => {
  const { currentUser, totpEnrollmentRequired } = useAuthState() as any;
  const totpEnabled = !!(currentUser as any).totpEnabled;
  const dispatch = useDispatch();

  const onEnrollmentComplete = React.useCallback(() => {
    dispatch({ type: AuthAction.ClearEnrollmentRequired });
    // Redirect to their profile now that enrollment is done
    navigate(`/members/${memberId}`);
  }, [dispatch, memberId]);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        {totpEnrollmentRequired && (
          <div style={{ padding: '12px 16px', marginBottom: 16, backgroundColor: '#fff3e0', borderLeft: '4px solid #ff9800', borderRadius: 4 }}>
            <Typography variant='body2' style={{ color: '#e65100' }}>
              <strong>Action required:</strong> Two-factor authentication is required for your account. Please set it up below before continuing.
            </Typography>
          </div>
        )}
        <TotpSection memberId={memberId} initialEnabled={totpEnabled} onEnrollmentComplete={onEnrollmentComplete} />
      </Grid>
      <Grid item xs={12}>
        <Divider />
      </Grid>
      <Grid item xs={12}>
        <ChangePasswordForm memberId={memberId} memberEmail={memberEmail} />
      </Grid>
    </Grid>
  );
};

export default SecuritySettings;
