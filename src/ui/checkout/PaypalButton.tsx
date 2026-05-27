import * as React from 'react';
import * as Braintree from 'braintree-web';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import ErrorMessage from 'ui/common/ErrorMessage';
import LoadingOverlay from 'ui/common/LoadingOverlay';
import { createPaymentMethod } from 'makerspace-ts-api-client';
import { AnyPaymentMethod } from 'app/entities/paymentMethod';

interface Props {
  braintreeInstance: Braintree.Client;
  clientToken: string;
  paymentMethodCallback?: (paymentMethod: AnyPaymentMethod) => void;
}

const PaypalButton: React.FC<Props> = ({ braintreeInstance, paymentMethodCallback }) => {
  const [error, setError] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (braintreeInstance && !initialized.current) {
      initialized.current = true;
      initPaypal();
    }
  }, [braintreeInstance]);

  const initPaypal = async () => {
    setLoading(true);
    try {
      const paypalCheckoutInstance = await new Promise<any>((resolve, reject) => {
        Braintree.paypalCheckout.create({ client: braintreeInstance }, (err, instance) => {
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
          setLoading(true);
          setError(undefined);
          try {
            const payload = await paypalCheckoutInstance.tokenizePayment(data);
            await createPaymentMethod({ body: { paymentMethodNonce: payload.nonce, makeDefault: true } });
            paymentMethodCallback && paymentMethodCallback(payload);
          } catch (err) {
            setError(err.errorMessage || err.message || String(err));
          } finally {
            setLoading(false);
          }
        },

        onCancel: (_data: any) => {
          console.log('PayPal payment cancelled');
        },

        onError: (err: any) => {
          setError(err.message || String(err));
          setLoading(false);
        }
      });

      if (buttonInstance.isEligible()) {
        await buttonInstance.render('#paypal-button-checkout');
      }

      setLoading(false);
    } catch (err) {
      setError(err.message || String(err));
      setLoading(false);
    }
  };

  return (
    <Grid container spacing={2} style={{ position: 'relative', overflow: 'hidden' }}>
      <Grid item xs={12} style={{ textAlign: 'center' }}>
        <div id='paypal-button-checkout' />
        {loading && <Typography variant='body1'>Contacting PayPal</Typography>}
        {error && <ErrorMessage error={error} id='paypal-error' />}
      </Grid>
      {loading && <LoadingOverlay id='paypal-button-checkout' />}
    </Grid>
  );
};

export default PaypalButton;
