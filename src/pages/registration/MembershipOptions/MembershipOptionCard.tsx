import * as React from 'react';

import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { InvoiceOption } from 'makerspace-ts-api-client';

import { useGoToSignUp } from '../useGoToSignUp';
import Card from 'components/Card/Card';
import { numberAsCurrency } from 'ui/utils/numberAsCurrency';

interface Props {
  option: InvoiceOption;
  signUpButton: {
    label: string;
    onClick(option: InvoiceOption): void;
    color?: React.ComponentProps<typeof Button>["color"],
    variant?: React.ComponentProps<typeof Button>["variant"]
  }
}

export const MembershipOptionCard: React.FC<Props> = ({ option, signUpButton, children }) => {
  const goToSignUp = useGoToSignUp();

  return (
    <Card>
      <Grid container spacing={3} justifyContent="center">
        <Grid size={{ xs: 12 }}>
          <Typography variant="h5">
            {option.name}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2">
            {option.description}
          </Typography>
        </Grid>

        {children}

        <Grid size={{ xs: 6 }}>
          <Box textAlign="left">
            {option.amount && <Typography variant="body1">
              {numberAsCurrency(option.amount)} {!!option.quantity && <>/ {option.quantity === 1 ? "month" : `${option.quantity} months`}</>}
            </Typography>}
          </Box>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Box textAlign="right">
            <Button 
              variant={signUpButton.variant} 
              color={signUpButton.color} 
              onClick={() => goToSignUp(option)}
              id={`membership-select-table-${option.id}-select-button`}
            >
              {signUpButton.label}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Card>
  )
}