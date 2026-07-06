// @ts-nocheck
import * as React from "react";
import { useNavigate } from 'react-router-dom';
import { connect } from "react-redux";
import { RouteComponentProps } from "react-router-dom";

import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import Typography from "@mui/material/Typography";

import { Routing } from "app/constants";
import Form, { FormFields } from "ui/common/Form";
import ErrorMessage from "ui/common/ErrorMessage";
import { ScopedThunkDispatch } from "ui/reducer";
import { loginUserAction } from "ui/auth/actions";
import { resetPassword, isApiErrorResponse, message } from "makerspace-ts-api-client";
import { PasswordStrength, validatePasswordStrength } from "components/Form/inputs/PasswordStrength";

interface DispatchProps {
  attemptLogin: () => void;
  goToRoot: () => void;
}
interface StateProps {}
interface OwnProps extends RouteComponentProps<{ token: string }> {}
interface Props extends OwnProps, StateProps, DispatchProps {}

interface State {
  passwordMask: boolean;
  passwordRequesting: boolean;
  passwordError: string;
  password: string;
}

const passwordId = "password-reset";
const passwordFields: FormFields = {
  password: {
    label: "Enter New Password",
    name: `${passwordId}-input`,
    placeholder: "Enter New Password",
    error: "Invalid password",
    validate: (val: string) => !!val
  }
}
interface PasswordForm {
  password: string;
}

class PasswordReset extends React.Component<Props, State> {
  public formRef: Form;
  private setFormRef = (ref: Form) => this.formRef = ref;

  constructor(props: Props) {
    super(props);
    this.state = {
      passwordMask: true,
      passwordError: undefined,
      passwordRequesting: false,
      password: "",
    };
  }

  public componentDidMount() {
    const { goToRoot } = this.props;
    const { token: passwordToken } = this.props.match.params;
    if (!passwordToken) {
      goToRoot();
    }
  }

  private togglePasswordMask = () => {
    this.setState((state) => ({ passwordMask: !state.passwordMask }));
  }

  private handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ password: event.target.value });
  }

  private submit = async (form: Form) => {
    const { password } = await this.formRef.simpleValidate<PasswordForm>(passwordFields);
    const { token: passwordToken } = this.props.match.params;

    if (!form.isValid()) return;

    const passwordError = validatePasswordStrength(this.state.password);
    if (passwordError) {
      this.setState({ passwordError });
      return;
    }

    this.setState({ passwordRequesting: true });
    try {
      const passwordReset = await resetPassword({ body: { member: { resetPasswordToken: passwordToken, password } } });
      if (isApiErrorResponse(passwordReset)) {
        const error = passwordReset.error.message;
        const deviseErrors = (passwordReset.error as any).errors;
        const passwordError = error || (deviseErrors && Object.entries(deviseErrors).map(([field, error]) => `${field} ${error}`).join(". "))
        this.setState({ passwordRequesting: false, passwordError });
      } else {
        await this.props.attemptLogin();
        this.setState({ passwordRequesting: false });
      }
    } catch (e) {
      message({ body: { message: JSON.stringify(e) }})
      console.error("ERR", e);
    }
  }

  public render(): JSX.Element {
    const { passwordMask, passwordError, passwordRequesting, password } = this.state;

    return (
      <Grid container spacing={3} justifyContent="center">
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper style={{ minWidth: 275, padding: "1rem" }}>
              <Form
                ref={this.setFormRef}
                id={passwordId}
                title="Reset Password"
                onSubmit={this.submit}
                loading={passwordRequesting}
                submitText="Save"
              >
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body1">Please enter your new password.</Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      required
                      autoComplete="new-password"
                      label={passwordFields.password.label}
                      name={passwordFields.password.name}
                      id={passwordFields.password.name}
                      placeholder={passwordFields.password.placeholder}
                      type={passwordMask ? "password" : "text"}
                      value={password}
                      onChange={this.handlePasswordChange}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <RemoveRedEye style={{ cursor: "pointer" }} onClick={this.togglePasswordMask} />
                            </InputAdornment>
                          )
                        }
                      }}
                    />
                    <PasswordStrength password={password} />
                  </Grid>
                </Grid>
                {!passwordRequesting && passwordError && (
                  <ErrorMessage id={"password-reset-error"} error={passwordError} />
                )}
              </Form>
          </Paper>
        </Grid>
      </Grid>
    );
  }
}

const mapDispatchToProps = (
  dispatch: ScopedThunkDispatch
): DispatchProps => {
  return {
    attemptLogin: async () => dispatch(await loginUserAction()),
    goToRoot: () => navigate(Routing.Root)
  };
}

export default connect(null, mapDispatchToProps)(PasswordReset);
