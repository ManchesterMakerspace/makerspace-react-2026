import { CreditCard, PayPalAccount } from 'makerspace-ts-api-client';

export interface PaymentMethod {
  id: string;
  customerId: string;
  paymentType?: string;
  imageUrl: string;
  isDefault: boolean;
}

export interface VenmoAccount extends PaymentMethod {
  username: string;
  venmoUserId?: string;
}

export const isCreditCard = (paymentMethod: any): paymentMethod is CreditCard => {
  return paymentMethod.paymentType === PaymentMethodType.CreditCard;
};

export const isPaypal = (paymentMethod: any): paymentMethod is PayPalAccount => {
  return paymentMethod.paymentType === PaymentMethodType.PayPal;
};

export const isVenmo = (paymentMethod: any): paymentMethod is VenmoAccount => {
  return paymentMethod.paymentType === PaymentMethodType.Venmo;
};

export enum PaymentMethodType {
  PayPal = 'paypal',
  Venmo = 'venmo',
  Cash = 'cash',
  CreditCard = 'credit_card',
}

export type AnyPaymentMethod = CreditCard | PayPalAccount | VenmoAccount;
