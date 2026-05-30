import * as React from "react";
import { useNavigate } from 'react-router-dom';
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { useDispatch } from "react-redux";

import { Routing } from "app/constants";
import { SignUpFields, EmailExistsError, signUpPrefix, Action } from "ui/auth/constants";
import { submitSignUpAction } from "ui/auth/actions";
import { SignUpForm } from "ui/auth/interfaces";
import FormModal from "ui/common/FormModal";
import useModal from "ui/hooks/useModal";
import { states } from "ui/member/states";
import { useSearchQuery } from "hooks/useSearchQuery";
import { discountParam, invoiceOptionParam } from "../MembershipOptions";
import { TextInput } from "components/Form/inputs/TextInput";
import { EmailInput } from "components/Form/inputs/EmailInput";
import { PasswordInput } from "components/Form/inputs/PasswordInput";
import { SelectInput } from "components/Form/inputs/SelectInput";
import { PhoneInput } from "components/Form/inputs/PhoneInput";
import { Form } from "components/Form/Form";
import { FormState, useFormValues } from "components/Form/FormContext";
import { CollectionOf } from "app/interfaces";
import { useAuthState } from "ui/reducer/hooks";

// Confirm email field that validates against the email field value
const ConfirmEmailField: React.FC = () => {
  const values = useFormValues();
  const emailValue = values[SignUpFields.email.name] as string;
  return (
    <EmailInput
      required={true}
      label={SignUpFields.confirmEmail.label}
      fieldName={SignUpFields.confirmEmail.name}
      placeholder={SignUpFields.confirmEmail.placeholder}
      validate={(val: string) => {
        if (!val) return "Required";
        if (val !== emailValue) return "Email addresses do not match";
        return undefined;
      }}
    />
  );
};

export const MemberInfoStep: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isOpen: emailNoteOpen, openModal: openEmailNote, closeModal: closeEmailNote } = useModal();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const goToLogin = React.useCallback(() => navigate(Routing.Login), [history]);
  
  const { isRequesting, error } = useAuthState();

  const { membershipOptionId, discountId } = useSearchQuery({
    membershipOptionId: invoiceOptionParam, 
    discountId: discountParam, 
  })

  const submit = React.useCallback(async ({ values }: FormState) => {
    const validSignUp = Object.entries(SignUpFields).reduce((vals, [key, { name, transform }]) => ({
      ...vals,
      [key]: transform ? transform(values[name]) : values[name]
    }), {} as CollectionOf<string>);

    const { street, unit, city, state, postalCode, ...rest } = validSignUp;

    await dispatch(submitSignUpAction({
      ...rest as SignUpForm,
      address: {
        street,
        unit,
        city,
        state,
        postalCode
      }
    }));
  }, [membershipOptionId, discountId, dispatch, submitSignUpAction]);

  React.useEffect(() => {
    if (!isRequesting && error?.match(new RegExp(EmailExistsError))) {
      openEmailNote();
    }
  }, [openEmailNote, isRequesting, error]);

  return (
    <>
    <Grid container justifyContent="center" spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Paper style={{ minWidth: 275, padding: "1rem" }}>
          <Form
            id={signUpPrefix}
            loading={isRequesting}
            error={error}
            title="Create an Account"
            onSubmit={submit}
            hideFooter={true}
          >
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body1">
                  To create an account, first enter your email address and select a password for your Makerspace account.
                  All members are required to provide a street address, and should bring a government ID with matching address whn you visit to activate your membership and rceive your kyfob. 
                  We do not sell any of your personal information.
                </Typography>
              </Grid>

              {/* Name */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextInput
                  required={true}
                  label={SignUpFields.firstname.label}
                  fieldName={SignUpFields.firstname.name}
                  placeholder={SignUpFields.firstname.placeholder}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextInput
                  required={true}
                  label={SignUpFields.lastname.label}
                  fieldName={SignUpFields.lastname.name}
                  placeholder={SignUpFields.lastname.placeholder}
                />
              </Grid>

              {/* Address */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextInput
                  required={true}
                  label={SignUpFields.street.label}
                  fieldName={SignUpFields.street.name}
                  placeholder={SignUpFields.street.placeholder}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextInput
                  label={SignUpFields.unit.label}
                  fieldName={SignUpFields.unit.name}
                  placeholder={SignUpFields.unit.placeholder}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextInput
                  required={true}
                  label={SignUpFields.city.label}
                  fieldName={SignUpFields.city.name}
                  placeholder={SignUpFields.city.placeholder}
                />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <SelectInput
                  required={true}
                  fieldName={SignUpFields.state.name}
                  label={SignUpFields.state.label}
                  placeholder={SignUpFields.state.placeholder}
                  defaultValue="NH"
                  options={[
                    {
                      label: SignUpFields.state.placeholder,
                      value: "",
                      disabled: true
                    },
                    ...Object.keys(states).map(usState => ({
                      label: usState,
                      value: usState
                    }))
                  ]}
                />
              </Grid>
              <Grid size={{ xs: 8, sm: 4 }}>
                <TextInput
                  required={true}
                  label={SignUpFields.postalCode.label}
                  fieldName={SignUpFields.postalCode.name}
                  placeholder={SignUpFields.postalCode.placeholder}
                />
              </Grid>

              {/* Phone */}
              <Grid size={{ xs: 12 }}>
                <PhoneInput
                  label={SignUpFields.phone.label}
                  fieldName={SignUpFields.phone.name}
                  placeholder={SignUpFields.phone.placeholder}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <EmailInput
                  required={true}
                  label={SignUpFields.email.label}
                  fieldName={SignUpFields.email.name}
                  placeholder={SignUpFields.email.placeholder}
                />
                <br>If this email is associated with a Google or Github account, you can switch to federated login at any time after activation.</br>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ConfirmEmailField />
              </Grid>

              {/* Password */}
              <Grid size={{ xs: 12 }}>
                <PasswordInput 
                  label={SignUpFields.password.label}
                  placeholder={SignUpFields.password.placeholder}
                  fieldName={SignUpFields.password.name}
                  validate={SignUpFields.password.validate}
                />
              </Grid>
            </Grid>
            <>{children}</>
          </Form>
        </Paper>
      </Grid>
    </Grid>
    {emailNoteOpen && (
      <FormModal
        isOpen={true}
        id="email-exists"
        title="Email already exists"
        onSubmit={goToLogin}
        submitText="Login"
        closeHandler={closeEmailNote}
      >
        An account with this email already exists.  Please login to continue.
      </FormModal>
    )}
    </>
  );
};
