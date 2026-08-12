import * as React from "react";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

const logoUrl = "/assets/FilledLaserableLogo.svg";

const contactMailto =
  "mailto:contact@manchestermakerspace.org?subject=" +
  encodeURIComponent("Notify me when signup reopens");

/**
 * Shown in place of the signup workflow when the "Lock Out New Signups"
 * flag is enabled in Portal Settings → Security. Unauthenticated visitors
 * only — members already mid-signup are unaffected (see PublicRouting.tsx).
 */
const MaintenancePage: React.FC = () => {
  return (
    <Grid container spacing={3} justifyContent="center">
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Grid size={{ lg: 6 }}>
          <img
            src={logoUrl}
            style={{ width: "100%", height: "200px", objectFit: "contain" }}
            alt="Manchester Makerspace"
          />
        </Grid>
      </Box>

      <Grid size={{ xs: 12, md: 6 }}>
        <Paper style={{ minWidth: 275, padding: "1rem" }}>
          <Grid container spacing={3} justifyContent="center">
            <Grid size={{ xs: 12 }}>
              <Typography align="center" variant="h5" gutterBottom>
                We'll be right back
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" align="center">
                We're sorry, we are currently in maintenance mode. We are working on the
                member portal, send us an email to be notified when you can sign up again.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography align="center" variant="body1">
                <a href={contactMailto}>Email us</a> and we'll let you know as soon as
                signups reopen.
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default MaintenancePage;
