import * as React from 'react';
import * as Braintree from 'braintree-web';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';
import { getNewPaymentMethod, createPaymentMethod as createPaymentMethodApi, isApiErrorResponse } from 'makerspace-ts-api-client';
import { AnyPaymentMethod } from 'app/entities/paymentMethod';
import { PayPalProvider } from './PayPalForm';
import { VenmoProvider } from './VenmoForm';
import { CreditCardProvider } from './CreditCardForm';
import { useSetSearchQuery } from 'hooks/useSearchQuery';
import { paymentMethodQueryParam } from './constants';

interface PaymentMethodsContext {
  braintreeClient: Braintree.Client;
  createPaymentMethod(nonce: string, makeDefault?: boolean): Promise<any>;
  loading: boolean;
  error: Braintree.BraintreeError | string;
}

const PaymentMethodsContext = React.createContext<PaymentMethodsContext>({
  createPaymentMethod: (_: string) => Promise.resolve({}),
  braintreeClient: undefined,
  loading: false,
  error: undefined,
});

interface Props {
  onSuccess?: (paymentMethod: AnyPaymentMethod) => void;
}

export const PaymentMethodsProvider: React.FC<Props & { children?: React.ReactNode }> = ({ children, onSuccess }) => {
  const setSearch = useSetSearchQuery();

  const [tokenLoading, setTokenLoading] = React.useState(true);
  const [tokenError, setTokenError] = React.useState<string>();
  const [clientError, setClientError] = React.useState<Braintree.BraintreeError>();
  const [client, setClient] = React.useState<Braintree.Client>();
  const [clientLoading, setClientLoading] = React.useState(false);
  const initialized = React.useRef(false);

  // Fetch client token directly — useReadTransaction is inappropriate here
  // (no params, one-time init, Redux dedup causes deadlock)
  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fetchToken = async () => {
      try {
        const response = await getNewPaymentMethod();
        if (isApiErrorResponse(response)) {
          setTokenError(response.error.message);
          setTokenLoading(false);
          return;
        }
        const clientToken = (response.data as any)?.clientToken;
        setTokenLoading(false);
        if (!clientToken) {
          setTokenError('No client token returned from server');
          return;
        }
        setClientLoading(true);
        Braintree.client.create({ authorization: clientToken }, (err, clientInstance) => {
          if (err) setClientError(err);
          setClient(clientInstance);
          setClientLoading(false);
        });
      } catch (err) {
        setTokenError(err?.message || 'Failed to fetch payment token');
        setTokenLoading(false);
      }
    };

    fetchToken();
  }, []);

  const {
    call: createPaymentMethod,
    error: createPaymentMethodError,
    isRequesting: creatingPaymentMethod,
  } = useWriteTransaction(createPaymentMethodApi, ({ response }) => {
    if (onSuccess) {
      onSuccess(response.data as AnyPaymentMethod);
    } else {
      setSearch({ [paymentMethodQueryParam]: response.data.id });
    }
  });

  const context: PaymentMethodsContext = React.useMemo(() => ({
    createPaymentMethod: (nonce: string, makeDefault?: boolean) =>
      createPaymentMethod({ body: { paymentMethodNonce: nonce, makeDefault } }),
    loading: tokenLoading || clientLoading || creatingPaymentMethod,
    error: tokenError || clientError || createPaymentMethodError,
    braintreeClient: client,
  }), [
    client,
    createPaymentMethod,
    tokenLoading,
    clientLoading,
    creatingPaymentMethod,
    tokenError,
    clientError,
    createPaymentMethodError,
  ]);

  return (
    <PaymentMethodsContext.Provider value={context}>
      <CreditCardProvider>
        <PayPalProvider>
          <VenmoProvider>
            {children}
          </VenmoProvider>
        </PayPalProvider>
      </CreditCardProvider>
    </PaymentMethodsContext.Provider>
  );
};

export function usePaymentMethodsContext() {
  return React.useContext(PaymentMethodsContext);
}
