import * as React from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";

import { Routing } from "app/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import ErrorMessage from "ui/common/ErrorMessage";
import { getRentalSpotPublic } from "api/rentals";

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

// Unauthenticated deep-link / QR landing page for a rental spot.
// Shown to anyone who scans a spot's link without being signed in.
// After signing in, the app redirects back to this same URL — which then
// renders RentalSpotDeepLink (the authenticated request/confirm flow).
const RentalSpotPublicInfo: React.FC = () => {
  const { spotId } = useParams<{ spotId: string }>();
  const navigate = useNavigate();

  const { data: spot, isRequesting: loading, error } = useReadTransaction(
    getRentalSpotPublic, { id: spotId }, !spotId, `rental-spot-public-${spotId}`
  );

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

  if (error) {
    return (
      <Grid container spacing={2} style={{ padding: 24 }}>
        <Grid size={{ xs: 12 }}>
          <ErrorMessage error={error} />
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
      </Grid>
    );
  }

  return (
    <Grid container spacing={2} style={{ padding: 24, maxWidth: 600 }}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h5" gutterBottom>{spot.number}</Typography>
        <Typography variant="body2" color="textSecondary">{spot.location}</Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <div style={{ padding: "12px 16px", border: "1px solid #ddd", borderRadius: "4px" }}>
          <Typography variant="body2"><strong>Type:</strong> {spot.rentalTypeDisplayName}</Typography>
          {spot.description && (
            <Typography variant="body2"><strong>Description:</strong> {spot.description}</Typography>
          )}
          {spot.invoiceOptionAmount != null && (
            <Typography variant="body2"><strong>Cost:</strong> ${spot.invoiceOptionAmount}/mo</Typography>
          )}
          {spot.requiresApproval && (
            <Typography variant="body2"><strong>Note:</strong> This rental requires admin approval before it becomes active.</Typography>
          )}
        </div>
      </Grid>

      <Grid size={{ xs: 12 }}>
        {spot.available ? (
          <Typography variant="body2" style={infoBoxStyle}>
            ✓ This spot is currently available.
          </Typography>
        ) : (
          <Typography variant="body2" style={warningBoxStyle}>
            This spot is currently unavailable — it may already be rented.
          </Typography>
        )}
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Button
          id="rental-public-signin"
          variant="contained" color="primary"
          onClick={() => navigate(Routing.Login)}
        >
          {spot.available
            ? "Sign in to rent this spot"
            : "Sign in to see available rentals"}
        </Button>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Typography variant="body2" color="textSecondary">
          Not a member yet? <Link component={RouterLink} to={Routing.SignUp}>Sign up</Link>
        </Typography>
      </Grid>
    </Grid>
  );
};

export default RentalSpotPublicInfo;
