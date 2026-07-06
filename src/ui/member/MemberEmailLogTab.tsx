// @ts-nocheck
import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import { adminListMailtrapEvents, MailtrapEvent } from 'api/mailtrapEvents';

interface Props {
  memberId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  delivery:    { label: 'Delivered',    color: 'success' },
  delivered:   { label: 'Delivered',    color: 'success' },
  open:        { label: 'Opened',       color: 'info'    },
  click:       { label: 'Clicked',      color: 'info'    },
  bounce:      { label: 'Bounced',      color: 'error'   },
  hard_bounce: { label: 'Hard Bounce',  color: 'error'   },
  soft_bounce: { label: 'Soft Bounce',  color: 'warning' },
  spam:        { label: 'Spam',         color: 'warning' },
  unsubscribe: { label: 'Unsubscribed', color: 'warning' },
  reject:      { label: 'Rejected',     color: 'error'   },
};

function statusChip(status: string) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? { label: status ?? 'Unknown', color: 'default' as const };
  return <Chip label={cfg.label} color={cfg.color} size='small' sx={{ fontWeight: 600, minWidth: 90 }} />;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatMailerAction(mailerClass?: string, action?: string) {
  if (!mailerClass && !action) return '—';
  const cls = (mailerClass ?? '').replace('Mailer', '').replace('Devise', 'Auth');
  const act = (action ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return cls ? `${cls}: ${act}` : act;
}

const MemberEmailLogTab: React.FC<Props> = ({ memberId }) => {
  const { data: events, isRequesting, error } = useReadTransaction(
    adminListMailtrapEvents,
    { memberId }
  );

  if (isRequesting) {
    return <Box display='flex' justifyContent='center' mt={4}><CircularProgress /></Box>;
  }

  if (error) {
    return <Box mt={2}><Typography color='error'>Failed to load email log.</Typography></Box>;
  }

  if (!events || events.length === 0) {
    return (
      <Box mt={2}>
        <Typography color='textSecondary'>
          No email events recorded for this member yet.
          Events appear here after emails are sent and Mailtrap webhooks are received.
        </Typography>
      </Box>
    );
  }

  return (
    <Box mt={1}>
      <Table size='small'>
        <TableHead>
          <TableRow>
            <TableCell>Date / Time</TableCell>
            <TableCell>Subject</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>To</TableCell>
            <TableCell>Message ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(events as MailtrapEvent[]).map((event) => (
            <TableRow key={event.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(event.occurred_at)}</TableCell>
              <TableCell>
                {event.subject
                  ? <Typography variant='body2'>{event.subject}</Typography>
                  : <Typography variant='body2' color='textSecondary' fontStyle='italic'>No subject recorded</Typography>
                }
              </TableCell>
              <TableCell>
                <Typography variant='body2' color='textSecondary'>
                  {formatMailerAction(event.mailer_class, event.action)}
                </Typography>
              </TableCell>
              <TableCell>{statusChip(event.status || event.event_type)}</TableCell>
              <TableCell><Typography variant='body2'>{event.email}</Typography></TableCell>
              <TableCell>
                <Tooltip title={event.message_id ?? ''} placement='top'>
                  <Typography variant='body2' color='textSecondary'
                    sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}>
                    {event.message_id || '—'}
                  </Typography>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default MemberEmailLogTab;
