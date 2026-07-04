/**
 * Pre-fetch: 1. InvoiceOptions
 * Show loading while fetching
 */

 import * as React from 'react';
import { useNavigate } from 'react-router-dom';
  
 import Grid from "@mui/material/Grid";
 import Paper from '@mui/material/Paper';
 import Button from "@mui/material/Button";
 import Typography from '@mui/material/Typography';
import Box from "@mui/material/Box";
 
 import logoUrl from "../../assets/FilledLaserableLogo.svg";
 
 import { Routing } from "app/constants";
 import { MembershipOptions } from './MembershipOptions';
 import { useGoToSignUp } from "./useGoToSignUp";
import { useMembershipOptions } from 'hooks/useMembershipOptions';
import { AppLoading } from 'components/AppLoading/AppLoading';
 
 const LandingPage: React.FC = () => {
   const navigate = useNavigate();
   const goToSignIn = () => navigate({ pathname: Routing.Login });
   const goToSignUp = useGoToSignUp();

  const { loading } = useMembershipOptions();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Prefetch membership options with a nicely styled loading display
  if (loading || !mounted) {
    return <AppLoading isLoading={true} />;
  }
 
  return (
    <>
      <Grid container spacing={3} justifyContent="center">
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Grid size={{ lg: 6 }}>
            <img src={logoUrl} style={{ width: "100%", height: "200px" }} alt="Manchester Makerspace" />
          </Grid>
        </Box>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper style={{ minWidth: 275, padding: "1rem" }}>
            <Grid container spacing={3} justifyContent="center">
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1">
                  Manchester Makerspace is a non-profit collaborative organization of members who maintain a shared
                  workspace, tooling, and skills in the Manchester, NH community. We provide access to shared
                  resources, training, and mentorship for the benefit of Manchester’s local entrepreneurs, makers, and
                  artists of all ages.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Button color="primary" size="large" variant="contained" onClick={() => goToSignUp()}>Sign Up</Button>
              </Grid> 

              <Grid size={{ xs: 12 }}>
                <Button color="primary" variant="outlined" onClick={goToSignIn}>Sign In</Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
      {/** Below the fold */}
      <Grid container spacing={3} justifyContent="center">
        <Grid size={{ xs: 12 }} style={{ marginTop: "2rem" }}>
          <Typography align="center" variant="h4">Our Membership Options</Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 10 }}>
          <MembershipOptions onSelect={goToSignUp} shortForm={false} />
        </Grid>
      </Grid>
    </>
  );
};

export default LandingPage;
 