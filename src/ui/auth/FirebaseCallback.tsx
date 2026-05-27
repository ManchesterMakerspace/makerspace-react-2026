import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { completeProviderSignIn } from 'ui/auth/firebase';
import { firebaseLoginAction } from 'ui/auth/actions';
import { Routing } from 'app/constants';
import { ScopedThunkDispatch } from 'ui/reducer';

const FirebaseCallback: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<ScopedThunkDispatch>();
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const idToken = await completeProviderSignIn();
        await dispatch(firebaseLoginAction(idToken));
        navigate(Routing.Members, { replace: true });
      } catch (err) {
        const message = (err && (err as any).message) || 'Sign in failed. Please try again.';
        setError(message);
      }
    })();
  }, []);

  return (
    <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '60vh' }}>
      <Grid item style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <Typography variant="h6" color="error" gutterBottom>Sign in failed</Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>{error}</Typography>
            <Typography variant="body2"><a href={Routing.Login}>← Back to login</a></Typography>
          </>
        ) : (
          <>
            <CircularProgress style={{ marginBottom: 16 }} />
            <Typography variant="body2" color="textSecondary">Completing sign in...</Typography>
          </>
        )}
      </Grid>
    </Grid>
  );
};

export default FirebaseCallback;
