import * as React from "react";

import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";

import PaymentMethodForm from "ui/checkout/PaymentMethodForm";
import LoadingOverlay from "ui/common/LoadingOverlay";
import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import { AnyPaymentMethod } from "app/entities/paymentMethod";
import Form from "ui/common/Form";
import ButtonRow, { ActionButton, ActionButtonProps } from "ui/common/ButtonRow";
import PaymentMethodComponent from "ui/checkout/PaymentMethod";
import { listPaymentMethods, isApiErrorResponse, deletePaymentMethod } from "makerspace-ts-api-client";
import { getPaymentMethodCancellationImpact } from "api/paymentMethods";
import { PaymentMethodCancellationImpact } from "app/entities/paymentMethod";

interface OwnProps {
  onPaymentMethodChange?: (paymentMethod: AnyPaymentMethod) => void;
  managingMethods?: boolean;
  title?: string;
  paymentMethodToken?: string;
}
interface Props extends OwnProps {}
interface State {
  isRequesting: boolean;
  isDeleting: boolean;
  paymentMethods: AnyPaymentMethod[];
  error: string;
  openAddPayment: boolean;
  openDeleteModal: boolean;
  selectedPaymentMethodId: string;
  deleteImpactLoading: boolean;
  deleteImpact: PaymentMethodCancellationImpact | null;
}

class PaymentMethodsContainer extends React.Component<Props, State> {
  public formRef: Form;
  private setFormRef = (ref: Form) => (this.formRef = ref);

  constructor(props: Props) {
    super(props);
    const { paymentMethodToken } = props;
    this.state = {
      isRequesting: false,
      isDeleting: false,
      paymentMethods: [],
      error: "",
      openAddPayment: false,
      openDeleteModal: false,
      selectedPaymentMethodId: paymentMethodToken,
      deleteImpactLoading: false,
      deleteImpact: null
    };
  }

  public componentDidMount() {
    this.fetchPaymentMethods();
  }

  private fetchPaymentMethods = async (callback?: () => void) => {
    this.setState({ isRequesting: true, paymentMethods: [] });
    const result = await listPaymentMethods();
    if (isApiErrorResponse(result)) {
      this.setState({ isRequesting: false, error: result.error.message }, callback);
    } else {
      this.setState({ isRequesting: false, paymentMethods: result.data as any, error: "" }, callback);
    }
  };

  private addNewPaymentMethod = () => this.setState({ openAddPayment: true });

  private closeAddPaymentMethod = () => this.setState({ openAddPayment: false });

  private paymentMethodFromNonce = (nonce: string) =>
    this.state.paymentMethods.find(method => method.id === nonce);

  private onAddSuccess = (selectedPaymentMethod: AnyPaymentMethod) => {
    this.setState({ selectedPaymentMethodId: selectedPaymentMethod.id });
    this.fetchPaymentMethods(() => {
      const fullPaymentMethod = this.paymentMethodFromNonce(selectedPaymentMethod.id);
      this.props.onPaymentMethodChange && this.props.onPaymentMethodChange(fullPaymentMethod);
    });
    this.closeAddPaymentMethod();
  };

