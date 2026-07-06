// @ts-nocheck
import * as React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

/**
 * Inline rental agreement for use within the claim flow.
 * Shows the agreement text and a checkbox to confirm.
 * When checked, calls onSigned().
 *
 * Note: This is a simplified inline version. The full agreement document
 * is available via the existing RentalAgreement component at /agreements/rental/:id
 * which is linked after the rental is created.
 */
interface Props {
  onSigned: () => void;
  signed:   boolean;
}

const RentalAgreementInline: React.FC<Props> = ({ onSigned, signed }) => {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <div style={{
          border: "1px solid #ddd", borderRadius: "4px",
          padding: "16px", maxHeight: "300px", overflowY: "auto",
          backgroundColor: "#fafafa", fontSize: "0.875rem", lineHeight: 1.6
        }}>
          <Typography variant="subtitle2" gutterBottom><strong>Manchester Makerspace Rental Agreement</strong></Typography>
          <Typography variant="body2" paragraph>
            By claiming this rental, you agree to the following terms:
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>1. Payment.</strong> Rental fees are due upon claiming the space. Your rental is not valid until payment has been received. Recurring rentals will be billed automatically on the subscription start date.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>2. Use of Space.</strong> The rental space is to be used only for lawful purposes consistent with Manchester Makerspace's Code of Conduct and membership agreement. You may not sublease or share the space.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>3. Condition.</strong> You agree to maintain the rental space in good condition and return it in the same or better condition. Any damage beyond normal wear and tear may result in additional charges.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>4. Access.</strong> Access to your rental space is subject to your active membership. If your membership lapses, access to your rental space may be suspended.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>5. Cancellation.</strong> You may cancel your rental at any time. If you have vacated the space, cancellation is immediate. If you have not vacated, your rental will remain active until the end of the current billing period, after which no further charges will be made.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>6. Abandoned Items.</strong> Items left in a rental space after cancellation may be considered abandoned and disposed of at the discretion of Manchester Makerspace.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>7. Liability.</strong> Manchester Makerspace is not responsible for loss, theft, or damage to items stored in rental spaces. Members store items at their own risk.
          </Typography>
          <Typography variant="body2">
            <strong>8. Termination.</strong> Manchester Makerspace reserves the right to terminate a rental agreement with reasonable notice for violation of these terms or the membership agreement.
          </Typography>
        </div>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <FormControlLabel
          control={
            <Checkbox
              id="member-rental-agreement-checkbox"
              checked={signed}
              onChange={e => e.target.checked && onSigned()}
              color="primary"
            />
          }
          label="I have read and agree to the Manchester Makerspace Rental Agreement"
        />
      </Grid>
    </Grid>
  );
};

export default RentalAgreementInline;
