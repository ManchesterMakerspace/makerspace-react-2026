import * as React from 'react';

import Grid from "@mui/material/Grid2";
import Typography from '@mui/material/Typography';

import { useMembershipOptions } from 'hooks/useMembershipOptions';
import { MembershipOptionCard } from './MembershipOptionCard';
import { invoiceOptionParam, promotionActionLabel } from './constants';
import { InvoiceOption } from 'makerspace-ts-api-client';
import { useSearchQuery } from 'hooks/useSearchQuery';
import { dateToMidnight } from 'ui/utils/timeToDate';

interface Props {
  onSelect(option: InvoiceOption): void;
}

export const PromotionCards: React.FC<Props> = ({ onSelect }) => {
  const { promotionOptions } = useMembershipOptions();
  const { membershipOptionId } = useSearchQuery({ membershipOptionId: invoiceOptionParam });

  if (!promotionOptions.length) {
    return null;
  }

  return (
    <>
    {promotionOptions.map(option => {
      const selected = membershipOptionId === option.id;
      const variant = (selected || !membershipOptionId) ? "contained" : "outlined";

      return (
        (
          <MembershipOptionCard 
            key={option.id}
            option={option} 
            signUpButton={{ 
              onClick: onSelect,
              label: selected ?  "Selected" : promotionActionLabel, 
              color: "primary", 
              variant 
            }}
          >
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption">
                Promotion ends {dateToMidnight(option.promotionEndDate)}
              </Typography>
            </Grid>
          </MembershipOptionCard>
        )
      )
    })}
    </>
  )
}