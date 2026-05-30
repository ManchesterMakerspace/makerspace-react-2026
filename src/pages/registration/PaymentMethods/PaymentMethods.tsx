import * as React from 'react';
import { styled } from '@mui/material/styles';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Accordion from '@mui/material/Accordion';
import MuiAccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Grid from "@mui/material/Grid";
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';

import { listPaymentMethods, isApiErrorResponse } from 'makerspace-ts-api-client';

import useReadTransaction from 'ui/hooks/useReadTransaction';
import PaymentMethodComponent from 'ui/checkout/PaymentMethod';
import LoadingOverlay from 'ui/common/LoadingOverlay';
import { useSearchQuery } from 'hooks/useSearchQuery';
import { useFormContext } from 'components/Form/FormContext';
import { RadioGroup } from 'components/Form/inputs/RadioGroup';
import { usePaymentMethodsContext } from './PaymentMethodsContext';
import { CreditCardConsumer, CreditCardForm } from './CreditCardForm';
import { PayPalConsumer, PayPalForm } from './PayPalForm';
import { VenmoConsumer, VenmoForm } from './VenmoForm';
import {
  paymentMethodQueryParam,
  PaymentType,
  paymentTypeFieldName,
  selectedFieldName,
} from './constants';

interface Props {}

const AccordionSummary = styled(MuiAccordionSummary)({
  backgroundColor: 'rgba(0, 0, 0, .03)',
  borderBottom: '1px solid rgba(0, 0, 0, .125)',
  marginBottom: -1,
  minHeight: 56,
  '&.Mui-expanded': {
    minHeight: 56,
  },
  '& .MuiAccordionSummary-content.Mui-expanded': {
    margin: '12px 0',
  },
});

export const PaymentMethods: React.FC<Props> = () => {
  const { loading } = usePaymentMethodsContext();
  const { values, setValue } = useFormContext();
  const emptyParams = React.useMemo(() => ({}), []);
  const { isRequesting, response, refresh } = useReadTransaction(listPaymentMethods, emptyParams);
  // Deduplicate by id — guards against stale Redux state producing repeated entries
  const rawPaymentMethods = !isApiErrorResponse(response) && response?.data || [];
  const paymentMethods = rawPaymentMethods.filter(
    (pm, i, arr) => arr.findIndex(p => p.id === pm.id) === i
  );

  const { priorPaymentMethod } = useSearchQuery({ priorPaymentMethod: paymentMethodQueryParam });
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = React.useState<string>(priorPaymentMethod);

  // Update the selection when the list of payment methods finishes loading
  React.useEffect(() => {
    if (!isRequesting) {
      if (!!paymentMethods.length) {
        const foundMethod = selectedPaymentMethodId && paymentMethods.find(pm => pm.id === selectedPaymentMethodId) || paymentMethods[0];
        setSelectedPaymentMethodId(foundMethod.id);
        setValue(paymentTypeFieldName, PaymentType.Existing);
      } else {
        values[paymentTypeFieldName] === PaymentType.Existing && setValue(paymentTypeFieldName, PaymentType.CreditCard);
      }
    }
  }, [isRequesting]);

  // Refresh payment methods and reset the selection if the URL param changes.
  // This happens when 3P payment forms (PayPal, Venmo) successfully create a
  // new payment method outside of this workflow.
  React.useEffect(() => {
    if (priorPaymentMethod && priorPaymentMethod !== selectedPaymentMethodId) {
      refresh();
      setSelectedPaymentMethodId(priorPaymentMethod);
    }
  }, [priorPaymentMethod]);

  const updateType = React.useCallback((newType) => () => {
    setValue(paymentTypeFieldName, newType);
    setSelectedPaymentMethodId('');
  }, [setValue, setSelectedPaymentMethodId]);

  return (
    <CreditCardConsumer>
      {({ loading: ccLoading }) => (
        <PayPalConsumer>
          {({ loading: paypalLoading }) => (
            <VenmoConsumer>
              {({ loading: venmoLoading }) => (
                <RadioGroup fieldName={paymentTypeFieldName} defaultValue={PaymentType.Existing}>
                  <>
                    {(loading || paypalLoading || ccLoading || venmoLoading || isRequesting) && <LoadingOverlay id='payment-method-form' />}

                    <Accordion
                      expanded={values[paymentTypeFieldName] === PaymentType.Existing}
                      onChange={(_, expanded) => expanded && setValue(paymentTypeFieldName, PaymentType.Existing)}
                    >
                      <AccordionSummary
                        aria-controls='saved-payment-methods-content'
                        id='saved-payment-methods-header'
                      >
                        <FormControlLabel
                          value={PaymentType.Existing}
                          label='Saved Payment Methods'
                          control={<Radio color='primary' />}
                          style={{ flexGrow: 1 }}
                        />
                        <Tooltip title='Refresh payment methods'>
                          <IconButton
                            size='small'
                            onClick={e => { e.stopPropagation(); refresh(); }}
                            aria-label='refresh payment methods'
                            disabled={isRequesting}
                          >
                            <RefreshIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container>
                          <Grid size={{ xs: 12 }}>
                            {!!paymentMethods.length ? (
                              <RadioGroup
                                aria-label='Payment Method'
                                fieldName={selectedFieldName}
                                value={selectedPaymentMethodId}
                                onChange={setSelectedPaymentMethodId}
                              >
                                {paymentMethods.map(paymentMethod => (
                                  <FormControlLabel
                                    classes={{ label: 'flex' }}
                                    key={paymentMethod.id}
                                    value={paymentMethod.id}
                                    label={(
                                      <PaymentMethodComponent
                                        {...paymentMethod}
                                        key={`${paymentMethod.id}-label`}
                                        id={`select-payment-method-${paymentMethod.id}`}
                                      />
                                    )}
                                    labelPlacement='end'
                                    control={<Radio color='secondary' />}
                                  />
                                ))}
                              </RadioGroup>
                            ) : (isRequesting ? <LoadingOverlay contained={true} /> : 'No payment methods on file')}
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>

                    <Accordion
                      expanded={values[paymentTypeFieldName] === PaymentType.CreditCard}
                      onClick={() => updateType(PaymentType.CreditCard)}
                    >
                      <AccordionSummary
                        aria-controls='cc-content'
                        id='cc-header'
                      >
                        <FormControlLabel
                          value={PaymentType.CreditCard}
                          label='Debit or Credit Card'
                          control={<Radio color='primary' />}
                        />
                      </AccordionSummary>
                      <AccordionDetails>
                        <CreditCardForm />
                      </AccordionDetails>
                    </Accordion>

                    <Accordion
                      onClick={() => updateType(PaymentType.PayPal)}
                      expanded={values[paymentTypeFieldName] === PaymentType.PayPal}
                    >
                      <AccordionSummary
                        aria-controls='paypal-content'
                        id='paypal-header'
                      >
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
                      onClick={() => updateType(PaymentType.Venmo)}
                      expanded={values[paymentTypeFieldName] === PaymentType.Venmo}
                    >
                      <AccordionSummary
                        aria-controls='venmo-content'
                        id='venmo-header'
                      >
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
