import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

import {
  getSlackIdentityConflicts,
  resolveSlackIdentityConflict,
  dismissSlackIdentityConflict,
  SlackIdentityConflict,
} from 'api/slackIdentityConflicts';

type ConflictAction = 'link' | 'keep';
type ConfirmTarget = { conflict: SlackIdentityConflict; action: ConflictAction };

const SlackIdentityConflictsPage: React.FC = () => {
  const [conflicts, setConflicts] = React.useState<SlackIdentityConflict[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [resolving, setResolving] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [confirmTarget, setConfirmTarget] = React.useState<ConfirmTarget | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getSlackIdentityConflicts();
    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : result.error.message || 'Unable to load Slack identity conflicts.');
    } else {
      setConflicts(result.data?.conflicts || []);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const confirmResolve = async () => {
    if (!confirmTarget) return;
    const { conflict, action } = confirmTarget;
    setResolving(conflict.slack_id);
    setError('');

    const result = action === 'link'
      ? await resolveSlackIdentityConflict({ slackId: conflict.slack_id, memberId: conflict.member_id })
      : await dismissSlackIdentityConflict({
          slackId: conflict.slack_id,
          memberId: conflict.member_id,
          slackEmail: conflict.slack_email,
          slackName: conflict.slack_name,
        });

    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : result.error.message || 'Unable to resolve this conflict.');
    } else {
      setConflicts(current => current.filter(c => c.slack_id !== conflict.slack_id));
    }
    setResolving(null);
    setConfirmTarget(null);
  };

  if (loading) return <CircularProgress />;

  return (
    <Grid container spacing={2} style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h5' gutterBottom>Slack Identity Conflicts</Typography>
        <Typography variant='body2' color='textSecondary'>
          A member with two Slack accounts sharing the same email can only have one linked at a time.
          The sync skips the conflicting one instead of failing — resolve it here by choosing which
          Slack account should stay linked to the member.
        </Typography>
      </Grid>
      {error && <Grid size={{ xs: 12 }}><Alert severity='error'>{error}</Alert></Grid>}
      {conflicts.length === 0 && (
        <Grid size={{ xs: 12 }}>
          <Typography color='textSecondary'>No Slack identity conflicts right now.</Typography>
        </Grid>
      )}
      {conflicts.map(conflict => (
        <Grid size={{ xs: 12 }} key={conflict.slack_id}>
          <Card variant='outlined'>
            <CardContent>
              <Typography variant='body1' gutterBottom>
                <strong><Link to={`/members/${conflict.member_id}`}>{conflict.member_name}</Link></strong>
              </Typography>
              <Grid container spacing={2} alignItems='flex-start'>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Chip size='small' label='Currently linked' style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', marginBottom: 4 }} />
                  <Typography variant='body2'>{conflict.conflicting_slack_name || '(no name)'}</Typography>
                  <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>{conflict.conflicting_slack_email}</Typography>
                  <Button
                    size='small'
                    variant='outlined'
                    disabled={!!resolving}
                    startIcon={resolving === conflict.slack_id ? <CircularProgress size={14} /> : null}
                    style={{ marginTop: 8 }}
                    onClick={() => setConfirmTarget({ conflict, action: 'keep' })}
                  >
                    Keep this one
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Chip size='small' label='Not linked (conflict)' style={{ backgroundColor: '#ffebee', color: '#c62828', marginBottom: 4 }} />
                  <Typography variant='body2'>{conflict.slack_name || '(no name)'}</Typography>
                  <Typography variant='caption' color='textSecondary' style={{ display: 'block' }}>{conflict.slack_email}</Typography>
                  <Button
                    size='small'
                    variant='outlined'
                    color='primary'
                    disabled={!!resolving}
                    startIcon={resolving === conflict.slack_id ? <CircularProgress size={14} /> : null}
                    style={{ marginTop: 8 }}
                    onClick={() => setConfirmTarget({ conflict, action: 'link' })}
                  >
                    Link this one
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Dialog open={!!confirmTarget} onClose={() => !resolving && setConfirmTarget(null)}>
        {confirmTarget?.action === 'link' ? (
          <>
            <DialogTitle>Switch linked Slack account?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                This will unlink <strong>{confirmTarget.conflict.conflicting_slack_name}</strong> ({confirmTarget.conflict.conflicting_slack_email})
                from <strong>{confirmTarget.conflict.member_name}</strong> and link{' '}
                <strong>{confirmTarget.conflict.slack_name}</strong> ({confirmTarget.conflict.slack_email}) instead.
              </DialogContentText>
              <Alert severity='warning' style={{ marginTop: 12 }}>
                This cannot be undone from this screen. {confirmTarget.conflict.conflicting_slack_name} will be
                permanently unlinked and will not be offered again or reconnected automatically — only a
                developer with direct database access could reverse it. Make sure{' '}
                {confirmTarget.conflict.slack_name} is the account this member actually uses before continuing.
              </Alert>
            </DialogContent>
          </>
        ) : confirmTarget?.action === 'keep' ? (
          <>
            <DialogTitle>Dismiss the duplicate account?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                <strong>{confirmTarget.conflict.member_name}</strong> will keep{' '}
                <strong>{confirmTarget.conflict.conflicting_slack_name}</strong> ({confirmTarget.conflict.conflicting_slack_email}) linked.{' '}
                <strong>{confirmTarget.conflict.slack_name}</strong> ({confirmTarget.conflict.slack_email}) will be dismissed as a duplicate.
              </DialogContentText>
              <Alert severity='warning' style={{ marginTop: 12 }}>
                This cannot be undone from this screen. {confirmTarget.conflict.slack_name} will be permanently
                dismissed and will not be offered or linked again — no action in Slack itself is needed either way.
              </Alert>
            </DialogContent>
          </>
        ) : null}
        <DialogActions>
          <Button disabled={!!resolving} onClick={() => setConfirmTarget(null)}>Cancel</Button>
          <Button
            color='primary'
            variant='contained'
            disabled={!!resolving}
            startIcon={resolving ? <CircularProgress size={14} /> : null}
            onClick={confirmResolve}
          >
            {confirmTarget?.action === 'link' ? 'Switch' : 'Dismiss'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default SlackIdentityConflictsPage;
