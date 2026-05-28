import * as React from "react";
import { useNavigate } from 'react-router-dom';
import { connect } from "react-redux";

import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";

import { Routing } from "app/constants";
import { emailValid } from "app/utils";

import { State as ReduxState, ScopedThunkDispatch } from "ui/reducer";
import { loginUserAction, firebaseLoginAction, totpLoginSuccessAction } from "ui/auth/actions";
import { Action as AuthAction } from "ui/auth/constants";
import { LoginFields, loginPrefix } from "ui/auth/constants";
import { AuthForm } from "ui/auth/interfaces";
import ErrorMessage from "ui/common/ErrorMessage";
import Form from "ui/common/Form";
import FormModal from "ui/common/FormModal";
import { requestPasswordReset, isApiErrorResponse } from "makerspace-ts-api-client";
import FirebaseAuthButtons from "ui/auth/FirebaseAuthButtons";
import TotpVerifyForm from "ui/auth/TotpVerifyForm";
import { signInWithGoogle, signInWithApple, signInWithGitHub, signInWithMicrosoft } from "ui/auth/firebase";

const formPrefix = "request-password-reset";
const passwordFields = {
  email: {
    label: "Email",
    name: `${formPrefix}-email`,
    placeholder: "Enter email address",
    error: "Invalid email",
    validate: (val: string) => emailValid(val)
  },
}

interface OwnProps {}
interface DispatchProps {
  loginUser: (authForm: AuthForm) => Promise<void>;
  firebaseLogin: (idToken: string) => Promise<void>;
  totpLoginSuccess: (member: any) => Promise<void>;
  pushLocation: (location: string) => void;
  clearTotpRequired: () => void;
}
interface StateProps {
  isRequesting: boolean;
  error: string;
  auth: boolean;
  currentUserId: string;
  totpRequired: boolean;
  totpEnrollmentRequired: boolean;
}
interface State {
  requestingPassword: boolean;
  passwordError: string;
  openPassword: boolean;
  email: string;
  firebaseLoading: boolean;
  firebaseError: string;
  totpLoading: boolean;
  totpError: string;
}
interface Props extends OwnProps, DispatchProps, StateProps {}

class LoginForm extends React.Component<Props, State> {
  private formRef: Form;
  private passwordRef: Form;
  private setFormRef = (ref: Form) => this.formRef = ref;
  private setPasswordRef = (ref: Form) => this.passwordRef = ref;

  constructor(props: Props) {
    super(props);
    this.state = {
      requestingPassword: false,
      openPassword: false,
      passwordError: "",
      email: "",
      firebaseLoading: false,
      firebaseError: "",
      totpLoading: false,
      totpError: "",
    }
  }

  public async componentDidMount() {
    const { auth, pushLocation } = this.props;
    if (auth) {
      pushLocation(Routing.Members);
    }

  }

  public componentDidUpdate(prevProps: Props) {
    const { isRequesting: wasRequesting } = prevProps;
    const { isRequesting, auth, error, pushLocation, totpEnrollmentRequired, currentUserId } = this.props;
    if (wasRequesting && !isRequesting && !error && auth && !totpEnrollmentRequired) {
      pushLocation(Routing.Members);
    }
    // Privileged member needs to enroll in TOTP — redirect to security settings
    if (totpEnrollmentRequired && !prevProps.totpEnrollmentRequired && auth) {
      pushLocation(`/members/${currentUserId}/settings/security`);
    }
  }

  private handleFirebaseSignIn = async (signInFn: () => Promise<void>) => {
    this.setState({ firebaseLoading: true, firebaseError: '' });
    try {
      // This redirects the browser to the provider — page will navigate away
      await signInFn();
    } catch (err) {
      const message = (err && (err as any).message) || 'Sign in failed. Please try again.';
      this.setState({ firebaseError: message, firebaseLoading: false });
    }
    // Note: firebaseLoading stays true until redirect — intentional
  };

  private handleGoogleSignIn    = () => this.handleFirebaseSignIn(signInWithGoogle);
  private handleAppleSignIn     = () => this.handleFirebaseSignIn(signInWithApple);
  private handleGitHubSignIn    = () => this.handleFirebaseSignIn(signInWithGitHub);
  private handleMicrosoftSignIn = () => this.handleFirebaseSignIn(signInWithMicrosoft);

