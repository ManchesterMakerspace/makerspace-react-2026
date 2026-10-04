import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import { ROLE_BADGE_COLORS } from 'ui/common/statusColors';

// Mailtrap webhook event values (event field, not status)
const GOOD_STATUSES = ['delivery', 'open', 'click'];

const STATUS_LABELS: Record<string, string> = {
  'delivery':    'Email delivered successfully',
  'open':        'Email opened (may include automated prefetch)',
  'click':       'Email link clicked by recipient',
  'bounce':      'Email bounced — address may be invalid',
  'soft bounce': 'Email soft bounced — temporary delivery failure',
  'spam':        'Email marked as spam by recipient',
  'unsubscribe': 'Recipient has unsubscribed from emails',
  'reject':      'Email rejected by mail server',
  'suspension':  'Email suspended — domain verification issue',
};

export interface MailtrapData {
  status: string;
  timestamp: string;
  email: string;
}

export interface SlackData {
  slack_id: string;
  name: string;
  url?: string;
}

export const EmailStatusIcon: React.FC<{ mailtrap?: MailtrapData }> = ({ mailtrap }) => {
  if (!mailtrap) {
    return (
      <Tooltip title='No email delivery data on record'>
        <InfoOutlined fontSize='small' sx={{ color: 'text.disabled', verticalAlign: 'middle' }} />
      </Tooltip>
    );
  }

  const { status, timestamp, email } = mailtrap;
  const isGood = GOOD_STATUSES.includes(status);
  const label = STATUS_LABELS[status] || `Email status: ${status}`;
  const formattedTime = timestamp ? new Date(timestamp).toLocaleString() : '';
  const tooltipText = `${label}${formattedTime ? ` (${formattedTime})` : ''}${email ? ` — ${email}` : ''}`;

  return (
    <Tooltip title={tooltipText}>
      {isGood
        ? <CheckCircleIcon fontSize='small' color='success' sx={{ verticalAlign: 'middle' }} />
        : <ErrorIcon fontSize='small' color='error' sx={{ verticalAlign: 'middle' }} />
      }
    </Tooltip>
  );
};

export const SlackStatusIcon: React.FC<{ slack?: SlackData }> = ({ slack }) => {
  if (!slack) {
    return (
      <Tooltip title='No Slack account linked — member will not receive Slack notifications'>
        <ErrorIcon fontSize='small' color='warning' sx={{ verticalAlign: 'middle' }} />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`Slack linked: ${slack.name}`}>
      <CheckCircleIcon fontSize='small' color='success' sx={{ verticalAlign: 'middle' }} />
    </Tooltip>
  );
};

export const TotpStatusIcon: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  if (enabled) {
    return (
      <Tooltip title='Two-factor authentication enabled'>
        <SecurityIcon fontSize='small' color='success' sx={{ verticalAlign: 'middle' }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title='Two-factor authentication not enabled'>
      <SecurityIcon fontSize='small' sx={{ color: 'action.disabled', verticalAlign: 'middle' }} />
    </Tooltip>
  );
};

const ROLE_LABELS: Record<string, string> = {
  admin:            'Admin',
  board_member:     'Board',
  resource_manager: 'RM',
};


export const RoleBadge: React.FC<{ role?: string }> = ({ role }) => {
  if (!role || role === 'member') return null;
  const label = ROLE_LABELS[role] || role;
  const badgeColor = (role in ROLE_BADGE_COLORS ? ROLE_BADGE_COLORS[role as keyof typeof ROLE_BADGE_COLORS] : ROLE_BADGE_COLORS.other);
  return (
    <Box component='span' sx={theme => ({
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.7rem',
      fontWeight: 600,
      backgroundColor: badgeColor(theme),
      color: theme.palette.common.white,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    })}>
      {label}
    </Box>
  );
};
