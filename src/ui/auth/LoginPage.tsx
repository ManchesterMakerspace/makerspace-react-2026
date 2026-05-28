import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Hidden from '@mui/material/Hidden';

import LoginForm from "ui/auth/LoginForm";
import { Routing } from 'app/constants';
import Logo from "../../assets/FilledLaserableLogo.svg";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const goToRegister = React.useCallback(() => navigate(Routing.Root), []);
  return (
    <Grid container spacing={3}>
      <Hidden smDown>
        <Grid item md={6} sm={12} id="landing-page-graphic">
          <Logo style={{ width: '100%', height: '200px' }} alt="Manchester Makerspace" viewBox="0 0 960 580" />
        </Grid>
      </Hidden>

      <Grid item md={6} sm={12}>
        <Grid container justifyContent="center" spacing={3}>
          <Grid item xs={12}>
            <Paper style={{ minWidth: 275, padding: "1rem" }}>
                <LoginForm />
            </Paper>
          </Grid>
          <Grid item container xs={12} justifyContent="center" alignItems="center">
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
