import * as React from 'react';
import { styled } from '@mui/material/styles';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Accordion from '@mui/material/Accordion';
import MuiAccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';

import { AnyPaymentMethod } from 'app/entities/paymentMethod';
import FormModal from 'ui/common/FormModal';
import LoadingOverlay from 'ui/common/LoadingOverlay';
import { RadioGroup } from 'components/Form/inputs/RadioGroup';
import { FormContextProvider, useFormContext } from 'components/Form/FormContext';
import { PaymentMethodsProvider, usePaymentMethodsContext } from '../../pages/registration/PaymentMethods/PaymentMethodsContext';
import { CreditCardConsumer, CreditCardForm, useCreditCardContext } from '../../pages/registration/PaymentMethods/CreditCardForm';
import { PayPalConsumer, PayPalForm } from '../../pages/registration/PaymentMethods/PayPalForm';
import { VenmoConsumer, VenmoForm } from '../../pages/registration/PaymentMethods/VenmoForm';
import { PaymentType, paymentTypeFieldName } from '../../pages/registration/PaymentMethods/constants';

interface Props {
  isOpen: boolean;
  onSuccess: (paymentMethod: AnyPaymentMethod) => void;
  closeHandler: () => void;
}

const AccordionSummary = styled(MuiAccordionSummary)(({
  theme,
}) => ({

  root: {
    backgroundColor: 'rgba(0, 0, 0, .03)',
    borderBottom: '1px solid rgba(0, 0, 0, .125)',
    marginBottom: -1,
    minHeight: 56,
    '&$expanded': {
      minHeight: 56,
    },
  },
  content: {
    '&$expanded': {
      margin: '12px 0',
    },
  },
  expanded: {},
}
));

// Separate component so useCreditCardContext() is inside the CreditCardProvider tree
const CreditCardAccordionContent: React.FC = () => {
  const { submit, loading, validate } = useCreditCardContext();

  const handleSave = React.useCallback(async () => {
    const errors = validate();
    if (!errors) {
      await submit();
    }
  }, [submit, validate]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <CreditCardForm />
      </Grid>
      <Grid item xs={12}>
        <Button
          id='save-card-button'
          variant='contained'
          color='primary'
          onClick={handleSave}
          disabled={loading}
          fullWidth
        >
          Save Card
        </Button>
      </Grid>
    </Grid>
  );
};

// Inner content has access to all context providers
const AddPaymentMethodContent: React.FC = () => {
  const { loading } = usePaymentMethodsContext();
  const { values, setValue } = useFormContext();

  const updateType = React.useCallback((newType: PaymentType) => () => {
    setValue(paymentTypeFieldName, newType);
  }, [setValue]);

  return (
    <CreditCardConsumer>
      {({ loading: ccLoading }) => (
        <PayPalConsumer>
          {({ loading: paypalLoading }) => (
            <VenmoConsumer>
              {({ loading: venmoLoading }) => (
                <RadioGroup fieldName={paymentTypeFieldName} defaultValue={PaymentType.CreditCard}>
                  <>
                    {(loading || ccLoading || paypalLoading || venmoLoading) && (
                      <LoadingOverlay id='add-payment-method' />
                    )}

                    <Accordion
                      expanded={values[paymentTypeFieldName] === PaymentType.CreditCard}
                      onClick={updateType(PaymentType.CreditCard)}
                    >
                      <AccordionSummary aria-controls='cc-content' id='cc-header'>
                        <FormControlLabel
                          value={PaymentType.CreditCard}
                          label='Debit or Credit Card'
                          control={<Radio color='primary' />}
                        />
                      </AccordionSummary>
                      <AccordionDetails>
                        <CreditCardAccordionContent />
                      </AccordionDetails>
                    </Accordion>

                    <Accordion
                      expanded={values[paymentTypeFieldName] === PaymentType.PayPal}
                      onClick={updateType(PaymentType.PayPal)}
                    >
                      <AccordionSummary aria-controls='paypal-content' id='paypal-header'>
                        <FormControlLabel
                          value={PaymentType.PayPal}
                          label='PayPal'
                          control={<Radio color='primary' />}
                        />
                      </AccordionSummary>
                      <AccordionDetails>
                        <PayPalForm />
                      </AccordionDetails>
                    </Accordion>

                    <Accordion
                      expanded={values[paymentTypeFieldName] === PaymentType.Venmo}
                      onClick={updateType(PaymentType.Venmo)}
                    >
                      <AccordionSummary aria-controls='venmo-content' id='venmo-header'>
                        <FormControlLabel
                          value={PaymentType.Venmo}
                          label='Venmo'
                          control={<Radio color='primary' />}
                        />
                      </AccordionSummary>
                      <AccordionDetails>
                        <VenmoForm />
                      </AccordionDetails>
                    </Accordion>
                  </>
                </RadioGroup>
              )}
            </VenmoConsumer>
          )}
        </PayPalConsumer>
      )}
    </CreditCardConsumer>
  );
};

// Providers are outside FormModal so they initialize once regardless of modal open/close state.
// This prevents the "Element already contains a Braintree iframe" error from re-initialization.
const PaymentMethodForm: React.FC<Props> = ({ isOpen, onSuccess, closeHandler }) => {
  return (
    <PaymentMethodsProvider onSuccess={onSuccess}>
      <FormContextProvider>
        <FormModal
          id='payment-method-form'
          title='Add Payment Method'
          isOpen={isOpen}
          closeHandler={closeHandler}
        >
          <AddPaymentMethodContent />
        </FormModal>
      </FormContextProvider>
    </PaymentMethodsProvider>
  );
};

export default PaymentMethodForm;
