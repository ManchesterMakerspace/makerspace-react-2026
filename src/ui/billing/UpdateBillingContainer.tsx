import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { InvoiceOption } from 'makerspace-ts-api-client';
import { CrudOperation } from 'app/constants';
import { State as ReduxState, ScopedThunkDispatch } from 'ui/reducer';
import Form from 'ui/common/Form';
import { updateBillingAction, createBillingAction, deleteBillingAction } from 'ui/billing/actions';
import { BillingFormComponent } from 'ui/billing/BillingForm';
import DeleteInvoiceOptionModal from 'ui/billing/DeleteInvoiceOptionModal';

export interface UpdateBillingRenderProps {
  billingOption: Partial<InvoiceOption>;
  isOpen: boolean;
  operation: CrudOperation;
  closeHandler: () => void;
  isRequesting: boolean;
  error: string;
  submit: (form: Form) => Promise<boolean>;
  setRef: (ref: BillingFormComponent | DeleteInvoiceOptionModal) => void;
}

interface OwnProps {
  billingOption: Partial<InvoiceOption>;
  isOpen: boolean;
  operation: CrudOperation;
  closeHandler: () => void;
  render: (renderPayload: UpdateBillingRenderProps) => JSX.Element;
}

const UpdateBillingContainer: React.FC<OwnProps> = ({ billingOption, isOpen, operation, closeHandler, render }) => {
  const dispatch = useDispatch<ScopedThunkDispatch>();
  const formRef = React.useRef<BillingFormComponent | DeleteInvoiceOptionModal>(null);

  const { isRequesting, error } = useSelector((state: ReduxState) => {
    switch (operation) {
      case CrudOperation.Update: return state.billing.update;
      case CrudOperation.Create: return state.billing.create;
      case CrudOperation.Delete: return state.billing.delete;
      default: return { isRequesting: false, error: undefined };
    }
  });

  const prevIsRequestingRef = React.useRef(isRequesting);
  React.useEffect(() => {
    const wasRequesting = prevIsRequestingRef.current;
    prevIsRequestingRef.current = isRequesting;
    if (isOpen && wasRequesting && !isRequesting && !error) {
      closeHandler();
    }
  }, [isRequesting]);

  const dispatchBilling = (billingOptionDetails: InvoiceOption) => {
    let action;
    switch (operation) {
      case CrudOperation.Delete:
        action = deleteBillingAction(billingOption.id);
        break;
      case CrudOperation.Update:
        action = updateBillingAction(billingOption.id, billingOptionDetails);
        break;
      case CrudOperation.Create:
        action = createBillingAction(billingOptionDetails);
        break;
    }
    return dispatch(action);
  };

  const submit = async (form: Form): Promise<boolean> => {
    const billingFormRef = formRef.current as BillingFormComponent;
    const validUpdate: InvoiceOption = await billingFormRef?.validate && await billingFormRef.validate(form);
    if (!form.isValid()) return;
    await dispatchBilling(validUpdate);
    if (!error) return true;
  };

  const setRef = (ref: BillingFormComponent | DeleteInvoiceOptionModal) => {
    (formRef as React.MutableRefObject<any>).current = ref;
  };

  return render({ billingOption, isOpen, operation, closeHandler, isRequesting, error, submit, setRef });
};

export default UpdateBillingContainer;
