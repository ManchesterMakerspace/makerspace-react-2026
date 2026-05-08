import * as React from 'react';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import CircularProgress from '@material-ui/core/CircularProgress';


// Google "G" logo SVG
const GoogleLogo: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

// GitHub logo SVG
const GitHubLogo: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
    <path fill="currentColor" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Microsoft logo SVG
const MicrosoftLogo: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#00a4ef"/>
    <rect x="1" y="11" width="9" height="9" fill="#7fba00"/>
    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
  </svg>
);

// Apple logo SVG
const AppleLogo: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
    <path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49 192.5-49 31 0 108.2 2.6 168.6 81.3zm-194.3-86.5c-34.1-40.8-81.9-68-134.9-68-9.7 0-19.3 1.3-27.7 2.6 2.6-43.4 19.4-84.1 47.8-114.2 32.8-34.8 83.2-59.4 131.2-59.4 3.9 0 7.8.7 11.7 1.3-2 45.5-16.3 88.8-28.1 137.7z"/>
  </svg>
);

interface Props {
  onGoogleSignIn:    () => Promise<void>;
  onAppleSignIn:     () => Promise<void>;
  onGitHubSignIn:    () => Promise<void>;
  onMicrosoftSignIn: () => Promise<void>;
  loading: boolean;
  error: string;
  googleEnabled:    boolean;
  appleEnabled:     boolean;
  githubEnabled:    boolean;
  microsoftEnabled: boolean;
}

const FirebaseAuthButtons: React.FC<Props> = ({ onGoogleSignIn, onAppleSignIn, onGitHubSignIn, onMicrosoftSignIn, loading, error, googleEnabled, appleEnabled, githubEnabled, microsoftEnabled }) => {
  return (
    <div style={{ width: '100%' }}>
      {/* Google */}
      {googleEnabled && <Button
        id="google-sign-in"
        fullWidth
        variant="outlined"
        disabled={loading}
        onClick={onGoogleSignIn}
        style={{
          marginBottom: 8,
          textTransform: 'none',
          borderColor: '#dadce0',
          color: '#3c4043',
          fontWeight: 500,
          justifyContent: 'flex-start',
          paddingLeft: 16,
        }}
      >
        {loading
          ? <CircularProgress size={18} style={{ marginRight: 8 }} />
          : <GoogleLogo />
        }
        Continue with Google
      </Button>}

      {/* Apple */}
      {appleEnabled && (
        <Button
          id="apple-sign-in"
          fullWidth
          variant="outlined"
          disabled={loading}
          onClick={onAppleSignIn}
          style={{
            marginBottom: 8,
            textTransform: 'none',
            borderColor: '#000',
            color: '#000',
            fontWeight: 500,
            justifyContent: 'flex-start',
            paddingLeft: 16,
          }}
        >
          <AppleLogo />
          Continue with Apple
        </Button>
      )}

      {/* GitHub */}
      {githubEnabled && <Button
        id="github-sign-in"
        fullWidth
        variant="outlined"
        disabled={loading}
        onClick={onGitHubSignIn}
        style={{
          marginBottom: 8,
          textTransform: 'none',
          borderColor: '#24292e',
          color: '#24292e',
          fontWeight: 500,
          justifyContent: 'flex-start',
          paddingLeft: 16,
        }}
      >
        {loading ? <CircularProgress size={18} style={{ marginRight: 8 }} /> : <GitHubLogo />}
        Continue with GitHub
      </Button>}

      {/* Microsoft */}
      {microsoftEnabled && <Button
        id="microsoft-sign-in"
        fullWidth
        variant="outlined"
        disabled={loading}
        onClick={onMicrosoftSignIn}
        style={{
          marginBottom: 8,
          textTransform: 'none',
          borderColor: '#00a4ef',
          color: '#00a4ef',
          fontWeight: 500,
          justifyContent: 'flex-start',
          paddingLeft: 16,
        }}
      >
        {loading ? <CircularProgress size={18} style={{ marginRight: 8 }} /> : <MicrosoftLogo />}
        Continue with Microsoft
      </Button>}

      {error && (
        <Typography variant="caption" color="error" style={{ display: 'block', marginBottom: 8 }}>
          {error}
        </Typography>
      )}

      {(googleEnabled || appleEnabled || githubEnabled || microsoftEnabled) && <Divider style={{ margin: '16px 0' }}>
        <Typography variant="caption" color="textSecondary" style={{ padding: '0 8px' }}>
          or sign in with email
        </Typography>
      </Divider>}
    </div>
  );
};

export default FirebaseAuthButtons;
