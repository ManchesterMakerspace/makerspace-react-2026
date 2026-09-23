// @ts-nocheck
import * as React from "react";
import { platform } from 'app/platform';
import { BrowserWorkflow } from 'ui/common/BrowserWorkflow';

import FormModal from "ui/common/FormModal";
import { updateSubscription, Subscription } from "makerspace-ts-api-client";
import useWriteTransaction from "../hooks/useWriteTransaction";
import { ActionButton } from "../common/ButtonRow";
import useModal from "../hooks/useModal";
import PaymentMethodsContainer from "../checkout/PaymentMethodsContainer";
import { AnyPaymentMethod } from "app/entities/paymentMethod";

interface Props {
  subscription: Subscription;
  onSuccess?(): void;
  label?: string;
}

const ChangePaymentMethodModal: React.FC<Props> = ({ subscription: { id: subscriptionId, paymentMethodToken } = {}, onSuccess, label }) => {
  const { isOpen, openModal, closeModal } = useModal();
  const [paymentMethodId, setPaymentMethodId] = React.useState<string>(paymentMethodToken);

  React.useEffect(() => {
    setPaymentMethodId(paymentMethodToken);
  }, [paymentMethodToken]);

  const { isRequesting, error, call } = useWriteTransaction(updateSubscription, () => {
    closeModal();
    onSuccess && onSuccess();
  });

  const onSubmit = React.useCallback(async () => {
    paymentMethodId && call({ id: subscriptionId, body: { paymentMethodToken: paymentMethodId }});
  }, [call, subscriptionId, paymentMethodId]);

  const setPaymentMethod = React.useCallback((pm: AnyPaymentMethod) => {
    setPaymentMethodId(pm.id);
  }, []);

  if (!subscriptionId) {
    return null;
  }
  if (platform.native) return <BrowserWorkflow path={window.location.pathname + window.location.search} label="Change payment method in browser" />;

  return (
    <>
      <ActionButton
        id="subscription-option-payment-method"
        color="primary"
        variant="contained"
        disabled={isRequesting || !!error}
        label={label || "Change Payment Method"}
        onClick={openModal}
      />
      {isOpen && (
        <FormModal
          id="change-payment-method"
          isOpen={true}
          closeHandler={closeModal}
          onSubmit={onSubmit}
          loading={isRequesting}
          error={error}
        >
          <PaymentMethodsContainer
            onPaymentMethodChange={setPaymentMethod}
            title="Select or add a new payment method"
            paymentMethodToken={paymentMethodId}
          />
        </FormModal>
      )}
    </>
  );
};

export default ChangePaymentMethodModal;
