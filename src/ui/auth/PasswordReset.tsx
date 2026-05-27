import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import RemoveRedEye from '@mui/icons-material/RemoveRedEye';
import Typography from '@mui/material/Typography';

import { Routing } from 'app/constants';
import Form, { FormFields } from 'ui/common/Form';
import ErrorMessage from 'ui/common/ErrorMessage';
import { ScopedThunkDispatch } from 'ui/reducer';
import { loginUserAction } from 'ui/auth/actions';
import { resetPassword, isApiErrorResponse, message } from 'makerspace-ts-api-client';

const passwordId = 'password-reset';
const passwordFields: FormFields = {
  password: {
    label: 'Enter New Password',
    name: `${passwordId}-input`,
    placeholder: 'Enter New Password',
    error: 'Invalid password',
    validate: (val: string) => !!val
  }
};
interface PasswordForm { password: string; }

const scorePassword = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};
const strengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['#f44336', '#ff9800', '#ffeb3b', '#8bc34a', '#4caf50'];

const PasswordReset: React.FC = () => {
  const { token: passwordToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<ScopedThunkDispatch>();

  const formRef = React.useRef<Form>(null);
  const [passwordMask, setPasswordMask] = React.useState(true);
  const [passwordError, setPasswordError] = React.useState<string>();
  const [passwordRequesting, setPasswordRequesting] = React.useState(false);
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    if (!passwordToken) {
      navigate(Routing.Root);
    }
  }, []);

  const togglePasswordMask = () => setPasswordMask(m => !m);

  const submit = async (form: Form) => {
    const { password: pw } = await formRef.current?.simpleValidate<PasswordForm>(passwordFields) || {};
    if (!form.isValid()) return;
    const strength = scorePassword(password);
    if (strength < 2) {
      setPasswordError('Password is too weak. Try mixing uppercase, numbers, or symbols.');
      return;
    }
    setPasswordRequesting(true);
    try {
      const passwordReset = await resetPassword({ body: { member: { resetPasswordToken: passwordToken, password: pw } } });
      if (isApiErrorResponse(passwordReset)) {
        const error = passwordReset.error.message;
        const deviseErrors = (passwordReset.error as any).errors;
        const pwError = error || (deviseErrors && Object.entries(deviseErrors).map(([f, e]) => `${f} ${e}`).join('. '));
        setPasswordRequesting(false);
        setPasswordError(pwError);
      } else {
        await dispatch(await loginUserAction());
        setPasswordRequesting(false);
      }
    } catch (e) {
      message({ body: { message: JSON.stringify(e) } });
    }
  };

  const strength = scorePassword(password);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid item xs={12} md={6}>
        <Paper style={{ minWidth: 275, padding: '1rem' }}>
          <Form
            ref={formRef}
            id={passwordId}
            title="Reset Password"
            onSubmit={submit}
            loading={passwordRequesting}
            submitText="Save"
          >
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1">Please enter your new password.</Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth required
                  autoComplete="new-password"
                  label={passwordFields.password.label}
                  name={passwordFields.password.name}
                  id={passwordFields.password.name}
                  placeholder={passwordFields.password.placeholder}
                  type={passwordMask ? 'password' : 'text'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <RemoveRedEye style={{ cursor: 'pointer' }} onClick={togglePasswordMask} />
                      </InputAdornment>
                    )
                  }}
                />
                {password && (
                  <>
                    <LinearProgress
                      variant="determinate"
                      value={(strength / 4) * 100}
                      style={{ marginTop: 8, backgroundColor: '#e0e0e0' }}
                    />
                    <span style={{ color: strengthColor[strength], marginTop: 4, display: 'block', fontSize: '0.75rem' }}>
                      {strengthLabel[strength]}
                    </span>
                  </>
                )}
              </Grid>
            </Grid>
            {!passwordRequesting && passwordError && (
              <ErrorMessage id="password-reset-error" error={passwordError} />
            )}
          </Form>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default PasswordReset;