  private selectPaymentMethod = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedPaymentMethodId = event.currentTarget.value;
    this.setState({ selectedPaymentMethodId });
    const selectedPaymentMethod = this.paymentMethodFromNonce(selectedPaymentMethodId);
    this.props.onPaymentMethodChange && this.props.onPaymentMethodChange(selectedPaymentMethod);
  };

  private renderDeletePaymentModal = () => {
    const {
      isRequesting, isDeleting, error, openDeleteModal, selectedPaymentMethodId,
      deleteImpactLoading, deleteImpact
    } = this.state;
    const selectedPaymentMethod = this.paymentMethodFromNonce(selectedPaymentMethodId);
    if (!selectedPaymentMethod) {
      return;
    }

    // Only trust a positive impact result -- a loading or errored check falls
    // back to the plain confirmation rather than blocking or guessing at
    // consequences we couldn't actually verify.
    const hasSubscriptionImpact = !!deleteImpact && (deleteImpact.membership || deleteImpact.rentalCount > 0);

    return (
      <FormModal
        id="delete-payment-method-confirm"
        formRef={this.setFormRef}
        loading={isRequesting || isDeleting || deleteImpactLoading}
        isOpen={openDeleteModal}
        closeHandler={this.closeDeleteModal}
        title="Delete Payment Method"
        onSubmit={this.deletePaymentMethod}
        submitText={hasSubscriptionImpact ? "Delete Anyway" : "Delete"}
        error={error}
      >
        <Grid container justifyContent="center" spacing={2}>
          <Grid size={{ xs: 12 }}>
            {hasSubscriptionImpact ? (
              <>
                <Typography gutterBottom color="error" id="delete-payment-method-subscription-warning">
                  <strong>
                    Deleting this payment method will immediately cancel {[
                      deleteImpact.membership && "your membership subscription",
                      deleteImpact.rentalCount > 0 &&
                        `${deleteImpact.rentalCount} rental subscription${deleteImpact.rentalCount === 1 ? "" : "s"}`
                    ].filter(Boolean).join(" and ")}.
                  </strong>
                  {" "}This cannot be undone.
                </Typography>
                <Typography gutterBottom>
                  To keep that subscription active instead, add a new payment method and switch your
                  subscription to it first, then come back and delete this one.
                </Typography>
                <ActionButton
                  id="delete-payment-method-add-new-instead"
                  color="primary"
                  variant="outlined"
                  label="Add New Payment Method Instead"
                  onClick={() => { this.closeDeleteModal(); this.addNewPaymentMethod(); }}
                />
              </>
            ) : (
              <Typography gutterBottom>
                Are you sure you want to delete this payment method? This cannot be undone.
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            {this.renderPaymentMethod(selectedPaymentMethod)}
          </Grid>
        </Grid>
      </FormModal>
    );
  };

  private openDeleteModal = () => {
    this.setState({ openDeleteModal: true, deleteImpact: null, deleteImpactLoading: true });
    const { selectedPaymentMethodId } = this.state;
    getPaymentMethodCancellationImpact({ id: selectedPaymentMethodId }).then(result => {
      this.setState({ deleteImpact: result.data || null, deleteImpactLoading: false });
    });
  };
  private closeDeleteModal = () => this.setState({ openDeleteModal: false });

  private deletePaymentMethod = async () => {
    const { selectedPaymentMethodId } = this.state;
    this.setState({ isDeleting: true });

    const result = await deletePaymentMethod({ id: selectedPaymentMethodId });
    if (isApiErrorResponse(result)) {
      this.setState({ isDeleting: false, error: result.error.message });
    } else {
      this.setState({ isDeleting: false, error: "", selectedPaymentMethodId: undefined });
      this.props.onPaymentMethodChange && this.props.onPaymentMethodChange(null);
      this.closeDeleteModal();
      this.fetchPaymentMethods();
    }
  };

  private renderPaymentMethod = (
    paymentMethod: AnyPaymentMethod,
    displayDelete: boolean = false,
    displayRadio: boolean = false
  ): JSX.Element => {
    const label = (
      <PaymentMethodComponent
        {...paymentMethod}
        key={`${paymentMethod.id}-label`}
        id={`select-payment-method-${paymentMethod.id}`}
      />
    );

    return displayRadio ? (
      <FormControlLabel
        classes={{ label: "flex" }}
        key={paymentMethod.id}
        value={paymentMethod.id}
        label={label}
        labelPlacement="end"
        control={<Radio color="primary" />}
      />
    ) : (
      label
    );
  };

  private getActionButtons = () => {
    const { isRequesting, selectedPaymentMethodId } = this.state;
    const { managingMethods } = this.props;

    return [
      ...(managingMethods
        ? [
            {
              color: "secondary",
              variant: "outlined",
              id: "delete-payment-button",
              disabled: isRequesting || !selectedPaymentMethodId,
              onClick: this.openDeleteModal,
              label: "Delete Payment Method"
            }
          ]
        : []),
      {
        color: "primary",
        variant: "contained",
        disabled: isRequesting,
        id: "add-payment-button",
        onClick: this.addNewPaymentMethod,
        label: "Add New Payment Method"
      }
    ] as ActionButtonProps[];
  };

  public render(): JSX.Element {
    const { isRequesting, paymentMethods, error, selectedPaymentMethodId, openAddPayment } = this.state;
    const { managingMethods, title } = this.props;

    return (
      <>
        <Grid container justifyContent="center" spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" color="inherit">
              {title ? title : "Please Select a Payment Method"}
            </Typography>
          </Grid>
        </Grid>
        <Grid container justifyContent="flex-start" spacing={2}>
          {(isRequesting && <LoadingOverlay id="get-payment-methods" contained={true} />) ||
            (Array.isArray(paymentMethods) && paymentMethods.length && (
              <Grid size={{ xs: 12 }}>
                <FormControl component="fieldset" fullWidth={true}>
                  <RadioGroup
                    aria-label="Payment Method"
                    name="paymentMethodSelection"
                    value={selectedPaymentMethodId}
                    onChange={this.selectPaymentMethod}
                  >
                    {paymentMethods.map(paymentMethod =>
                      this.renderPaymentMethod(paymentMethod, managingMethods, true)
                    )}
                  </RadioGroup>
                </FormControl>
              </Grid>
            )) || (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body1" color="inherit" id="none-found">
                  No payment methods found. Click "Add New Payment Method" to add one.
                </Typography>
              </Grid>
            )}
          <ErrorMessage id={`get-payment-methods-error`} error={!isRequesting && error} />
          <Grid size={{ xs: 12 }}>
            <ButtonRow actionButtons={this.getActionButtons()} />
          </Grid>
        </Grid>
        <PaymentMethodForm
          isOpen={openAddPayment}
          onSuccess={this.onAddSuccess}
          closeHandler={this.closeAddPaymentMethod}
        />
        {managingMethods && this.renderDeletePaymentModal()}
      </>
    );
  }
}

export default PaymentMethodsContainer;