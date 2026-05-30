import * as React from "react";
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { Member } from "makerspace-ts-api-client";
import axios from "axios";

import { RentalSpot } from "app/entities/rentalSpot";
import { ActionButton } from "ui/common/ButtonRow";
import FormModal from "ui/common/FormModal";
import useReadTransaction from "ui/hooks/useReadTransaction";
import MemberSearchInput from "ui/common/MemberSearchInput";
import { adminListRentalSpots } from "api/rentals";

interface Props {
  member?:  Member;
  onCreate: () => void;
}

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const CreateRentalAdmin: React.FC<Props> = ({ member, onCreate }) => {
  const [isOpen,          setIsOpen]          = React.useState(false);
  const [selectedSpotId,  setSelectedSpotId]  = React.useState("");
  const [memberId,        setMemberId]        = React.useState(member?.id || "");
  const [notes,           setNotes]           = React.useState("");
  const [agreementSigned, setAgreementSigned] = React.useState(false);
  const [isRequesting,    setIsRequesting]    = React.useState(false);
  const [error,           setError]           = React.useState("");

  const { data: spots = [], isRequesting: spotsLoading } = useReadTransaction(
    adminListRentalSpots, {}, !isOpen, "admin-create-rental-spots"
  );

  const selectedSpot = (spots as RentalSpot[]).find((s: RentalSpot) => s.id === selectedSpotId);

  const spotsByType: Record<string, RentalSpot[]> = (spots as RentalSpot[]).reduce(
    (acc: Record<string, RentalSpot[]>, spot: RentalSpot) => {
      const typeName = spot.rentalTypeDisplayName || "Other";
      if (!acc[typeName]) acc[typeName] = [];
      acc[typeName].push(spot);
      return acc;
    }, {}
  );

  const handleClose = () => {
    setIsOpen(false);
    setSelectedSpotId("");
    setNotes("");
    setAgreementSigned(false);
    setError("");
    if (!member) setMemberId("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!selectedSpotId) { setError("Please select a rental spot."); return; }
    if (!memberId)       { setError("Please select a member."); return; }

    setIsRequesting(true);
    try {
      await axios.post("/api/admin/rentals", {
        rental_spot_id:   selectedSpotId,
        member_id:        memberId,
        notes,
        contract_on_file: agreementSigned,
        number:           selectedSpot?.number || "",
        description:      selectedSpot?.description || "",
        status:           "active",
      }, {
        withCredentials: true,
        headers: { "X-XSRF-TOKEN": getCsrfToken(), "Content-Type": "application/json" }
      });
      handleClose();
      onCreate();
    } catch (err) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err.message
        || "An error occurred.";
      setError(msg);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <>
      <ActionButton
        id="rentals-list-create"
        color="primary"
        variant="contained"
        label="Create New Rental"
        onClick={() => setIsOpen(true)}
      />
      <FormModal
        id="admin-create-rental"
        isOpen={isOpen}
        title="Create New Rental"
        closeHandler={handleClose}
        onSubmit={handleSubmit}
        submitText="Create Rental"
        loading={isRequesting}
        error={error}
      >
        <Grid container spacing={2}>
          {/* Member */}
          <Grid size={{ xs: 12 }}>
            {member ? (
              <Typography variant="body2">
                <strong>Member:</strong> {member.firstname} {member.lastname}
              </Typography>
            ) : (
              <MemberSearchInput
                name="admin-create-rental-member-search"
                placeholder="Search by name or email"
                onChange={selection => setMemberId(selection?.value || "")}
              />
            )}
          </Grid>

          {/* Spot selector */}
          <Grid size={{ xs: 12 }}>
            <TextField
              select fullWidth required
              label="Select a Rental Spot"
              inputProps={{ id: "admin-create-rental-spot-select" }}
              value={selectedSpotId}
              onChange={e => setSelectedSpotId(e.target.value)}
              variant="outlined"
              disabled={spotsLoading}
              helperText={spotsLoading ? "Loading spots..." : "Admin can select any spot regardless of availability"}
            >
              <MenuItem value="">— Choose a spot —</MenuItem>
              {Object.entries(spotsByType).map(([typeName, typeSpots]) => [
                <MenuItem key={`header-${typeName}`} disabled
                  style={{ fontWeight: "bold", opacity: 1, color: "#333" }}>
                  {typeName}
                </MenuItem>,
                ...(typeSpots as RentalSpot[]).map((spot: RentalSpot) => (
                  <MenuItem key={spot.id} value={spot.id} style={{ paddingLeft: "24px" }}>
                    {spot.number} — {spot.location}
                    {spot.invoiceOptionAmount != null && ` ($${spot.invoiceOptionAmount}/mo)`}
                    {!spot.available && " (unavailable)"}
                  </MenuItem>
                ))
              ])}
            </TextField>
          </Grid>

          {/* Spot details */}
          {selectedSpot && (
            <Grid size={{ xs: 12 }}>
              <div style={{ padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <Typography variant="body2"><strong>Number:</strong> {selectedSpot.number}</Typography>
                <Typography variant="body2"><strong>Location:</strong> {selectedSpot.location}</Typography>
                <Typography variant="body2"><strong>Type:</strong> {selectedSpot.rentalTypeDisplayName}</Typography>
                {selectedSpot.description && (
                  <Typography variant="body2"><strong>Description:</strong> {selectedSpot.description}</Typography>
                )}
                {selectedSpot.invoiceOptionAmount != null && (
                  <Typography variant="body2">
                    <strong>Billing:</strong> ${selectedSpot.invoiceOptionAmount}/mo — {selectedSpot.invoiceOptionName}
                  </Typography>
                )}
              </div>
            </Grid>
          )}

          {/* Notes */}
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth multiline rows={2}
              label="Notes (optional)"
              id="admin-create-rental-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              variant="outlined"
            />
          </Grid>

          {/* Agreement signed */}
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  id="admin-create-rental-agreement"
                  checked={agreementSigned}
                  onChange={e => setAgreementSigned(e.target.checked)}
                  color="primary"
                />
              }
              label="Rental agreement has been signed (paper or verbal confirmation)"
            />
          </Grid>
        </Grid>
      </FormModal>
    </>
  );
};

export default CreateRentalAdmin;
