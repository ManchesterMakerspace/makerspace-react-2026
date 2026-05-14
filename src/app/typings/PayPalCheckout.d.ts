// PayPal JS SDK is loaded dynamically by braintree-web's loadPayPalSDK().
// These minimal types cover window.paypal usage after SDK load.
declare global {
  interface Window {
    paypal: {
      Buttons: (options: {
        createBillingAgreement?: () => Promise<any>;
        onApprove?: (data: any, actions: any) => void;
        onCancel?: (data: any) => void;
        onError?: (err: any) => void;
        fundingSource?: string;
        style?: {
          color?: string;
          shape?: string;
          label?: string;
          height?: number;
          layout?: string;
          tagline?: boolean;
        };
      }) => {
        render: (selector: string) => Promise<void>;
        isEligible: () => boolean;
      };
      FUNDING: {
        PAYPAL: string;
        VENMO: string;
        CARD: string;
      };
    };
  }
}

export {};
