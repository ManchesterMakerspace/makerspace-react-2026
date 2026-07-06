// @ts-nocheck
import * as React from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Link from "@mui/material/Link";

import { Routing } from "app/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import useRentalEligibility from "ui/rentals/useRentalEligibility";
import ErrorMessage from "ui/common/ErrorMessage";
import { getRentalSpot, createRental } from "api/rentals";
import { useAuthState } from "ui/reducer/hooks";

const infoBoxStyle: React.CSSProperties = {
  padding: "10px 14px", backgroundColor: "#e3f2fd",
  borderRadius: "4px", border: "1px solid #90caf9",
  marginBottom: "12px", fontSize: "0.875rem"
};

const warningBoxStyle: React.CSSProperties = {
  padding: "10px 14px", backgroundColor: "#fff3e0",
  borderRadius: "4px", border: "1px solid #ffb74d",
  marginBottom: "8px", fontSize: "0.875rem"
};

// Authenticated landing page for a rental spot deep link / QR code.
// Skips the browse/search step — drops the member straight into the
// confirm/sign-agreement flow for this specific spot.
const RentalSpotDeepLink: React.FC = () => {
  const { spotId } = useParams<{ spotId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();

  const [requestNotes, setRequestNotes] = React.useState<string>("");
  const [confirmOpen,  setConfirmOpen]  = React.useState(false);

  const eligibility = useRentalEligibility(currentUser);

  const { data: spot, isRequesting: loading, error: loadError } = useReadTransaction(
    getRentalSpot, { id: spotId }, !spotId, `rental-spot-deep-link-${spotId}`
  );

  const onSuccess = React.useCallback((response: any) => {
    const rentalId = response?.response?.data?.id || response?.data?.id || response?.id;
    setConfirmOpen(false);

    if (rentalId) {
      navigate(
        Routing.Documents
          .replace(Routing.PathPlaceholder.Resource, "rental")
          .replace(Routing.PathPlaceholder.ResourceId, rentalId)
      );
    } else {
      navigate(Routing.Rentals);
    }
  }, [navigate]);

  const { call: requestRental, isRequesting: requesting, error: requestError } = useWriteTransaction(
    createRental, onSuccess
  );

  const handleConfirm = React.useCallback(() => {
    if (!spot?.id) return;
    requestRental({ body: { rentalSpotId: spot.id, notes: requestNotes } });
  }, [spot, requestNotes, requestRental]);

  if (loading) {
    return (
      <Grid container spacing={2} style={{ padding: 24 }}>
        <Grid size={{ xs: 12 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" display="inline" style={{ marginLeft: 8 }}>
            Loading rental spot...
          </Typography>
        </Grid>
      </Grid>
    );
  }

  if (loadError) {
    return (
      <Grid container spacing={2} style={{ padding: 24 }}>
        <Grid size={{ xs: 12 }}>
          <ErrorMessage error={loadError} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Link component={RouterLink} to={Routing.Rentals}>Browse all rentals</Link>
        </Grid>
      </Grid>
    );
  }

  if (!spot) {
    return (
      <Grid container spacing={2} style={{ padding: 24 }}>
        <Grid size={{ xs: 12 }}>
          <Typography>This rental spot could not be found.</Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Link component={RouterLink} to={Routing.Rentals}>Browse all rentals</Link>
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={2} style={{ padding: 24, maxWidth: 600 }}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h5" gutterBottom>{spot.number}</Typography>
        <Typography variant="body2" color="textSecondary">{spot.location}</Typography>
      </Grid>

      {/* Eligibility warnings */}
      {!eligibility.loading && !eligibility.eligible && (
        <Grid size={{ xs: 12 }}>
          {eligibility.reasons.map((reason, i) => (
            <Typography key={i} variant="body2" style={warningBoxStyle}>⚠ {reason}</Typography>
          ))}
        </Grid>
      )}

      {!spot.available && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" style={warningBoxStyle}>
            This spot is currently unavailable — it may already be rented.
          </Typography>
          <Link component={RouterLink} to={Routing.Rentals}>Browse available rentals</Link>
        </Grid>
      )}

      {spot.available && (
        <>
          <Grid size={{ xs: 12 }}>
            <div style={{ padding: "12px 16px", border: "1px solid #ddd", borderRadius: "4px" }}>
              <Grid container spacing={1}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2"><strong>Type:</strong> {spot.rentalTypeDisplayName}</Typography>
                  {spot.description && (
                    <Typography variant="body2"><strong>Description:</strong> {spot.description}</Typography>
                  )}
                  {spot.invoiceOptionAmount != null && (
                    <Typography variant="body2"><strong>Cost:</strong> ${spot.invoiceOptionAmount}/mo</Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  {spot.requiresApproval ? (
                    <Typography variant="body2" style={infoBoxStyle}>
                      ⏳ This rental requires admin approval. No charge until approved and agreement is signed.
                    </Typography>
                  ) : (
                    <Typography variant="body2" style={infoBoxStyle}>
                      ✓ After confirming you will be asked to sign the rental agreement. An invoice will be generated once the agreement is signed.
                    </Typography>
                  )}
                </Grid>
                {spot.requiresApproval && (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth multiline rows={2}
                      label="Notes for admin (optional)"
                      value={requestNotes}
                      onChange={e => setRequestNotes(e.target.value)}
                      variant="outlined" size="small"
                    />
                  </Grid>
                )}
              </Grid>
            </div>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Button
              id="rental-deep-link-continue"
              variant="contained" color="primary"
              disabled={!eligibility.eligible || eligibility.loading}
              onClick={() => setConfirmOpen(true)}
            >
              {spot.requiresApproval ? "Submit Request" : "Confirm Rental"}
            </Button>
          </Grid>
        </>
      )}

      {confirmOpen && (
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>
            {spot.requiresApproval ? "Confirm Rental Request" : "Confirm Rental"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>{spot.number}</strong> — {spot.location}
                </Typography>
                {spot.invoiceOptionAmount != null && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Cost:</strong> ${spot.invoiceOptionAmount}/mo
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12 }}>
                {spot.requiresApproval ? (
                  <Typography variant="body2" style={infoBoxStyle}>
                    Your request will be sent to an admin for approval. You will be notified by email and Slack once reviewed.
                  </Typography>
                ) : (
                  <Typography variant="body2" style={infoBoxStyle}>
                    You will be directed to review and sign the rental agreement. An invoice will be generated after signing.
                  </Typography>
                )}
              </Grid>
            </Grid>
            <ErrorMessage error={requestError} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} disabled={requesting}>Cancel</Button>
            <Button
              id="rental-deep-link-confirm"
              variant="contained" color="primary"
              disabled={requesting}
              onClick={handleConfirm}
            >
              {requesting ? "Processing..." : (spot.requiresApproval ? "Submit Request" : "Confirm & Sign Agreement")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Grid>
  );
};

export default RentalSpotDeepLink;
