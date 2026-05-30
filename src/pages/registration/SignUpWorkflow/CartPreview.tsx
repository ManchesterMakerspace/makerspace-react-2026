import * as React from 'react';
import Typography from '@mui/material/Typography';
import Grid from "@mui/material/Grid2";
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';

import { discountParam, invoiceOptionParam, noneInvoiceOption, ssmDiscount } from '../MembershipOptions';
import { useSearchQuery, useSetSearchQuery } from 'hooks/useSearchQuery';
import { useMembershipOptions } from 'hooks/useMembershipOptions';
import { numberAsCurrency } from 'ui/utils/numberAsCurrency';
import { TextInput } from 'components/Form/inputs/TextInput';
import { CheckboxInput } from 'components/Form/inputs/CheckboxInput';
import { FormField } from 'components/Form/FormField';
import KeyValueItem from 'ui/common/KeyValueItem';
import { useTotal } from './constant';

interface Props {
  readOnly?: boolean;
}

const fields = {
  invoiceOption: {
    name: 'invoiceOption',
    validate: (val: string) => !val && 'Please select a membership before continuing'
  },
  discountId: {
    name: 'discountId',
    label: 'Discount Code',
    validate: (discountIds: string[]) => (val: string) => (val && ![ssmDiscount, ...discountIds].includes(val)) && 'Discount Code not recognized'
  }
}

export const MembershipPreview: React.FC<Props> = ({ readOnly }) => {
  const {
    invoiceOptionId: invoiceOptionIdParam,
    discountId: discountIdParam,
  } = useSearchQuery({
    invoiceOptionId: invoiceOptionParam,
    discountId: discountParam
  });

  const { allOptions, discounts } = useMembershipOptions(true);

  const [invoiceOption, setInvoiceOption] = React.useState(allOptions.find(({ id }) => id === invoiceOptionIdParam));
  const setSearchQuery = useSetSearchQuery();

  const [discountId, setDiscountId] = React.useState(discountIdParam);
  const updateDiscountId = React.useCallback((discountCode: string) => {
    setSearchQuery({ [discountParam]: discountCode });
    setDiscountId(discountCode);
  }, [setDiscountId, setSearchQuery]);

  React.useEffect(() => {
    const newOption = allOptions.find(({ id }) => id === invoiceOptionIdParam);
    setInvoiceOption(newOption);
    // If the newly selected plan has no discount configured, clear any SSM discount from the URL
    if (!newOption?.discountId && discountId === ssmDiscount) {
      updateDiscountId('');
    }
  }, [invoiceOptionIdParam, allOptions]);

  const selectedDiscount = discounts.find(d => d.id === discountId);

  const isNoneOption = invoiceOption?.id === noneInvoiceOption.id;
  const planHasDiscount = !!invoiceOption?.discountId;

  const singleMonth = invoiceOption?.quantity === 1;
  const isSsmDiscount = discountId === ssmDiscount;
  const renderDiscountSection = !readOnly || discountId;
  const total = useTotal(invoiceOption && Number(invoiceOption.amount), discountId);

  return !!invoiceOption && (
    <div id='cart-preview'>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Typography variant='subtitle1'>
            <strong>Name:</strong> {invoiceOption.name}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant='subtitle1'>
            <strong>Description:</strong> {invoiceOption.description || '-'}
          </Typography>
        </Grid>
        {!isNoneOption && (
          <>
            <Grid size={{ xs: 12 }}>
              <Typography id='subtotal' variant='subtitle1'>
                <strong>Subtotal:</strong> {
                `${numberAsCurrency(invoiceOption.amount)}${!invoiceOption.planId ? '' :
                ` / ${
                  singleMonth ? '' : `${invoiceOption.quantity} `} month${singleMonth ? '' : 's'}`}`
                }
              </Typography>
            </Grid>
            {renderDiscountSection && (
              <Grid size={{ xs: 12 }}>
                <Divider />
              </Grid>
            )}
            {renderDiscountSection && (
              <Grid size={{ xs: 12 }}>
                {readOnly ? <KeyValueItem id='discountId' label={fields.discountId.label}>{discountId}</KeyValueItem> : (
                  <>
                    <Typography variant='subtitle1'>
                      Qualify for a discount? Select one below or enter a discount code. Proof of applicable affiliation required during orientation.
                    </Typography>

                    <CheckboxInput
                      value={isSsmDiscount}
                      fieldName={ssmDiscount}
                      disabled={discountId && discountId !== ssmDiscount}
                      onChange={checked => updateDiscountId(checked ? ssmDiscount : '')}
                      label={'Student, Military, Senior 10% off'}
                    />
                    {isSsmDiscount && !planHasDiscount && (
                      <Typography variant='body2' style={{ color: 'red' }}>
                        Discount not available for selected membership plan.
                      </Typography>
                    )}

                    <TextInput
                      fieldName={fields.discountId.name}
                      label={fields.discountId.label}
                      onChange={updateDiscountId}
                      value={discountId}
                      disabled={isSsmDiscount}
                      validate={(val: string) => {
                        if (val === ssmDiscount && !planHasDiscount) return 'Discount not available for selected membership plan.';
                        return fields.discountId.validate(discounts.map(d => d.id))(val);
                      }}
                    />
                    {selectedDiscount &&
                      <Typography variant='subtitle1'>
                        {selectedDiscount.name}
                      </Typography>
                    }
                  </>
                )}
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <Divider />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' paragraph={true} id='total'>
                <strong>Total Due: </strong>
                {total}
              </Typography>
            </Grid>
          </>
        )}
      </Grid>
    </div>
  );
}

export const CartPreview: React.FC<Props> = ({ readOnly }) => {
  const {
    invoiceOptionId: invoiceOptionIdParam,
  } = useSearchQuery({
    invoiceOptionId: invoiceOptionParam,
  });

  return (
    <Paper style={{ position: 'fixed', padding: '1em' }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Typography variant='h4'>
            Selection
          </Typography>
        </Grid>

        {invoiceOptionIdParam ? (
          <Grid size={{ xs: 12 }}>
            <MembershipPreview readOnly={readOnly} />
          </Grid>
        ) : (
          <Grid size={{ xs: 12 }}>
            <Typography variant='h5'>
              Select a membership option
            </Typography>
          </Grid>
        )}

        {!readOnly && (
          <Grid size={{ xs: 12 }}>
            <FormField
              fieldName={fields.invoiceOption.name}
              validate={fields.invoiceOption.validate}
              value={invoiceOptionIdParam}
            />
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};
