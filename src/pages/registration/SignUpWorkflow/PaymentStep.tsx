import * as React from "react";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";

import { FormContextConsumer, FormContextProvider } from "components/Form/FormContext";
import { useSetSearchQuery } from "hooks/useSearchQuery";
import { CreditCardConsumer } from "../PaymentMethods/CreditCardForm";
import { PaymentMethods, handleSubmit, selectedFieldName, validatePaymentMethods } from "../PaymentMethods";
import { PaymentMethodsProvider } from "../PaymentMethods/PaymentMethodsContext";
import { CartPreview } from "./CartPreview";

export const PaymentStep: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const setSearch = useSetSearchQuery();

  return (
    <PaymentMethodsProvider>
    <CreditCardConsumer>
      {({ submit: submitCC, validate: validateCC }) => (
        <FormContextProvider 
          validator={validatePaymentMethods(validateCC)}
          onSubmit={handleSubmit(setSearch, submitCC)}
        >
          <Grid container spacing={2} justifyContent="center">
            <Grid size={{ xs: 11, md: 8 }}>
              <Grid container spacing={2} justifyContent="center">
                <Grid size={{ xs: 12 }}>
                  <Box>
                    <FormContextConsumer>
                      {({ values }) => (
                        <Typography variant="body1">
                          {values[selectedFieldName] ? "Select or add" : "Add"} a payment method for membership. 
                          This payment method will be used for recurring membership payments unless changed through Account Settings.
                        </Typography>
                      )}
                    </FormContextConsumer>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <PaymentMethods />
                </Grid>

                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  {children}
                </Box>

                <Grid size={{ xs: 12 }}>
                  <div>
                    <Typography variant="body1">
                      <strong>How recurring payments work:</strong>
                  </Typography>
                  </div>
                  <div>
                    <Typography variant="body1">
                      You authorize regularly scheduled charges to your selected payment method. You will be charged the
                      subscription amount each billing period. A receipt will be emailed to you and each charge will appear on
                      your statement. No prior notification will be provided unless the date or amount changes,
                      in which case you will receive notice from us at least 10 days prior to the payment being collected.
                    </Typography>
                  </div>
                </Grid>
              </Grid>
            </Grid>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Divider orientation="vertical" flexItem />
              <Grid size={{ md: 3 }}>
                <CartPreview readOnly={true} />
                {children}
              </Grid>
            </Box>
          </Grid>
        </FormContextProvider>
      )}
    </CreditCardConsumer>
    </PaymentMethodsProvider>
  );
};
