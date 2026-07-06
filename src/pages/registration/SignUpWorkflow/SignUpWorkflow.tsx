// @ts-nocheck
// MemberForm. Creates member on submit, logs in and proceeds to agreement step
// Agreement step shows collapsed code of conduct and visible member agreement and requires checkbox + esign. proceeds to selecting a membership option
// MembershipSelect has 2 columns: Membership Select (select component) | discount (code or checkbox) - Can 10% discount be a standard resource we can query?
//      - Maybe we should make a "DiscountCode" model that would map the 10% discount (name, amount, amount type (percent or dollars), requirement statement)
//      - Need to verify we can add these post subscription creation.
//      - We can fake it for now... A specific code === 10% discount?
// MembershipSelect proceeds to payment method. Select the method, Acknowledge subscription and payment method if applicable
// ReviewStep is last that goes over everything, allows to return to membership and payment step to change selection
// On submit success, redirect to member profile page with dialog saying what the page is and add a toast w/ a link to the receipt.

import * as React from "react";
import { useNavigate } from 'react-router-dom';
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import Button from "@mui/material/Button";
import StepLabel from "@mui/material/StepLabel";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import MobileStepper from "@mui/material/MobileStepper";
import { useTheme } from "@mui/material/styles";

import { isApiErrorResponse, Member, message } from "makerspace-ts-api-client";
import { AgreementStep } from "./AgreementStep";
import { MemberInfoStep } from "./MemberInfoStep";
import { MembershipSelectStep } from "./MembershipSelectStep";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";
import { BeforeLeave, SignUpContextProvider, useAllowLeave } from "./SignUpContext";
import { useFormContext } from "components/Form/FormContext";
import { useSearchQuery } from "hooks/useSearchQuery";
import { paymentMethodQueryParam } from "../PaymentMethods";
import { useAuthState } from "ui/reducer/hooks";
import { ToastStatus, useToastContext } from "components/Toast/Toast";
import { Routing } from "app/constants";
import { buildNewMemberProfileRoute, buildProfileRouting } from "ui/member/utils";
import Link from "@mui/material/Link";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { invoiceOptionParam, noneInvoiceOption } from "../MembershipOptions/constants";

interface Step {
  label: string;
  component?: React.ComponentType;
}

const getSteps = (requiresPayment: boolean = true): Step[] => [
  {
    label: "Basic Info",
    component: MemberInfoStep
  },
  {
    label: "Agreements",
    component: AgreementStep
  },
  {
    label: "Membership",
    component: MembershipSelectStep
  },
  ...requiresPayment ? [
    {
      label: "Payment",
      component: PaymentStep
    },
    {
      label: "Review",
      component: ReviewStep
    }
  ] : [],
];

