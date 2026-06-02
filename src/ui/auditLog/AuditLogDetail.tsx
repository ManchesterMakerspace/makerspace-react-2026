import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

import { AuditLog } from 'api/auditLogs';
import { timeToDate } from 'ui/utils/timeToDate';

interface Props {
  log: AuditLog;
}

const SnapshotSection: React.FC<{ title: string; data: Record<string, unknown> }> = ({ title, data }) => (
  <Box style={{ marginBottom: '1em' }}>
    <Typography variant='subtitle2' style={{ fontWeight: 600, marginBottom: '0.25em' }}>
      {title}
    </Typography>
    <Box
      component='pre'
      style={{
        background: '#f5f5f5',
        border: '1px solid #e0e0e0',
        borderRadius: 4,
        padding: '0.75em',
        fontSize: '0.75rem',
        overflowX: 'auto',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </Box>
  </Box>
);

const ChangesSection: React.FC<{ changes: Record<string, [unknown, unknown]> }> = ({ changes }) => (
  <Box style={{ marginBottom: '1em' }}>
    <Typography variant='subtitle2' style={{ fontWeight: 600, marginBottom: '0.5em' }}>
      Changes
    </Typography>
    {Object.entries(changes).map(([field, [before, after]]) => (
      <Box
        key={field}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5em',
          marginBottom: '0.4em',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant='body2' style={{ fontWeight: 500, minWidth: 140 }}>
          {field}
        </Typography>
        <Typography variant='body2' style={{ color: '#c62828', textDecoration: 'line-through' }}>
          {before === null || before === undefined ? '(none)' : String(before)}
        </Typography>
        <Typography variant='body2' style={{ color: '#555' }}>→</Typography>
        <Typography variant='body2' style={{ color: '#2e7d32' }}>
          {after === null || after === undefined ? '(none)' : String(after)}
        </Typography>
      </Box>
    ))}
  </Box>
);

const AuditLogDetail: React.FC<Props> = ({ log }) => {
  return (
    <Box style={{ padding: '1em 1.5em', background: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
      <Box style={{ display: 'flex', gap: '0.5em', flexWrap: 'wrap', marginBottom: '1em' }}>
        <Chip size='small' label={`Type: ${log.logType}`} />
        <Chip size='small' label={`Resource: ${log.resourceType}`} />
        {log.ipAddress && <Chip size='small' label={`IP: ${log.ipAddress}`} />}
        {log.slackChannel && (
          <Chip
            size='small'
            label={`Slack: ${log.slackChannel} — ${log.slackPosted ? 'posted ✓' : log.slackPosted === false ? 'failed ✗' : 'skipped'}`}
            color={log.slackPosted ? 'success' : log.slackPosted === false ? 'error' : 'default'}
          />
        )}
      </Box>

      {log.slackMessage && (
        <Box style={{ marginBottom: '1em' }}>
          <Typography variant='subtitle2' style={{ fontWeight: 600, marginBottom: '0.25em' }}>
            Audit Message
          </Typography>
          <Typography variant='body2' style={{ fontStyle: 'italic', color: '#444' }}>
            {log.slackMessage}
          </Typography>
        </Box>
      )}

      <Divider style={{ marginBottom: '1em' }} />

      {log.fieldChanges && Object.keys(log.fieldChanges).length > 0 && (
        <ChangesSection changes={log.fieldChanges} />
      )}

      <Box style={{ display: 'flex', gap: '2em', flexWrap: 'wrap' }}>
        {log.beforeSnapshot && (
          <Box style={{ flex: 1, minWidth: 280 }}>
            <SnapshotSection title='Before' data={log.beforeSnapshot} />
          </Box>
        )}
        {log.afterSnapshot && (
          <Box style={{ flex: 1, minWidth: 280 }}>
            <SnapshotSection title='After' data={log.afterSnapshot} />
          </Box>
        )}
      </Box>

      {!log.fieldChanges && !log.beforeSnapshot && !log.afterSnapshot && (
        <Typography variant='body2' color='textSecondary'>
          No field-level change data recorded for this event.
        </Typography>
      )}
    </Box>
  );
};

export default AuditLogDetail;
