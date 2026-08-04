import * as React from 'react';
import Typography from '@mui/material/Typography';
import Grid from "@mui/material/Grid";

import { CreditCard, PayPalAccount } from 'makerspace-ts-api-client';
import { VenmoAccount } from 'app/entities/paymentMethod';

export interface Props extends Partial<CreditCard>, Partial<PayPalAccount>, Partial<VenmoAccount> {}

export const isCurrentCardExpiration = (
  expirationMonth?: number,
  expirationYear?: number,
  now: Date = new Date()
): boolean =>
  Number(expirationMonth) === now.getMonth() + 1 &&
  Number(expirationYear) === now.getFullYear();

export const formatCardExpiration = (expirationMonth?: number, expirationYear?: number): string | undefined => {
  if (expirationMonth == null || expirationYear == null) return undefined;
  return `${String(expirationMonth).padStart(2, '0')}/${expirationYear}`;
};

const PaymentMethodComponent: React.FC<Props> = (props: Props) => {
  const {
    cardType,
    last4,
    expirationMonth,
    expirationYear,
    imageUrl,
    email,
    username,
    id
  } = props;
  const image = imageUrl;
  const expiration = formatCardExpiration(expirationMonth, expirationYear);
  const expiresThisMonth = isCurrentCardExpiration(expirationMonth, expirationYear);

  let description: React.ReactNode;
  if (cardType) {
    description = (
      <>
        {cardType} ending in {last4}
        {expiration && (
          <>
            {' · Expires '}
            <span
              data-payment-method-expiration={expiration}
              style={expiresThisMonth ? { color: '#b00020', fontWeight: 700 } : undefined}
            >
              {expiration}
            </span>
          </>
        )}
      </>
    );
  } else if (username) {
    description = `Venmo account @${username}`;
  } else if (email) {
    description = `PayPal account ${email}`;
  } else {
    description = 'PayPal account (no email on file)';
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }} style={{ border: '1px solid black', borderColor: '#9E3321', borderRadius: '4px', textAlign: 'center' }}>
        <img style={{ float: 'left', marginRight: '2em' }} src={image} alt={cardType || (username ? 'Venmo' : 'PayPal')} />
        <Typography style={{ lineHeight: '2.5em' }} variant='subtitle1' id={id}>{description}</Typography>
      </Grid>
    </Grid>
  );
};

export default PaymentMethodComponent;