export const SignUpWorkflow: React.FC = () => {
  const { currentUser, isRequesting } = useAuthState();
  const { current: authLoadingOnMount } = React.useRef(isRequesting);
  const { current: isNewMember } = React.useRef(!currentUser.memberContractOnFile);

  const {
    invoiceOptionId: invoiceOptionIdParam,
    paymentMethodId: paymentMethodIdParam
  } = useSearchQuery({
    invoiceOptionId: invoiceOptionParam,
    paymentMethodId: paymentMethodQueryParam
  });

  const skipPaymentSteps = invoiceOptionIdParam === noneInvoiceOption.id;
  const steps = getSteps(!skipPaymentSteps);
  const stepOrder = steps.map(step => step.component);

  const determineStartStep = React.useCallback((): number => {
    if (currentUser?.id) {
      const { memberContractOnFile } = currentUser
      if (!memberContractOnFile) return stepOrder.indexOf(AgreementStep);
      if (!invoiceOptionIdParam) return stepOrder.indexOf(MembershipSelectStep);
      if (!paymentMethodIdParam) return stepOrder.indexOf(PaymentStep);

      return stepOrder.indexOf(ReviewStep);
    }

    return 0;
  }, [currentUser, invoiceOptionIdParam, paymentMethodIdParam, stepOrder]);

  const [activeStep, setActiveStep] = React.useState(determineStartStep());

  React.useEffect(() => {
    if (activeStep < 0 || activeStep > stepOrder.length - 1) {
      navigate(buildNewMemberProfileRoute(currentUser?.id));
    }
  }, [activeStep]);

  const navigate = useNavigate();
  const { create } = useToastContext();
  React.useEffect(() => {
    if (authLoadingOnMount && currentUser?.id) {
      const { subscriptionId } = currentUser;
      const url = isNewMember ? buildNewMemberProfileRoute(currentUser.id) : buildProfileRouting(currentUser.id);
      // Redirect to profile with a notification if they already have a membership
      if (subscriptionId) {
        create({
          status: ToastStatus.Info,
          message: (
            <>
              <Typography component="span" variant="body1">Membership already exists</Typography>
              <Link
                style={{ marginLeft: "1em" }}
                href={Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUser.id)}
              >
                <Typography component="span" variant="body1">Manage Membership</Typography>
              </Link>
            </>
          )
        })
        navigate(url);
      } else {
        // Move past member info step if started workflow and already auth'd
        setActiveStep(determineStartStep());
      }
    }
  }, [currentUser, determineStartStep, isNewMember]);

  const onNext = React.useCallback(async (allowLeave: BeforeLeave) => {
    if (allowLeave && !(await allowLeave())) {
      return;
    }
    setActiveStep(curr => curr + 1);
  }, [setActiveStep]);

  const onBack = React.useCallback(async () => {
    setActiveStep(curr => curr - 1);
  }, [setActiveStep]);

  const theme = useTheme();
  const isSmallMedia = useMediaQuery(theme.breakpoints.down("sm"));
  // Can only edit membership and payment method steps
  const isSignUpEditable = activeStep > stepOrder.indexOf(AgreementStep);

  const currentStep = steps[activeStep];
  if (!currentStep) {
    return null;
  }

  const { component: Component } = currentStep;

  const disableBack = activeStep <= stepOrder.indexOf(MembershipSelectStep);
  const nextLabel = activeStep === stepOrder.indexOf(ReviewStep) ? "Submit Payment" :
                    (activeStep === stepOrder.length - 1 ? "Submit" : "Next");
  return (
    <SignUpContextProvider setActiveStep={setActiveStep}>
        {({ allowLeave, nextDisabled, prevDisabled }) => (
          <Grid container justifyContent="center" spacing={2}>
            <Grid size={{ xs: 12, sm: 10 }}>
              {isSmallMedia ? (
                <MobileStepper
                variant="dots"
                steps={steps.length}
                position="static"
                activeStep={activeStep}
                nextButton={<span />}
                backButton={<span />}
              />
            ) : (
              <Stepper activeStep={activeStep} alternativeLabel>
                {steps.map(({ label }) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            )}

            </Grid>

            <Grid size={{ xs: 12, md: 10 }}>
              <Component><NestedLeave/></Component>
            </Grid>


            <Grid size={{ xs: 12, md: 10 }}>
              <Stack
                direction={{ xs: "column-reverse", sm: "row" }}
                justifyContent="flex-end"
                alignItems={{ xs: "stretch", sm: "center" }}
                spacing={2}
                sx={{ mt: 2, mb: { xs: 3, sm: 0 } }}
              >
                {isSignUpEditable && (
                  <Button
                    disabled={prevDisabled ?? disableBack}
                    variant="contained"
                    onClick={onBack}
                    id="sign-up-back"
                  >
                    Back
                  </Button>
                )}
                <Button
                  disabled={nextDisabled ?? activeStep === 5}
                  variant="contained"
                  color="primary"
                  onClick={() => onNext(allowLeave)}
                  id="sign-up-next"
                >
                  {nextLabel}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        )}
      </SignUpContextProvider>
  );
};

// Children of all steps to capture Form and Workflow contexts
const NestedLeave: React.FC = () => {
  const { onSubmit } = useFormContext();
  const { call: reportError } = useWriteTransaction(message);

  const allowLeave = React.useCallback(async () => {
    try {
      const result = await onSubmit();
      return !!result && !isApiErrorResponse(result);
    } catch (e) {
      console.error("onSubmit", e);
      reportError({ body: { message: JSON.stringify(e) }});
      return false;
    }
  }, [onSubmit, reportError]);
  useAllowLeave(allowLeave);
  return null;
}