import * as React from 'react';
import * as Braintree from 'braintree-web';
import Grid from '@mui/material/Grid';

import { usePaymentMethodsContext } from './PaymentMethodsContext';
import { FormContextProvider, useFormContext } from 'components/Form/FormContext';
import ErrorMessage from 'ui/common/ErrorMessage';
import { FormField } from 'components/Form/FormField';
import { paypalValidation } from './constants';
import { message } from 'makerspace-ts-api-client';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';

interface PayPalContext {
  initialize(): void;
  loading: boolean;
  error: Braintree.BraintreeError | string;
}

const PayPalContext = React.createContext<PayPalContext>({
  initialize: () => {},
  loading: false,
  error: undefined,
});

export const PayPalConsumer = PayPalContext.Consumer;

interface Props {}

export const PayPalProvider: React.FC<Props> = ({ children }) => {
  const { braintreeClient, createPaymentMethod } = usePaymentMethodsContext();
  const { setError } = useFormContext();

  const [instanceError, setInstanceError] = React.useState<Braintree.BraintreeError | string>();
  const [instanceLoading, setInstanceLoading] = React.useState(true);
  const initialized = React.useRef(false);

  const { call: reportError } = useWriteTransaction(message);

  const initFields = React.useCallback(async () => {
    if (!braintreeClient || initialized.current) return;
    initialized.current = true;
    setInstanceLoading(true);

    try {
      const paypalCheckoutInstance = await new Promise<any>((resolve, reject) => {
        Braintree.paypalCheckout.create({ client: braintreeClient }, (err, instance) => {
          if (err) { reject(err); } else { resolve(instance); }
        });
      });

      // Disable credit and card funding sources — show only the PayPal button
      await paypalCheckoutInstance.loadPayPalSDK({
        vault: true,
        'disable-funding': 'credit,card',
      });

      const buttonInstance = window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.PAYPAL,

        style: {
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 36,
        } as any,

        createBillingAgreement: () => paypalCheckoutInstance.createPayment({ flow: 'vault' }),

        onApprove: async (data: any) => {
          setError(paypalValidation, undefined);
          setInstanceError(undefined);
          setInstanceLoading(true);
          try {
            const payload = await paypalCheckoutInstance.tokenizePayment(data);
            await createPaymentMethod(payload.nonce, true);
          } catch (err) {
            setInstanceError(err);
            reportError({ body: { message: err.message || String(err) } });
          } finally {
            setInstanceLoading(false);
          }
        },

        onCancel: (_data: any) => {
          console.log('PayPal payment cancelled');
        },

        onError: (err: any) => {
          setInstanceError(err);
          reportError({ body: { message: err.message || String(err) } });
        }
      });

      if (buttonInstance.isEligible()) {
        await buttonInstance.render('#paypal-button');
      }

      setInstanceLoading(false);
    } catch (err) {
      setInstanceError(err);
      setInstanceLoading(false);
    }
  }, [braintreeClient, createPaymentMethod, reportError, setError]);

  const context: PayPalContext = React.useMemo(() => {
    return {
      initialize: braintreeClient && initFields,
      loading: instanceLoading,
      error: instanceError,
    };
  }, [braintreeClient, instanceLoading, instanceError, initFields]);

  return (
    <PayPalContext.Provider value={context}>
      <FormContextProvider>
        {children}
      </FormContextProvider>
    </PayPalContext.Provider>
  );
};

export function usePayPalContext(): PayPalContext {
  return React.useContext(PayPalContext);
}

export const PayPalForm: React.FC = () => {
  const { error: payPalError, initialize } = usePayPalContext();
  const { error: createPaymentMethodError } = usePaymentMethodsContext();
  const error = payPalError || createPaymentMethodError;

  React.useEffect(() => {
    initialize?.();
  }, [initialize]);

  return (
    <Grid container spacing={8} justifyContent='center'>
      <Grid item xs={12}>
        <div id='paypal-button' />
        <FormField fieldName={paypalValidation} />
        {error && <ErrorMessage error={typeof error === 'string' ? error : error.message} />}
      </Grid>
    </Grid>
  );
};