  private submitTotpCode = async (code: string) => {
    this.setState({ totpLoading: true, totpError: '' });
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
        // Dispatch success through the existing firebase login path (takes raw member)
        await this.props.totpLoginSuccess(member);
      } else {
        const body = await res.json().catch(() => ({}));
        this.setState({ totpError: body?.error || 'Invalid code. Please try again.' });
      }
    } catch {
      this.setState({ totpError: 'An unexpected error occurred.' });
    } finally {
      this.setState({ totpLoading: false });
    }
  };

  private cancelTotp = () => {
    this.props.clearTotpRequired();
    this.setState({ totpError: '' });
  };

  private submitLogin = async (form: Form) => {
    const validAuth: AuthForm = await form.simpleValidate<AuthForm>(LoginFields);

    if (!form.isValid()) return;

    this.props.loginUser(validAuth);
  }

  private submitPasswordRequest = async (form: Form) => {
    const { email } = await form.simpleValidate<AuthForm>(passwordFields);

    if (!form.isValid()) return;

    this.setState({ requestingPassword: true}, async () => {
      const response = await requestPasswordReset({ body: { member: { email }} });
      if (isApiErrorResponse(response)) {
        this.setState({ requestingPassword: false, passwordError: response.error.message });
      } else {
        this.setState({ requestingPassword: false, passwordError: "", email });
      }
    });
  }

  private renderPasswordReset = () => {
    const { requestingPassword, passwordError, openPassword, email } = this.state;

    return (
      <FormModal
        formRef={this.setPasswordRef}
        id={formPrefix}
        isOpen={openPassword}
        loading={requestingPassword}
        title="Request Password Reset"
        onSubmit={!email && this.submitPasswordRequest}
        submitText="Submit"
        cancelText={email ? "Close" : "Cancel"}
        closeHandler={this.closePasswordReset}
      >
        { email ? (
          <Typography>Instructions to reset your password have been sent to {email}</Typography>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1">Please enter the email address associated with your account to receive an email with instructions to reset your password.</Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label={passwordFields.email.label}
                  name={passwordFields.email.name}
                  id={passwordFields.email.name}
                  placeholder={passwordFields.email.placeholder}
                  type="email"
                />
              </Grid>
            </Grid>
          )
        }

        {!requestingPassword && passwordError && <ErrorMessage id={`${formPrefix}-error`} error={passwordError}/>}
      </FormModal>
    )
  }

  private openPasswordReset = () => this.setState({ openPassword: true });
  private closePasswordReset = () => this.setState({ openPassword: false });

  public render(): JSX.Element {
    const { isRequesting, error, totpRequired } = this.props;
    const { totpLoading, totpError } = this.state;

    if (totpRequired) {
      return (
        <TotpVerifyForm
          onSubmit={this.submitTotpCode}
          onCancel={this.cancelTotp}
          isRequesting={totpLoading}
          error={totpError}
        />
      );
    }

    return (
      <>
        <Form
          ref={this.setFormRef}
          id={loginPrefix}
          loading={isRequesting}
          title="Please Sign In"
          onSubmit={this.submitLogin}
          submitText="Sign In"
        >
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                autoComplete="username"
                label={LoginFields.email.label}
                name={LoginFields.email.name}
                placeholder={LoginFields.email.placeholder}
                type="email"
              />
              <TextField
                fullWidth
                required
                autoComplete="current-password"
                label={LoginFields.password.label}
                name={LoginFields.password.name}
                placeholder={LoginFields.password.placeholder}
                type="password"
              />
            </Grid>
            <Grid item xs={12} style={{textAlign: "center"}}>
              <a id="forgot-password" href="#" onClick={this.openPasswordReset}>Forgot your password?</a>
            </Grid>
          </Grid>
          {error && <ErrorMessage id={`${loginPrefix}-error`} error={error}/>}
        </Form>
        {this.renderPasswordReset()}
        <FirebaseAuthButtons
          onGoogleSignIn={this.handleGoogleSignIn}
          onAppleSignIn={this.handleAppleSignIn}
          onGitHubSignIn={this.handleGitHubSignIn}
          onMicrosoftSignIn={this.handleMicrosoftSignIn}
          loading={this.state.firebaseLoading}
          error={this.state.firebaseError}
        />
      </>
    );
  }
}

const mapStateToProps = (
  state: ReduxState,
  _ownProps: OwnProps
): StateProps => {
  const { currentUser, isRequesting, error } = state.auth;

  return {
    isRequesting,
    error,
    auth: currentUser && !!currentUser.email,
    currentUserId: currentUser?.id,
    totpRequired: state.auth.totpRequired,
    totpEnrollmentRequired: state.auth.totpEnrollmentRequired,
  }
}

const mapDispatchToProps = (
  dispatch: ScopedThunkDispatch
): DispatchProps => {
  return {
    loginUser: (authForm) => dispatch(loginUserAction(authForm)),
    firebaseLogin: (idToken) => dispatch(firebaseLoginAction(idToken)),
    totpLoginSuccess: (member) => dispatch(totpLoginSuccessAction(member)),
    pushLocation: (location) => navigate(location),
    clearTotpRequired: () => dispatch({ type: AuthAction.ClearTotpRequired }),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(LoginForm);
