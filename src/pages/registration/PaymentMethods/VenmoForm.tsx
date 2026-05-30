import * as React from 'react';
import * as Braintree from 'braintree-web';
import Grid from "@mui/material/Grid2";
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { usePaymentMethodsContext } from './PaymentMethodsContext';
import { FormContextProvider, useFormContext } from 'components/Form/FormContext';
import ErrorMessage from 'ui/common/ErrorMessage';
import { FormField } from 'components/Form/FormField';
import { venmoValidation } from './constants';
import { message } from 'makerspace-ts-api-client';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';

interface VenmoContext {
  initialize(): void;
  tokenize(): void;
  loading: boolean;
  ready: boolean;
  supported: boolean;
  error: Braintree.BraintreeError | string;
}

const VenmoContext = React.createContext<VenmoContext>({
  initialize: () => {},
  tokenize: () => {},
  loading: false,
  ready: false,
  supported: true,
  error: undefined,
});

export const VenmoConsumer = VenmoContext.Consumer;

interface Props {}

export const VenmoProvider: React.FC<Props & { children?: React.ReactNode }> = ({ children }) => {
  const { braintreeClient, createPaymentMethod } = usePaymentMethodsContext();
  const { setError } = useFormContext();

  const [instanceError, setInstanceError] = React.useState<Braintree.BraintreeError | string>();
  const [instance, setInstance] = React.useState<any>();
  const [instanceLoading, setInstanceLoading] = React.useState(true);
  const [supported, setSupported] = React.useState(true);
  const initialized = React.useRef(false);

  const { call: reportError } = useWriteTransaction(message);

  const initFields = React.useCallback(() => {
    if (!braintreeClient || initialized.current) return;
    initialized.current = true;
    setInstanceLoading(true);

    // Guard: venmo may not be available in all braintree-web builds
    const venmoModule = (Braintree as any).venmo;
    if (!venmoModule) {
      console.warn('[Venmo] braintree-web/venmo module not available in this build');
      setSupported(false);
      setInstanceLoading(false);
      return;
    }

    try {
      venmoModule.create({
        client: braintreeClient,
        allowDesktop: true,
        allowDesktopWebLogin: true,
        paymentMethodUsage: 'multi_use',
      }, (err: any, venmoInstance: any) => {
        setInstanceLoading(false);

        if (err) {
          console.warn('[Venmo] Init error:', err);
          setInstanceError(err);
          setSupported(false);
          return;
        }

        const browserSupported = venmoInstance.isBrowserSupported();
        console.log('[Venmo] isBrowserSupported:', browserSupported);

        if (!browserSupported) {
          setSupported(false);
          return;
        }

        setInstance(venmoInstance);
      });
    } catch (err) {
      console.warn('[Venmo] Unexpected error during init:', err);
      setSupported(false);
      setInstanceLoading(false);
    }
  }, [braintreeClient]);

  const tokenize = React.useCallback(() => {
    if (!instance) return;
    setInstanceLoading(true);
    setInstanceError(undefined);

    instance.tokenize((err: any, payload: any) => {
      setInstanceLoading(false);

      if (err) {
        // User cancelled — not an error worth surfacing
        if (err.code === 'VENMO_CANCELED' || err.code === 'VENMO_APP_CANCELED') {
          return;
        }
        setInstanceError(err);
        reportError({ body: { message: err.message || String(err) } });
        return;
      }

      setError(venmoValidation, undefined);
      setInstanceError(undefined);
      createPaymentMethod(payload.nonce, true);
    });
  }, [instance, createPaymentMethod, setError, reportError]);

  const context: VenmoContext = React.useMemo(() => {
    return {
      initialize: braintreeClient && initFields,
      tokenize,
      loading: instanceLoading,
      ready: !!instance,
      supported,
      error: instanceError,
    };
  }, [braintreeClient, instance, instanceLoading, instanceError, initFields, tokenize, supported]);

  return (
    <VenmoContext.Provider value={context}>
      <FormContextProvider>
        {children}
      </FormContextProvider>
    </VenmoContext.Provider>
  );
};

export function useVenmoContext(): VenmoContext {
  return React.useContext(VenmoContext);
}

export const VenmoForm: React.FC = () => {
  const { error: venmoError, initialize, tokenize, loading, ready, supported } = useVenmoContext();
  const { error: createPaymentMethodError } = usePaymentMethodsContext();
  const error = venmoError || createPaymentMethodError;

  React.useEffect(() => {
    initialize?.();
  }, [initialize]);

  return (
    <Grid container spacing={8} justifyContent='center'>
      <Grid size={{ xs: 12 }}>
        {supported ? (
          <Button
            id='venmo-button'
            onClick={tokenize}
            disabled={loading || !ready}
            style={{
              backgroundColor: loading || !ready ? undefined : '#008CFF',
              color: '#ffffff',
              fontWeight: 'bold',
              width: '100%',
              height: '36px',
              borderRadius: '4px',
              textTransform: 'none',
              fontSize: '14px',
            }}
          >
            Pay with Venmo
          </Button>
        ) : (
          <Typography variant='body2' color='textSecondary'>
            Venmo is not supported in your current browser. Please select another payment method.
          </Typography>
        )}
        <FormField fieldName={venmoValidation} />
        {error && <ErrorMessage error={typeof error === 'string' ? error : error.message} />}
      </Grid>
    </Grid>
  );
};
