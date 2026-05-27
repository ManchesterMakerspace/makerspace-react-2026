import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

import { Routing } from 'app/constants';
import { emailValid } from 'app/utils';
import { State as ReduxState, ScopedThunkDispatch } from 'ui/reducer';
import { loginUserAction, firebaseLoginAction, totpLoginSuccessAction } from 'ui/auth/actions';
import { Action as AuthAction } from 'ui/auth/constants';
import { LoginFields, loginPrefix } from 'ui/auth/constants';
import { AuthForm } from 'ui/auth/interfaces';
import ErrorMessage from 'ui/common/ErrorMessage';
import Form from 'ui/common/Form';
import FormModal from 'ui/common/FormModal';
import { requestPasswordReset, isApiErrorResponse } from 'makerspace-ts-api-client';
import FirebaseAuthButtons from 'ui/auth/FirebaseAuthButtons';
import TotpVerifyForm from 'ui/auth/TotpVerifyForm';
import { signInWithGoogle, signInWithApple, signInWithGitHub, signInWithMicrosoft } from 'ui/auth/firebase';

const formPrefix = 'request-password-reset';
const passwordFields = {
  email: {
    label: 'Email',
    name: `${formPrefix}-email`,
    placeholder: 'Enter email address',
    error: 'Invalid email',
    validate: (val: string) => emailValid(val)
  },
};

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<ScopedThunkDispatch>();

  const { currentUser, isRequesting, error, totpRequired, totpEnrollmentRequired } = useSelector(
    (state: ReduxState) => state.auth
  );
  const auth = currentUser && !!currentUser.email;
  const currentUserId = currentUser?.id;

  const formRef = React.useRef<Form>(null);
  const passwordRef = React.useRef<Form>(null);

  const [requestingPassword, setRequestingPassword] = React.useState(false);
  const [openPassword, setOpenPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [firebaseLoading, setFirebaseLoading] = React.useState(false);
  const [firebaseError, setFirebaseError] = React.useState('');
  const [totpLoading, setTotpLoading] = React.useState(false);
  const [totpError, setTotpError] = React.useState('');

  React.useEffect(() => {
    if (auth) navigate(Routing.Members);
  }, []);

  const prevIsRequestingRef = React.useRef(isRequesting);
  React.useEffect(() => {
    const wasRequesting = prevIsRequestingRef.current;
    prevIsRequestingRef.current = isRequesting;
    if (wasRequesting && !isRequesting && !error && auth && !totpEnrollmentRequired) {
      navigate(Routing.Members);
    }
    if (totpEnrollmentRequired && auth && currentUserId) {
      navigate(`/members/${currentUserId}/settings/security`);
    }
  }, [isRequesting, auth, totpEnrollmentRequired]);

  const handleFirebaseSignIn = async (signInFn: () => Promise<void>) => {
    setFirebaseLoading(true);
    setFirebaseError('');
    try {
      await signInFn();
    } catch (err) {
      const msg = (err && (err as any).message) || 'Sign in failed. Please try again.';
      setFirebaseError(msg);
      setFirebaseLoading(false);
    }
  };

  const submitTotpCode = async (code: string) => {
    setTotpLoading(true);
    setTotpError('');
    try {
      const res = await fetch('/api/members/totp_sessions', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': (() => {
            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            return match ? decodeURIComponent(match[1]) : '';
          })(),
        },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const member = await res.json();
        await dispatch(totpLoginSuccessAction(member));
      } else {
        const body = await res.json().catch(() => ({}));
        setTotpError(body?.error || 'Invalid code. Please try again.');
      }
    } catch {
      setTotpError('An unexpected error occurred.');
    } finally {
      setTotpLoading(false);
    }
  };

  const cancelTotp = () => {
    dispatch({ type: AuthAction.ClearTotpRequired });
    setTotpError('');
  };

  const submitLogin = async (form: Form) => {
    const validAuth: AuthForm = await form.simpleValidate<AuthForm>(LoginFields);
    if (!form.isValid()) return;
    dispatch(loginUserAction(validAuth));
  };

  const submitPasswordRequest = async (form: Form) => {
    const { email: emailVal } = await form.simpleValidate<AuthForm>(passwordFields);
    if (!form.isValid()) return;
    setRequestingPassword(true);
    const response = await requestPasswordReset({ body: { member: { email: emailVal } } });
    if (isApiErrorResponse(response)) {
      setRequestingPassword(false);
      setPasswordError(response.error.message);
    } else {
      setRequestingPassword(false);
      setPasswordError('');
      setEmail(emailVal);
    }
  };

  if (totpRequired) {
    return (
      <TotpVerifyForm
        onSubmit={submitTotpCode}
        onCancel={cancelTotp}
        isRequesting={totpLoading}
        error={totpError}
      />
    );
  }

  return (
    <>
      <Form
        ref={formRef}
        id={loginPrefix}
        loading={isRequesting}
        title="Please Sign In"
        onSubmit={submitLogin}
        submitText="Sign In"
      >
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth required autoComplete="username"
              label={LoginFields.email.label}
              name={LoginFields.email.name}
              placeholder={LoginFields.email.placeholder}
              type="email"
            />
            <TextField
              fullWidth required autoComplete="current-password"
              label={LoginFields.password.label}
              name={LoginFields.password.name}
              placeholder={LoginFields.password.placeholder}
              type="password"
            />
          </Grid>
          <Grid item xs={12} style={{ textAlign: 'center' }}>
            <a id="forgot-password" href="#" onClick={(e) => { e.preventDefault(); setOpenPassword(true); }}>
              Forgot your password?
            </a>
          </Grid>
        </Grid>
        {error && <ErrorMessage id={`${loginPrefix}-error`} error={error} />}
      </Form>

      <FormModal
        formRef={(ref) => { (passwordRef as any).current = ref; }}
        id={formPrefix}
        isOpen={openPassword}
        loading={requestingPassword}
        title="Request Password Reset"
        onSubmit={!email ? submitPasswordRequest : undefined}
        submitText="Submit"
        cancelText={email ? 'Close' : 'Cancel'}
        closeHandler={() => setOpenPassword(false)}
      >
        {email ? (
          <Typography>Instructions to reset your password have been sent to {email}</Typography>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body1">
                Please enter the email address associated with your account to receive an email with instructions to reset your password.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth required
                label={passwordFields.email.label}
                name={passwordFields.email.name}
                id={passwordFields.email.name}
                placeholder={passwordFields.email.placeholder}
                type="email"
              />
            </Grid>
          </Grid>
        )}
        {!requestingPassword && passwordError && (
          <ErrorMessage id={`${formPrefix}-error`} error={passwordError} />
        )}
      </FormModal>

      <FirebaseAuthButtons
        onGoogleSignIn={() => handleFirebaseSignIn(signInWithGoogle)}
        onAppleSignIn={() => handleFirebaseSignIn(signInWithApple)}
        onGitHubSignIn={() => handleFirebaseSignIn(signInWithGitHub)}
        onMicrosoftSignIn={() => handleFirebaseSignIn(signInWithMicrosoft)}
        loading={firebaseLoading}
        error={firebaseError}
      />
    </>
  );
};

export default LoginForm;
