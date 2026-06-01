import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from "../../assets/FilledLaserableLogo.svg?url";

import Grid from "@mui/material/Grid";
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

import LoginForm from "ui/auth/LoginForm";
import { Routing } from 'app/constants';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const goToRegister = React.useCallback(() => navigate(Routing.Root), []);
  return (
    <Grid container spacing={3}>
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Grid size={{ sm: 12, md: 6 }} id="landing-page-graphic">
          <img
            src={logoUrl}
            style={{ width: '100%', height: '200px', objectFit: 'contain' }}
            alt="Manchester Makerspace"
          />
        </Grid>
      </Box>

      <Grid size={{ sm: 12, md: 6 }}>
        <Grid container justifyContent="center" spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Paper style={{ minWidth: 275, padding: "1rem" }}>
                <LoginForm />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }} container justifyContent="center" alignItems="center">
            <Button id="auth-toggle" variant="outlined" color="secondary" fullWidth onClick={goToRegister}>
              Register
              </Button>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  )
}

export default LoginPage;
