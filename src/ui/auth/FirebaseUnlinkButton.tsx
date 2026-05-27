import * as React from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { Member } from 'makerspace-ts-api-client';

interface Props {
  member: Member;
  onSuccess?: () => void;
}

const FirebaseUnlinkButton: React.FC<Props> = ({ member, onSuccess }) => {
  const [open,    setOpen]    = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);

  const hasFirebase = !!(member as any).firebase_uid;

  if (!hasFirebase) return null;

  const getCsrfToken = (): string => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/firebase_unlink/${member.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
      });
      if (res.ok) {
        setOpen(false);
        setSuccess(true);
        onSuccess && onSuccess();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || 'Failed to unlink Firebase account.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={`Unlink Google/Apple login from ${member.email} — member will need to use email + password`}>
        <span>
          <Button
            key='firebase-unlink'
            variant='outlined'
            color='secondary'
            disabled={loading}
            onClick={() => setOpen(true)}
            startIcon={<LinkOffIcon />}
            style={{ marginRight: '.25em' }}
          >
            Unlink SSO
          </Button>
        </span>
      </Tooltip>

      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Unlink Google / Apple Login</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Remove the Google/Apple sign-in link from <strong>{member.email}</strong>?
          </Typography>
          <Typography variant='body2' color='textSecondary'>
            The member's account will still exist. They can recover access via
            <strong> Forgot Password</strong> on the login page, which will send them
            a link to set an email + password. Their data is not affected.
          </Typography>
          {error && (
            <Typography variant='body2' color='error' style={{ marginTop: 8 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button color='secondary' variant='contained' disabled={loading} onClick={handleUnlink}>
            {loading ? <CircularProgress size={16} /> : 'Unlink'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        message={`Google/Apple login unlinked from ${member.email}`}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default FirebaseUnlinkButton;
