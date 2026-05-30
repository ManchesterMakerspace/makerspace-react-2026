import * as React from 'react';
import Typography from '@mui/material/Typography';
import Grid from "@mui/material/Grid2";

import { CreditCard, PayPalAccount } from 'makerspace-ts-api-client';
import { VenmoAccount } from 'app/entities/paymentMethod';

export interface Props extends Partial<CreditCard>, Partial<PayPalAccount>, Partial<VenmoAccount> {}

const PaymentMethodComponent: React.FC<Props> = ({ cardType, last4, imageUrl, email, username, id }) => {
  const image = imageUrl;

  let description: string;
  if (cardType) {
    description = `${cardType} ending in ${last4}`;
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
