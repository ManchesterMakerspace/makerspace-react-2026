import * as React from "react";
import Typography from "@mui/material/Typography";
import Grid from '@mui/material/Grid';
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Hidden from "@mui/material/Hidden";
import useTheme from "@mui/material/styles/useTheme";
import useMediaQuery from "@mui/material/useMediaQuery";

import { InvoiceOption } from "makerspace-ts-api-client";
import { discountParam, invoiceOptionParam, MembershipOptions } from '../MembershipOptions';
import { useSearchQuery, useSetSearchQuery } from "hooks/useSearchQuery";
import { useMembershipOptions } from "hooks/useMembershipOptions";
import { Form } from "components/Form/Form";
import { CartPreview } from "../SignUpWorkflow/CartPreview";

interface Props {
  onSubmit(invoiceOption: InvoiceOption, discountId?: string): void;
  showNoneOption?: boolean
}

export const MembershipSelectForm: React.FC<Props> = ({ onSubmit, showNoneOption, children }) => {
  const {
    invoiceOptionId: invoiceOptionIdParam,
    discountId: discountIdParam,
  } = useSearchQuery({
    invoiceOptionId: invoiceOptionParam,
    discountId: discountParam
  });

  const { allOptions, promotionOptions, defaultOption } = useMembershipOptions(true);

  React.useEffect(() => {
    setInvoiceOption(allOptions.find(({ id }) => id === invoiceOptionIdParam));
  }, [invoiceOptionIdParam, allOptions]);

  const [invoiceOption, setInvoiceOption] = React.useState(allOptions.find(({ id }) => id === invoiceOptionIdParam));
  const setSearchQuery = useSetSearchQuery();
  const updateInvoiceOption = React.useCallback((newOpt: InvoiceOption) => {
    setSearchQuery({ [invoiceOptionParam]: newOpt.id });
    setInvoiceOption(newOpt);
  }, [setSearchQuery, setInvoiceOption]);

  React.useEffect(() => {
    const firstSelection = promotionOptions[0] || defaultOption;
    !invoiceOptionIdParam && firstSelection && updateInvoiceOption(firstSelection);
  }, [defaultOption]);

  const theme = useTheme();
  const isXsmMedia = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Form
      id="membership-select-form"
      onSubmit={() => onSubmit(invoiceOption, discountIdParam)}
      hideFooter={true}
    >
      <Grid container spacing={2} direction={isXsmMedia ? "row-reverse" : "row"}>
        <Grid item xs={12} md={8}>
          <Box>
            <Typography variant="body1">
              {invoiceOption ? "Confirm" : "Select"} your membership selection. If you have a discount code, please enter it now.
            </Typography>
          </Box>
          <MembershipOptions onSelect={updateInvoiceOption} showNoneOption={showNoneOption} />
        </Grid>
          <Hidden smDown><Divider orientation="vertical" flexItem /></Hidden>
          <Grid item xs={12} md={3}>
            <CartPreview />
          </Grid>
      </Grid>
      <>{children}</>
    </Form>
  );
};
