import * as React from "react";
import { useNavigate } from 'react-router-dom';
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

import { updateRental, getRental } from "makerspace-ts-api-client";
import { buildProfileRouting } from "../member/utils";
import { useAuthState } from "../reducer/hooks";
import useWriteTransaction from "../hooks/useWriteTransaction";
import useReadTransaction from "../hooks/useReadTransaction";
import DocumentForm from "./DocumentForm";
import { Documents, documents } from "./Document";
import { useScrollToHeader } from "../hooks/useScrollToHeader";
import { declineRentalAgreement } from "api/rentals";
import ErrorMessage from "ui/common/ErrorMessage";

const rentalAgreement = documents[Documents.RentalAgreement];

const RentalAgreement: React.FC<{ rentalId: string }> = ({ rentalId }) => {
  const navigate = useNavigate();
  const { currentUser: { id: currentUserId } } = useAuthState();
  const { executeScroll } = useScrollToHeader();
  const [declineConfirmOpen, setDeclineConfirmOpen] = React.useState(false);

  const { data: rental, isRequesting: rentalLoading } = useReadTransaction(
    getRental, { id: rentalId }, undefined, `rental-agreement-${rentalId}`
  );

  const rentalStatus = (rental as any)?.status;
  const canSign = !rentalLoading && rentalStatus === "pending_agreement";

  const onSignSuccess = React.useCallback(() => {
    executeScroll();
    // Redirect to invoices tab after signing
    navigate(`${buildProfileRouting(currentUserId)}/invoices`);
  }, [history, executeScroll, currentUserId]);

  const onDeclineSuccess = React.useCallback(() => {
    setDeclineConfirmOpen(false);
    // Redirect back to profile rentals tab
    navigate(`${buildProfileRouting(currentUserId)}/rentals`);
  }, [history, currentUserId]);

  const {
    error: signError,
    isRequesting: signing,
    call: sign
  } = useWriteTransaction(updateRental, onSignSuccess);

  const {
    error: declineError,
    isRequesting: declining,
    call: decline
  } = useWriteTransaction(declineRentalAgreement, onDeclineSuccess);

  const onContractAccept = React.useCallback(async (signature: string) => {
    await sign({ id: rentalId, body: { signature } });
  }, [sign, rentalId]);

  const onDeclineConfirm = React.useCallback(async () => {
    await decline({ id: rentalId });
  }, [decline, rentalId]);

  if (!rentalLoading && rentalStatus && rentalStatus !== "pending_agreement") {
    return (
      <Paper style={{ padding: "32px", maxWidth: "600px", margin: "auto" }}>
        <Typography variant="h6" gutterBottom>Agreement Not Available</Typography>
        <Typography variant="body1" gutterBottom>
          {rentalStatus === "agreement_denied" && "This rental was voided because the agreement was not signed."}
          {rentalStatus === "active" && "This rental agreement has already been signed."}
          {rentalStatus === "cancelled" && "This rental has been cancelled."}
          {!["agreement_denied", "active", "cancelled"].includes(rentalStatus) && `This rental cannot be signed at this stage (status: ${rentalStatus}).`}
        </Typography>
        <Button variant="outlined" onClick={() => navigate(buildProfileRouting(currentUserId) + "/rentals")}>
          Return to Rentals
        </Button>
      </Paper>
    );
  }

  return (
    <Paper>
      {/* I Do Not Agree button — prominent at top */}
      <Grid container justify="flex-end" style={{ padding: "16px 16px 0" }}>
        <Button
          id="rental-agreement-decline"
          variant="outlined"
          color="secondary"
          onClick={() => setDeclineConfirmOpen(true)}
          disabled={signing}
        >
          I Do Not Agree
        </Button>
      </Grid>

      <DocumentForm
        error={signError}
        loading={signing}
        doc={{
          ...rentalAgreement,
          src: typeof rentalAgreement.src === "function"
            ? rentalAgreement.src(rentalId)
            : rentalAgreement.src
        }}
        onAccept={onContractAccept}
        requestSignature={true}
      />

      {/* Decline confirmation dialog */}
      <Dialog open={declineConfirmOpen} onClose={() => setDeclineConfirmOpen(false)}>
        <DialogTitle>Cancel Rental Agreement</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you do not agree to the rental agreement?
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            If you decline, your rental claim will be <strong>voided</strong> and no invoice will be generated. The spot will become available for other members.
          </Typography>
          <Typography variant="body2" color="textSecondary">
            You can always request a new rental in the future.
          </Typography>
          <ErrorMessage error={declineError} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeclineConfirmOpen(false)} disabled={declining}>
            Go Back
          </Button>
          <Button
            id="rental-agreement-decline-confirm"
            variant="contained"
            color="secondary"
            disabled={declining}
            onClick={onDeclineConfirm}
          >
            {declining ? "Cancelling..." : "Yes, Void My Rental"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default RentalAgreement;
