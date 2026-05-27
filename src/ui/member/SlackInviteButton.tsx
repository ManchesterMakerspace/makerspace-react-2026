import * as React from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import { Member } from 'makerspace-ts-api-client';

// Slack logo mark SVG
const SlackIcon: React.FC = () => (
  <svg width='16' height='16' viewBox='0 0 54 54' xmlns='http://www.w3.org/2000/svg'>
    <path fill='#36C5F0' d='M19.712 0C17.284 0 15.31 1.977 15.31 4.408s1.974 4.408 4.402 4.408h4.402V4.408C24.114 1.977 22.14 0 19.712 0z'/>
    <path fill='#36C5F0' d='M19.712 11.76H4.402C1.974 11.76 0 13.737 0 16.168s1.974 4.408 4.402 4.408h15.31c2.428 0 4.402-1.977 4.402-4.408s-1.974-4.408-4.402-4.408z'/>
    <path fill='#2EB67D' d='M54 16.168c0-2.431-1.974-4.408-4.402-4.408s-4.402 1.977-4.402 4.408v4.408h4.402C52.026 20.576 54 18.599 54 16.168z'/>
    <path fill='#2EB67D' d='M42.24 16.168V4.408C42.24 1.977 40.266 0 37.838 0s-4.402 1.977-4.402 4.408v11.76c0 2.431 1.974 4.408 4.402 4.408s4.402-1.977 4.402-4.408z'/>
    <path fill='#ECB22E' d='M37.838 54c2.428 0 4.402-1.977 4.402-4.408s-1.974-4.408-4.402-4.408h-4.402v4.408C33.436 52.023 35.41 54 37.838 54z'/>
    <path fill='#ECB22E' d='M37.838 33.424H53.148c2.428 0 4.402-1.977 4.402-4.408 0-2.431-1.974-4.408-4.402-4.408H37.838c-2.428 0-4.402 1.977-4.402 4.408 0 2.431 1.974 4.408 4.402 4.408z' transform='translate(-3.55)'/>
    <path fill='#E01E5A' d='M0 37.832c0 2.431 1.974 4.408 4.402 4.408s4.402-1.977 4.402-4.408v-4.408H4.402C1.974 33.424 0 35.401 0 37.832z'/>
    <path fill='#E01E5A' d='M11.76 37.832v11.76C11.76 52.023 13.734 54 16.162 54s4.402-1.977 4.402-4.408V37.832c0-2.431-1.974-4.408-4.402-4.408s-4.402 1.977-4.402 4.408z'/>
  </svg>
);

interface Props {
  member: Member;
}

const SlackInviteButton: React.FC<Props> = ({ member }) => {
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);

  const getCsrfToken = (): string => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  const handleInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/invite_slack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || 'Failed to send Slack invite.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={`(Re)send Slack invite to ${member.email}`}>
        <span>
          <Button
            key='slack-invite'
            variant='outlined'
            disabled={loading}
            onClick={handleInvite}
            style={{ marginRight: '.25em' }}
            startIcon={loading ? <CircularProgress size={16} /> : <SlackIcon />}
          >
            Slack
          </Button>
        </span>
      </Tooltip>

      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        message={`Slack invite sent to ${member.email}`}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        message={error}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default SlackInviteButton;
