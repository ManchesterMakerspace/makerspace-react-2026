import * as React from "react";
import { useNavigate } from 'react-router-dom';
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { Member } from "makerspace-ts-api-client";

import { RentalSpot } from "app/entities/rentalSpot";
import { Routing } from "app/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import useRentalEligibility from "ui/rentals/useRentalEligibility";
import ErrorMessage from "ui/common/ErrorMessage";
import { listRentalSpots, listRentalTypes, createRental } from "api/rentals";

interface Props {
  member:          Member;
  onRentalCreated: () => void;
}

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

const RentalSpotsBrowser: React.FC<Props> = ({ member, onRentalCreated }) => {
  const navigate = useNavigate();
  const [selectedRentalId, setSelectedRentalId] = React.useState<string>("");
  const [requestNotes,     setRequestNotes]      = React.useState<string>("");
  const [confirmOpen,      setConfirmOpen]        = React.useState(false);

  const eligibility = useRentalEligibility(member);

  const { data: rentals = [], isRequesting: rentalsLoading } = useReadTransaction(
    listRentalSpots, { available: "true" }, undefined, "rental-spots-browser"
  );

  const onSuccess = React.useCallback((response: any) => {
    console.log("[RentalSpotsBrowser] onSuccess response:", JSON.stringify(response?.response?.data));
    const rentalId = response?.response?.data?.id || response?.data?.id || response?.id;
    setSelectedRentalId("");
    setRequestNotes("");
    setConfirmOpen(false);
    onRentalCreated();

    // Redirect to agreement page if we have a rental ID
    if (rentalId) {
      navigate(
        Routing.Documents
          .replace(Routing.PathPlaceholder.Resource, "rental")
          .replace(Routing.PathPlaceholder.ResourceId, rentalId)
      );
    }
  }, [onRentalCreated, history]);

  const { call: requestRental, isRequesting: requesting, error: requestError } = useWriteTransaction(
    createRental, onSuccess
  );

  const handleConfirm = React.useCallback(() => {
    if (!selectedRentalId) return;
    requestRental({ body: { rentalSpotId: selectedRentalId, notes: requestNotes } });
  }, [selectedRentalId, requestNotes, requestRental]);

  const selectedRental = (rentals as RentalSpot[]).find((s: RentalSpot) => s.id === selectedRentalId);

  // Group rentals by type for the dropdown
  const rentalsByType: Record<string, RentalSpot[]> = (rentals as RentalSpot[]).reduce(
    (acc: Record<string, RentalSpot[]>, rental: RentalSpot) => {
      const typeName = rental.rentalTypeDisplayName || "Other";
      if (!acc[typeName]) acc[typeName] = [];
      acc[typeName].push(rental);
      return acc;
    }, {}
  );

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h6" gutterBottom>Request a New Rental</Typography>
        <Divider style={{ marginBottom: "16px" }} />
      </Grid>

      {/* Eligibility warnings */}
      {!eligibility.loading && !eligibility.eligible && (
        <Grid size={{ xs: 12 }}>
          {eligibility.reasons.map((reason, i) => (
            <Typography key={i} variant="body2" style={warningBoxStyle}>⚠ {reason}</Typography>
          ))}
        </Grid>
      )}

      {rentalsLoading && (
        <Grid size={{ xs: 12 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" display="inline" style={{ marginLeft: 8 }}>Loading available rentals...</Typography>
        </Grid>
      )}

      {!rentalsLoading && rentals.length === 0 && (
        <Grid size={{ xs: 12 }}>
          <Typography color="textSecondary">No rentals are currently available.</Typography>
        </Grid>
      )}

      {!rentalsLoading && rentals.length > 0 && (
        <>
          {/* Rental selector dropdown */}
          <Grid size={{ xs: 12, sm: 8, md: 6 }}>
            <TextField
              select fullWidth
              id="member-rental-spot-select"
              label="Select an Available Rental"
              value={selectedRentalId}
              onChange={e => setSelectedRentalId(e.target.value)}
              variant="outlined"
              disabled={!eligibility.eligible || eligibility.loading}
              helperText="Choose the rental you'd like"
            >
              <MenuItem value="">— Choose a rental —</MenuItem>
              {Object.entries(rentalsByType).map(([typeName, typeRentals]) => [
                <MenuItem key={`header-${typeName}`} disabled
                  style={{ fontWeight: "bold", opacity: 1, color: "#333" }}>
                  {typeName}
                </MenuItem>,
                ...(typeRentals as RentalSpot[]).map((rental: RentalSpot) => (
                  <MenuItem key={rental.id} value={rental.id} style={{ paddingLeft: "24px" }}>
                    {rental.number} — {rental.location}
                    {rental.invoiceOptionAmount != null && ` ($${rental.invoiceOptionAmount}/mo)`}
                    {rental.requiresApproval && " ⏳ Approval required"}
                  </MenuItem>
                ))
              ])}
            </TextField>
          </Grid>

          {/* Details panel */}
          {selectedRental && (
            <Grid size={{ xs: 12 }}>
              <div style={{ padding: "12px 16px", border: "1px solid #ddd", borderRadius: "4px", marginTop: "4px" }}>
                <Grid container spacing={1}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2"><strong>Rental:</strong> {selectedRental.number}</Typography>
                    <Typography variant="body2"><strong>Location:</strong> {selectedRental.location}</Typography>
                    <Typography variant="body2"><strong>Type:</strong> {selectedRental.rentalTypeDisplayName}</Typography>
                    {selectedRental.description && (
                      <Typography variant="body2"><strong>Description:</strong> {selectedRental.description}</Typography>
                    )}
                    {selectedRental.invoiceOptionAmount != null && (
                      <Typography variant="body2"><strong>Cost:</strong> ${selectedRental.invoiceOptionAmount}/mo</Typography>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {selectedRental.requiresApproval ? (
                      <Typography variant="body2" style={infoBoxStyle}>
                        ⏳ This rental requires admin approval. No charge until approved and agreement is signed.
                      </Typography>
                    ) : (
                      <Typography variant="body2" style={infoBoxStyle}>
                        ✓ After confirming you will be asked to sign the rental agreement. An invoice will be generated once the agreement is signed.
                      </Typography>
                    )}
                  </Grid>
                  {selectedRental.requiresApproval && (
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
          )}

          {/* Confirm button */}
          {selectedRental && (
            <Grid size={{ xs: 12 }}>
              <Button
                id="member-rental-continue"
                variant="contained" color="primary"
                disabled={!selectedRentalId || !eligibility.eligible || eligibility.loading}
                onClick={() => setConfirmOpen(true)}
              >
                {selectedRental.requiresApproval ? "Submit Request" : "Confirm Rental"}
              </Button>
            </Grid>
          )}
        </>
      )}

      {/* Confirmation dialog */}
      {confirmOpen && selectedRental && (
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>
            {selectedRental.requiresApproval ? "Confirm Rental Request" : "Confirm Rental"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>{selectedRental.number}</strong> — {selectedRental.location}
                </Typography>
                {selectedRental.description && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {selectedRental.description}
                  </Typography>
                )}
                {selectedRental.invoiceOptionAmount != null && (
                  <Typography variant="body2" gutterBottom>
                    <strong>Cost:</strong> ${selectedRental.invoiceOptionAmount}/mo
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12 }}>
                {selectedRental.requiresApproval ? (
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
              id="member-rental-confirm"
              variant="contained" color="primary"
              disabled={requesting}
              onClick={handleConfirm}
            >
              {requesting ? "Processing..." : (selectedRental.requiresApproval ? "Submit Request" : "Confirm & Sign Agreement")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Grid>
  );
};

export default RentalSpotsBrowser;
