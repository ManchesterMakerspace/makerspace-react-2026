import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { connect } from 'react-redux';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { completeProviderSignIn } from 'ui/auth/firebase';
import { firebaseLoginAction } from 'ui/auth/actions';
import { Routing } from 'app/constants';
import { ScopedThunkDispatch } from 'ui/reducer';

interface DispatchProps {
  firebaseLogin: (idToken: string) => Promise<void>;
}

interface OwnProps {
  history: any;
}

interface Props extends DispatchProps, OwnProps {}

interface State {
  error: string;
}

/**
 * FirebaseCallback
 * Rendered at /auth/callback after OAuth provider redirects back.
 * Completes the Firebase sign-in and redirects to the member portal.
 */
class FirebaseCallback extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: '' };
  }

  async componentDidMount() {
    try {
      const idToken = await completeProviderSignIn();
      await this.props.firebaseLogin(idToken);
      this.props.navigate(Routing.Members);
    } catch (err) {
      const message = (err && (err as any).message) || 'Sign in failed. Please try again.';
      this.setState({ error: message });
    }
  }

  render() {
    const { error } = this.state;
    return (
      <Grid container justify='center' alignItems='center' style={{ minHeight: '60vh' }}>
        <Grid item style={{ textAlign: 'center' }}>
          {error ? (
            <>
              <Typography variant='h6' color='error' gutterBottom>
                Sign in failed
              </Typography>
              <Typography variant='body2' color='textSecondary' gutterBottom>
                {error}
              </Typography>
              <Typography variant='body2'>
                <a href={Routing.Login}>← Back to login</a>
              </Typography>
            </>
          ) : (
            <>
              <CircularProgress style={{ marginBottom: 16 }} />
              <Typography variant='body2' color='textSecondary'>
                Completing sign in...
              </Typography>
            </>
          )}
        </Grid>
      </Grid>
    );
  }
}

const mapDispatchToProps = (dispatch: ScopedThunkDispatch): DispatchProps => ({
  firebaseLogin: (idToken: string) => dispatch(firebaseLoginAction(idToken)),
});

const ConnectedFirebaseCallback = connect(null, mapDispatchToProps)(FirebaseCallback);

// Wrap with router to get history prop
const FirebaseCallbackWithRouter: React.FC<{}> = () => {
  const navigate = useNavigate();
  return <ConnectedFirebaseCallback history={history} />;
};

export default FirebaseCallbackWithRouter;
