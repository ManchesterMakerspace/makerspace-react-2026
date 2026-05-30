import * as React from 'react';

import Grid from "@mui/material/Grid2";
import Button from "@mui/material/Button";
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { InvoiceOption } from 'makerspace-ts-api-client';

import { useMembershipOptions } from 'hooks/useMembershipOptions';
import Card from 'components/Card/Card';
import { MembershipOptionCard } from './MembershipOptionCard';
import { actionLabel, invoiceOptionParam, noneInvoiceOption } from './constants';
import { useSearchQuery } from 'hooks/useSearchQuery';
import ErrorMessage from 'ui/common/ErrorMessage';
import LoadingOverlay from 'ui/common/LoadingOverlay';

interface Props {
  showNoneOption: boolean;
  onSelect(option: InvoiceOption): void;
}

export const MembershipOptionCards: React.FC<Props> = ({ showNoneOption, onSelect }) => {
  const { normalOptions, loading, error } = useMembershipOptions(showNoneOption);

  const { membershipOptionId } = useSearchQuery({ membershipOptionId: invoiceOptionParam });

  if (!normalOptions.length && !showNoneOption) {
    return null;
  }

  return (
    <>
      {loading && <LoadingOverlay id="membership-options-loading" />}
      {normalOptions.map(option =>{
        const isNoneOption = option === noneInvoiceOption;
        const selected = membershipOptionId === option.id;
        const variant = (selected || !membershipOptionId) ? "contained" : "outlined";
        const label = selected ? "Selected" : actionLabel;

        return  (
          <MembershipOptionCard 
            key={option.id}
            option={option} 
            signUpButton={{ 
              onClick: onSelect,
              label: isNoneOption ? "Continue" : label, 
              color: "primary", 
              variant 
            }}
          />
        );
      })}
      {error && <ErrorMessage error={error} />}
    </>
  )
}

export const NoneOption: React.FC<Omit<Props, "showNoneOption">> = ({ onSelect }) => {
  const { membershipOptionId } = useSearchQuery({ membershipOptionId: invoiceOptionParam });
  const noneSelected = membershipOptionId === noneInvoiceOption.id;

  return (
    <Card>
      <Grid container spacing={3} justifyContent="center">
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle1">
            {noneInvoiceOption.description}
          </Typography>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box textAlign="right">
            <Button 
              color="primary"
              variant={noneSelected ? "contained" : "outlined"} 
              onClick={() => onSelect(noneInvoiceOption)}
              id={`membership-select-table-${noneInvoiceOption.id}-select-button`}
            >
              {noneSelected ? "Selected" : actionLabel}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Card>
  );
}