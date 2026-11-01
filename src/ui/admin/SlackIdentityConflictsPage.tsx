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
  LinearProgress,
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
  SlackLiveCheck,
  SlackScanProgress,
} from 'api/slackIdentityConflicts';
import { updateSystemSetting } from 'api/systemConfig';
import { softTone } from 'ui/common/statusColors';
import { SettingRow } from 'ui/admin/MemberPortalSettings';

type ConflictAction = 'link' | 'keep';
type ConfirmTarget = { conflict: SlackIdentityConflict; action: ConflictAction };

export const SLACK_SCAN_SIZE_KEY = 'slack_conflict_scan_size';
export const MIN_SLACK_SCAN_SIZE = 10;
export const MAX_SLACK_SCAN_SIZE = 500;
export const DEFAULT_SLACK_SCAN_SIZE = 200;

// Matches the server: a whole number from 10 to 500.
export const validateSlackScanSize = (value: string) =>
  /^\d+$/.test(value) && Number(value) >= MIN_SLACK_SCAN_SIZE && Number(value) <= MAX_SLACK_SCAN_SIZE
    ? '' : `Enter a whole number from ${MIN_SLACK_SCAN_SIZE} to ${MAX_SLACK_SCAN_SIZE}.`;

// The request that returns a piece of the check already takes seconds; this only spaces the next one.
const POLL_PAUSE_MS = 300;

const errorText = (error: any, fallback: string) =>
  typeof error === 'string' ? error : error?.message || fallback;

const SlackIdentityConflictsPage: React.FC = () => {
  const [conflicts, setConflicts] = React.useState<SlackIdentityConflict[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [resolving, setResolving] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [liveCheck, setLiveCheck] = React.useState<SlackLiveCheck | ''>('');
  const [progress, setProgress] = React.useState<SlackScanProgress | null>(null);
  const [scanSize, setScanSize] = React.useState(DEFAULT_SLACK_SCAN_SIZE);
  const [savingScanSize, setSavingScanSize] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<ConfirmTarget | null>(null);
  // Only the latest request may update the page, and nothing may after the page is closed.
  const requestId = React.useRef(0);
  const timer = React.useRef<number | undefined>(undefined);
  // A conflict resolved here can still be in a response that was already on its way back.
  const resolved = React.useRef<Set<string>>(new Set());

  const load = React.useCallback(async (initial = false) => {
    const id = ++requestId.current;
    window.clearTimeout(timer.current);
    if (initial) setLoading(true);
    setError('');
    const result = await getSlackIdentityConflicts();
    if (id !== requestId.current) return;
    if (result.error) {
      setError(errorText(result.error, 'Unable to load Slack identity conflicts.'));
      setLiveCheck('');
      setProgress(null);
    } else {
      const data = result.data;
      setConflicts((data?.conflicts || []).filter(c => !resolved.current.has(c.slack_id)));
      setLiveCheck(data?.live_check || 'fresh');
      setProgress(data?.progress || null);
      if (data?.scan_size) setScanSize(data.scan_size);
      if (data?.live_check === 'scanning') {
        // The server checks one piece of Slack per request, so keep asking until it is done.
        const wait = (data.progress?.waiting_seconds || 0) * 1000;
        timer.current = window.setTimeout(() => load(), wait + POLL_PAUSE_MS);
      }
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load(true);
    return () => { requestId.current += 1; window.clearTimeout(timer.current); };
  }, [load]);

  const saveScanSize = async (key: string, value: string) => {
    setSavingScanSize(true);
    try {
      const { error: err } = await updateSystemSetting({ key, value });
      if (err) throw new Error(errorText(err, 'Unable to save. Please try again.'));
      setScanSize(Number(value));
    } finally {
      setSavingScanSize(false);
    }
    // The server dropped the scan in progress, so check again with the new number.
    load();
  };

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
      setError(errorText(result.error, 'Unable to resolve this conflict.'));
    } else {
      resolved.current.add(conflict.slack_id);
      setConflicts(current => current.filter(c => c.slack_id !== conflict.slack_id));
    }
    setResolving(null);
    setConfirmTarget(null);
  };

  if (loading) return <CircularProgress />;

  const scanning = liveCheck === 'scanning';

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
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' action={<Button color='inherit' size='small' onClick={() => load()}>Try again</Button>}>
            {error}
          </Alert>
        </Grid>
      )}
      {scanning && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='info' icon={<CircularProgress size={18} />}>
            <strong>Checking Slack in small steps.</strong>{' '}
            {progress?.waiting_seconds
              ? `Slack asked us to slow down, so the next step starts in about ${progress.waiting_seconds} seconds. `
              : ''}
            {progress && progress.checked > 0
              ? `${progress.checked}${progress.estimated_total ? ` of about ${progress.estimated_total}` : ''} Slack accounts checked so far. `
              : ''}
            Conflicts found so far are listed below, and more may appear. You can keep this page open.
            <LinearProgress
              style={{ marginTop: 8 }}
              {...(progress?.estimated_total
                ? { variant: 'determinate' as const, value: Math.min(100, Math.round(100 * progress.checked / progress.estimated_total)) }
                : {})}
            />
          </Alert>
        </Grid>
      )}
      {liveCheck === 'unavailable' && (
        <Grid size={{ xs: 12 }}>
          <Alert
            severity='warning'
            action={<Button color='inherit' size='small' onClick={() => load()}>Try again</Button>}
          >
            The live check of Slack could not finish, so only conflicts saved earlier are shown.
            If it keeps failing, lower the number of Slack accounts checked per request below, then try again.
          </Alert>
        </Grid>
      )}
      {conflicts.length === 0 && !error && (
        <Grid size={{ xs: 12 }}>
          <Typography color='textSecondary'>
            {scanning
              ? 'No Slack identity conflicts found so far.'
              : liveCheck === 'unavailable' ? 'No saved Slack identity conflicts.' : 'No Slack identity conflicts right now.'}
          </Typography>
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
                  <Chip size='small' label='Currently linked' sx={[softTone('success'), { mb: 0.5 }]} />
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
                  <Chip size='small' label='Not linked (conflict)' sx={[softTone('error'), { mb: 0.5 }]} />
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

      <Grid size={{ xs: 12 }} style={{ marginTop: 16 }}>
        <SettingRow
          label='Slack accounts checked per request'
          description={`Slack is checked this many accounts at a time, so each request stays short. Lower it (${MIN_SLACK_SCAN_SIZE} to ${MAX_SLACK_SCAN_SIZE}, default ${DEFAULT_SLACK_SCAN_SIZE}) if the check keeps failing; the whole check just takes more steps.`}
          settingKey={SLACK_SCAN_SIZE_KEY}
          value={String(scanSize)}
          onSave={saveScanSize}
          saving={savingScanSize}
          validate={validateSlackScanSize}
        />
      </Grid>

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
