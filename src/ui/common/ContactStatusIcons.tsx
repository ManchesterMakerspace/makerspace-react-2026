import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ROLE_BADGE_COLORS } from 'ui/common/statusColors';

type EmailTone = 'success' | 'info' | 'warning' | 'error';

// Mailtrap webhook event values (event field, not status), plus "sent", which
// the server reports when an email went out but Mailtrap has said nothing yet.
// Red is kept for addresses we cannot reach; softer problems are amber.
const STATUS_TONES: Record<string, EmailTone> = {
  'delivery':    'success',
  'open':        'success',
  'click':       'success',
  'sent':        'info',
  'soft bounce': 'warning',
  'spam':        'warning',
  'unsubscribe': 'warning',
  'bounce':      'error',
  'reject':      'error',
  'suspension':  'error',
};

// Each tone has its own shape, so the meaning does not depend on color alone.
const TONE_ICONS: Record<EmailTone, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  info:    ScheduleSendIcon,
  warning: WarningAmberIcon,
  error:   ErrorIcon,
};

// A "sent" email with still no report after this long deserves a look.
const SENT_STALE_MS = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<string, string> = {
  'sent':        'Email sent — no delivery report yet',
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
  // The server reports "unknown" when nothing has been sent to the current
  // address. That is the usual state for long-standing members, so it stays quiet.
  if (!mailtrap || mailtrap.status === 'unknown') {
    return (
      <Tooltip title='No email has been sent to this address yet'>
        <EmailOutlinedIcon fontSize='small' sx={{ color: 'text.disabled', verticalAlign: 'middle' }} />
      </Tooltip>
    );
  }

  const { status, timestamp, email } = mailtrap;
  const sentAt = timestamp ? new Date(timestamp) : undefined;
  const stale = status === 'sent' && !!sentAt && Date.now() - sentAt.getTime() > SENT_STALE_MS;
  const tone: EmailTone = stale ? 'warning' : STATUS_TONES[status] || 'warning';
  const label = stale ? 'Email sent more than a day ago — still no delivery report' : STATUS_LABELS[status] || `Email status: ${status}`;
  const formattedTime = sentAt ? sentAt.toLocaleString() : '';
  const tooltipText = `${label}${formattedTime ? ` (${formattedTime})` : ''}${email ? ` — ${email}` : ''}`;
  const ToneIcon = TONE_ICONS[tone];

  return (
    <Tooltip title={tooltipText}>
      <ToneIcon fontSize='small' color={tone} sx={{ verticalAlign: 'middle' }} />
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
