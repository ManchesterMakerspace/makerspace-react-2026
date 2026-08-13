// @ts-nocheck
import * as React from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Switch,
  FormControlLabel,
  Button,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  TextField,
  IconButton,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  Alert,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import {
  getSystemConfigs,
  updateSystemFlag,
  updateSystemSetting,
  runSystemJob,
  getBraintreeDiscounts,
  SystemConfigData,
  JobStatus,
  BraintreeDiscount,
  getExternalTemplates,
  runExternalTemplateAction,
  ExternalTemplateStatus,
} from 'api/systemConfig';
import { useCapabilities } from 'app/permissions';

type TabKey = 'slack' | 'volunteer' | 'reservations' | 'jobs' | 'security' | 'templates';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'slack',     label: 'Slack' },
  { key: 'volunteer', label: 'Volunteer' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'jobs',      label: 'Jobs' },
  { key: 'security',  label: 'Security' },
  { key: 'templates', label: 'Templates' },
];

const JOB_LABELS: Record<string, string> = {
  slack_sync:      'Slack User Sync',
  slack_profile_sync: 'Slack Profile Sync',
  slack_channel_cache: 'Slack Channel Cache',
  member_review:   'Member Review',
  invoice_review:  'Invoice Review',
  garbage_collect: 'Garbage Collector',
  db_backup:       'Database Backup',
  card_expiration_check: 'Card on File Expiration Check',
  reservation_canvas_rebuild: 'Reservation Canvas Rebuild',
};

const JOB_DESCRIPTIONS: Record<string, string> = {
  slack_sync:      'Bulk syncs Slack workspace users to member records by matching email. Use Run Now after onboarding a batch of new members.',
  slack_profile_sync: 'Updates the Slack profile status field for members whose memberships expired since the last sync.',
  slack_channel_cache: 'Clears and rebuilds the Redis cache of public Slack channel IDs, topics, and purposes.',
  member_review:   'Reviews membership statuses and sends a weekly summary report to Slack.',
  invoice_review:  'Reviews invoice statuses, flags past due accounts, and reports to the treasurer channel.',
  garbage_collect: 'Cleans up old Redis invoicing cache keys from the previous month.',
  db_backup:       'Backs up the MongoDB database to Google Drive.',
  card_expiration_check: 'Finds active members with payment cards expiring this month, caches the results, and sends Slack notifications.',
  reservation_canvas_rebuild: "Rebuilds today's and tomorrow's Slack reservation canvases and refreshes owner access.",
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

// ── Editable Setting Row ──────────────────────────────────────────────────────

interface SettingRowProps {
  label: string;
  description?: string;
  settingKey: string;
  value: string;
  onSave: (key: string, value: string) => Promise<void>;
  saving: boolean;
  inputType?: React.HTMLInputTypeAttribute;
  min?: number;
  max?: number;
  suffix?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  label, description, settingKey, value, onSave, saving,
  inputType = 'text', min, max, suffix
}) => {
  const [editing, setEditing]                  = React.useState(false);
  const [draft, setDraft]                      = React.useState(value);
  const [validationError, setValidationError]  = React.useState('');

  React.useEffect(() => { setDraft(value); }, [value]);

  const handleSave = async () => {
    if (inputType === 'number') {
      const parsed = Number(draft);
      const isWholeNumber = Number.isFinite(parsed) && Number.isInteger(parsed);
      if (!isWholeNumber || (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
        setValidationError(
          min !== undefined && max !== undefined
            ? `Enter a whole number between ${min} and ${max}.`
            : 'Enter a valid whole number.'
        );
        return;
      }
    }
    setValidationError('');
    await onSave(settingKey, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setValidationError('');
    setEditing(false);
  };

  return (
    <Grid container alignItems='center' spacing={1} style={{ marginBottom: 12 }}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Typography variant='body1'>{label}</Typography>
        {description && (
          <Typography variant='caption' color='textSecondary'>{description}</Typography>
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 8 }}>
        {editing ? (
          <>
            <TextField
              type={inputType}
              value={draft}
              onChange={e => { setDraft(e.target.value); setValidationError(''); }}
              size='small'
              variant='outlined'
              fullWidth
              disabled={saving}
              error={!!validationError}
              slotProps={{
                htmlInput: { min, max, step: inputType === 'number' ? 1 : undefined },
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton size='small' onClick={handleSave} disabled={saving}>
                        {saving ? <CircularProgress size={16} /> : <SaveIcon fontSize='small' />}
                      </IconButton>
                      <IconButton size='small' onClick={handleCancel} disabled={saving}>
                        <CancelIcon fontSize='small' />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {validationError && (
              <Typography variant='caption' color='error'>{validationError}</Typography>
            )}
          </>
        ) : (
          <Grid container alignItems='center' spacing={1}>
            <Grid>
              <Typography variant='body2' style={{ fontFamily: 'monospace' }}>
                {value ? `${value}${suffix ? ` ${suffix}` : ''}` : <span style={{ color: '#999' }}>not set</span>}
              </Typography>
            </Grid>
            <Grid>
              <IconButton size='small' onClick={() => setEditing(true)}>
                <EditIcon fontSize='small' />
              </IconButton>
            </Grid>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
};

// ── Discount Select Row ───────────────────────────────────────────────────────
// Fetches available Braintree discounts and renders a dropdown.
// "No Credit" (empty string) is always the first option and the default.
// Selecting a discount saves the discount ID to SystemConfig and posts
// audit notifications to Slack (handled server-side).

interface DiscountSelectRowProps {
  label: string;
  description?: string;
  settingKey: string;
  currentId: string;
  onSave: (key: string, value: string) => Promise<void>;
  saving: boolean;
}

const DiscountSelectRow: React.FC<DiscountSelectRowProps> = ({
  label, description, settingKey, currentId, onSave, saving
}) => {
  const [discounts, setDiscounts]   = React.useState<BraintreeDiscount[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = React.useState(true);
  const [fetchError, setFetchError] = React.useState('');

  React.useEffect(() => {
    getBraintreeDiscounts().then(result => {
      if ((result as any).error) {
        setFetchError('Failed to load discounts from Braintree.');
      } else {
        const data = (result as any).data;
        setDiscounts(Array.isArray(data) ? data : []);
      }
      setLoadingDiscounts(false);
    });
  }, []);

  const handleChange = async (newId: string) => {
    await onSave(settingKey, newId);
  };

  const formatOption = (d: BraintreeDiscount): string => {
    const amount = d.amount ? ` — $${Number(d.amount).toFixed(2)}/mo` : '';
    return (d.description || d.name) + amount;
  };

  return (
    <Grid container alignItems='center' spacing={1} style={{ marginBottom: 12 }}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Typography variant='body1'>{label}</Typography>
        {description && (
          <Typography variant='caption' color='textSecondary'>{description}</Typography>
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 8 }}>
        {loadingDiscounts ? (
          <CircularProgress size={20} />
        ) : fetchError ? (
          <Typography variant='body2' color='error'>{fetchError}</Typography>
        ) : (
          <FormControl fullWidth size='small'>
            <Select
              value={currentId || ''}
              onChange={e => handleChange(e.target.value as string)}
              disabled={saving}
              displayEmpty
              variant='outlined'
            >
              <MenuItem value=''>
                <em>No Credit</em>
              </MenuItem>
              {discounts.map(d => (
                <MenuItem key={d.id} value={d.id}>
                  {formatOption(d)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {saving && (
          <CircularProgress size={14} style={{ marginLeft: 8, verticalAlign: 'middle' }} />
        )}
      </Grid>
    </Grid>
  );
};

// ── Slack Tab ─────────────────────────────────────────────────────────────────

interface SlackTabProps {
  config: SystemConfigData;
  onFlagToggle: (key: string, current: boolean) => void;
  onSettingSave: (key: string, value: string) => Promise<void>;
  togglingFlag: string | null;
  savingKey: string | null;
  onRunJob: (key: string) => void;
  runningJob: string | null;
  jobMessage: Record<string, string>;
}

const SlackTab: React.FC<SlackTabProps> = ({
  config, onFlagToggle, onSettingSave, togglingFlag, savingKey, onRunJob, runningJob, jobMessage
}) => {
  const slackSyncJob = config.jobs.find(j => j.key === 'slack_sync');
  const slackCacheJob = config.jobs.find(j => j.key === 'slack_channel_cache');

  return (
    <Grid container spacing={3}>
      {/* Channel names */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Slack Channels' subheader='Channel names (without #) used for notifications.' />
          <Divider />
          <CardContent>
            <SettingRow
              label='Treasurer Channel'
              description='Billing alerts, discount notifications'
              settingKey='slack_channel_treasurer'
              value={config.slack.slack_channel_treasurer}
              onSave={onSettingSave}
              saving={savingKey === 'slack_channel_treasurer'}
            />
            <Divider style={{ margin: '8px 0' }} />
            <SettingRow
              label='RM Channel'
              description='Resource manager notifications'
              settingKey='slack_channel_rm'
              value={config.slack.slack_channel_rm}
              onSave={onSettingSave}
              saving={savingKey === 'slack_channel_rm'}
            />
            <Divider style={{ margin: '8px 0' }} />
            <SettingRow
              label='Admin Channel'
              description='Admin alerts'
              settingKey='slack_channel_admin'
              value={config.slack.slack_channel_admin}
              onSave={onSettingSave}
              saving={savingKey === 'slack_channel_admin'}
            />
            <Divider style={{ margin: '8px 0' }} />
            <SettingRow
              label='Logs Channel'
              description='System logs, unlinked user alerts'
              settingKey='slack_channel_logs'
              value={config.slack.slack_channel_logs}
              onSave={onSettingSave}
              saving={savingKey === 'slack_channel_logs'}
            />
            <Divider style={{ margin: '8px 0' }} />
            <SettingRow
              label='Volunteer Pending Channel'
              description='Notified when a task is awaiting verification'
              settingKey='volunteer_pending_slack_channel'
              value={config.slack.volunteer_pending_slack_channel}
              onSave={onSettingSave}
              saving={savingKey === 'volunteer_pending_slack_channel'}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Slack public-channel cache */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Slack Channel Cache'
            subheader='Redis cache of public Slack channel IDs, topics, and purposes.'
          />
          <Divider />
          <CardContent>
            <Grid container alignItems='center' spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant='caption' color='textSecondary'>Channels cached</Typography>
                <Typography variant='body1'>
                  {config.slack.channel_cache.available
                    ? config.slack.channel_cache.total_channels
                    : 'Unavailable'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant='caption' color='textSecondary'>Last update</Typography>
                <Typography variant='body2'>
                  {formatDate(config.slack.channel_cache.last_updated_at)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Button
                  variant='outlined'
                  color='primary'
                  startIcon={runningJob === 'slack_channel_cache'
                    ? <CircularProgress size={14} />
                    : <PlayArrowIcon />}
                  disabled={!!runningJob}
                  onClick={() => onRunJob('slack_channel_cache')}
                >
                  Clear and Rebuild Cache
                </Button>
                {slackCacheJob?.last_run_status === 'failure' && (
                  <Chip
                    icon={<ErrorIcon />}
                    label='Last rebuild failed'
                    size='small'
                    style={{ marginLeft: 8, backgroundColor: '#ffebee', color: '#c62828' }}
                  />
                )}
                {jobMessage['slack_channel_cache'] && (
                  <Typography variant='caption' color='textSecondary' display='block' style={{ marginTop: 4 }}>
                    {jobMessage['slack_channel_cache']}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Slack sync */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Slack User Sync' subheader='Sync Slack workspace users to member records.' />
          <Divider />
          <CardContent>
            <FormControlLabel
              control={
                <Switch
                  checked={config.flags.slack_sync_enabled}
                  onChange={() => onFlagToggle('slack_sync_enabled', config.flags.slack_sync_enabled)}
                  disabled={togglingFlag === 'slack_sync_enabled'}
                  color='primary'
                />
              }
              label={
                <span>
                  <Typography variant='body1' component='span'>Enable Scheduled Sync</Typography>
                  <Typography variant='body2' color='textSecondary' component='p'>
                    When enabled, syncs run on demand. Use Run Now below for a full workspace sync.
                  </Typography>
                </span>
              }
            />
            <Divider style={{ margin: '12px 0' }} />
            <FormControlLabel
              control={
                <Switch
                  checked={config.flags.slack_profile_sync_enabled}
                  onChange={() => onFlagToggle('slack_profile_sync_enabled', config.flags.slack_profile_sync_enabled)}
                  disabled={togglingFlag === 'slack_profile_sync_enabled'}
                  color='primary'
                />
              }
              label={
                <span>
                  <Typography variant='body1' component='span'>Enable Scheduled Profile Sync</Typography>
                  <Typography variant='body2' color='textSecondary' component='p'>
                    When enabled, expired member Slack profile status updates run automatically at 7:00 AM.
                  </Typography>
                </span>
              }
            />
            {slackSyncJob && (
              <Grid container alignItems='center' spacing={2} style={{ marginTop: 12 }}>
                <Grid>
                  <Typography variant='caption' color='textSecondary'>
                    Last run: {formatDate(slackSyncJob.last_run_at)}
                  </Typography>
                </Grid>
                <Grid>
                  {slackSyncJob.last_run_status === 'success' && (
                    <Chip icon={<CheckCircleIcon />} label='Success' size='small' style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }} />
                  )}
                  {slackSyncJob.last_run_status === 'failure' && (
                    <Chip icon={<ErrorIcon />} label='Failed' size='small' style={{ backgroundColor: '#ffebee', color: '#c62828' }} />
                  )}
                </Grid>
                <Grid>
                  <Button
                    variant='outlined'
                    size='small'
                    color='primary'
                    startIcon={runningJob === 'slack_sync' ? <CircularProgress size={14} /> : <PlayArrowIcon />}
                    disabled={!!runningJob}
                    onClick={() => onRunJob('slack_sync')}
                  >
                    Run Now
                  </Button>
                  {jobMessage['slack_sync'] && (
                    <Typography variant='caption' color='textSecondary' display='block' style={{ marginTop: 4 }}>
                      {jobMessage['slack_sync']}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// ── Volunteer Tab ─────────────────────────────────────────────────────────────

interface VolunteerTabProps {
  config: SystemConfigData;
  onFlagToggle: (key: string, current: boolean) => void;
  onSettingSave: (key: string, value: string) => Promise<void>;
  togglingFlag: string | null;
  savingKey: string | null;
}

const VolunteerTab: React.FC<VolunteerTabProps> = ({
  config, onFlagToggle, onSettingSave, togglingFlag, savingKey
}) => (
  <Grid container spacing={3}>
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader
          title='Credit Thresholds'
          subheader='Controls how credits translate into Braintree billing cycle discounts.'
        />
        <Divider />
        <CardContent>
          <SettingRow
            label='Credits Per Discount'
            description='Number of credits needed to earn one discount'
            settingKey='volunteer_credits_per_discount'
            value={config.volunteer.volunteer_credits_per_discount}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_credits_per_discount'}
          />
          <Divider style={{ margin: '8px 0' }} />
          <SettingRow
            label='Max Discounts Per Year'
            description='Maximum discounts a member can earn per calendar year'
            settingKey='volunteer_max_discounts_per_year'
            value={config.volunteer.volunteer_max_discounts_per_year}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_max_discounts_per_year'}
          />
          <Divider style={{ margin: '8px 0' }} />
          <DiscountSelectRow
            label='Volunteer Discount'
            description={
              'Braintree discount applied when a member reaches the credit threshold. ' +
              'Select "No Credit" to hold awards until the board decides. ' +
              'Changing this posts an audit notification to Slack.'
            }
            settingKey='volunteer_discount_id'
            currentId={config.volunteer.volunteer_discount_id}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_discount_id'}
          />
        </CardContent>
      </Card>
    </Grid>

<Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader
          title='Credit Counters'
          subheader='Controls for the rolling and leaderboard credit displays.'
        />
        <Divider />
        <CardContent>
          <SettingRow
            label='Rolling Days Counter'
            description='Number of days used for the rolling credit window displayed on member profiles'
            settingKey='volunteer_rolling_days'
            value={config.volunteer.volunteer_rolling_days}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_rolling_days'}
          />
          <Divider style={{ margin: '8px 0' }} />
          <SettingRow
            label='Leaderboard Top N'
            description='Number of top earners shown on the public volunteer leaderboard'
            settingKey='volunteer_leaderboard_top'
            value={config.volunteer.volunteer_leaderboard_top}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_leaderboard_top'}
          />
        </CardContent>
      </Card>
    </Grid>
    
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader title='Bounty Tasks' />
        <Divider />
        <CardContent>
          <SettingRow
            label='Max Credit Per Task'
            description='Maximum credit value allowed when creating a bounty task'
            settingKey='volunteer_task_max_credit'
            value={config.volunteer.volunteer_task_max_credit}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_task_max_credit'}
          />
        </CardContent>
      </Card>
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader title='Public Bounty Board' subheader='Token protection for the public bounty display page.' />
        <Divider />
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={config.flags.volunteer_bounty_token_enabled}
                onChange={() => onFlagToggle('volunteer_bounty_token_enabled', config.flags.volunteer_bounty_token_enabled)}
                disabled={togglingFlag === 'volunteer_bounty_token_enabled'}
                color='primary'
              />
            }
            label={
              <span>
                <Typography variant='body1' component='span'>Require Token</Typography>
                <Typography variant='body2' color='textSecondary' component='p'>
                  When enabled, the public bounty page requires a token in the URL.
                </Typography>
              </span>
            }
          />
          <Divider style={{ margin: '12px 0' }} />
          <SettingRow
            label='Token Value'
            description="Token appended to the bounty URL: /volunteer/bounties?token=..."
            settingKey='volunteer_bounty_token'
            value={config.volunteer.volunteer_bounty_token}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_bounty_token'}
          />
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const ReservationsTab: React.FC<{
  config: SystemConfigData;
  onSettingSave: (key: string, value: string) => Promise<void>;
  savingKey: string | null;
}> = ({ config, onSettingSave, savingKey }) => (
  <Grid container spacing={3}>
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader
          title='Public Reservation Agenda'
          subheader='Optional token protection for the public 24-hour shop and tool agenda.'
        />
        <Divider />
        <CardContent>
          <SettingRow
            label='Reservation Token'
            description='When nonblank, append this value as ?token=... to /reservations/agenda. Leave blank for public access.'
            settingKey='reservation_token'
            value={config.reservation.reservation_token}
            onSave={onSettingSave}
            saving={savingKey === 'reservation_token'}
          />
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

// ── Jobs Tab ──────────────────────────────────────────────────────────────────

interface JobsTabProps {
  config: SystemConfigData;
  onRunJob: (key: string) => void;
  runningJob: string | null;
  jobMessage: Record<string, string>;
}

const JobsTab: React.FC<JobsTabProps> = ({ config, onRunJob, runningJob, jobMessage }) => (
  <Grid container spacing={2}>
    {config.jobs.filter(j => j.key !== 'slack_sync').map((job: JobStatus) => (
      <Grid size={{ xs: 12 }} key={job.key}>
        <Card variant='outlined'>
          <CardContent>
            <Grid container alignItems='center' spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant='body1'>{JOB_LABELS[job.key] || job.key}</Typography>
                <Typography variant='caption' color='textSecondary'>
                  {JOB_DESCRIPTIONS[job.key] || job.task}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant='caption' color='textSecondary'>Last run</Typography>
                <Typography variant='body2'>{formatDate(job.last_run_at)}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                {job.last_run_status === 'success' && (
                  <Chip icon={<CheckCircleIcon />} label='Success' size='small' style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }} />
                )}
                {job.last_run_status === 'failure' && (
                  <Chip icon={<ErrorIcon />} label='Failed' size='small' style={{ backgroundColor: '#ffebee', color: '#c62828' }} />
                )}
                {!job.last_run_status && <Chip label='No data' size='small' />}
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Button
                  variant='outlined'
                  size='small'
                  color='primary'
                  startIcon={runningJob === job.key ? <CircularProgress size={14} /> : <PlayArrowIcon />}
                  disabled={!!runningJob}
                  onClick={() => onRunJob(job.key)}
                >
                  Run Now
                </Button>
                {jobMessage[job.key] && (
                  <Typography variant='caption' color='textSecondary' display='block' style={{ marginTop: 4 }}>
                    {jobMessage[job.key]}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// ── Security Tab ──────────────────────────────────────────────────────────────

interface TotpToggleProps {
  label: string;
  description: string;
  flagKey: string;
  value: boolean;
  onToggle: (key: string, value: boolean) => Promise<void>;
  saving: boolean;
}

const TotpToggle: React.FC<TotpToggleProps> = ({ label, description, flagKey, value, onToggle, saving }) => (
  <Grid size={{ xs: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0' }}>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <Typography variant='body1'><strong>{label}</strong></Typography>
        <Typography variant='body2' color='textSecondary'>{description}</Typography>
      </div>
      <FormControlLabel
        control={
          <Switch
            checked={value}
            onChange={e => onToggle(flagKey, e.target.checked)}
            disabled={saving}
            color='primary'
          />
        }
        label={value ? 'Required' : 'Optional'}
        labelPlacement='start'
      />
    </div>
  </Grid>
);

const MaintenanceToggle: React.FC<{
  value: boolean;
  onToggle: (key: string, value: boolean) => Promise<void>;
  saving: boolean;
}> = ({ value, onToggle, saving }) => (
  <Grid size={{ xs: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0' }}>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <Typography variant='body1'><strong>Lock Out New Signups</strong></Typography>
        <Typography variant='body2' color='textSecondary'>
          While enabled, new/unauthenticated visitors are redirected to a maintenance page instead
          of the signup form, and the signup API rejects new registrations. Members who already
          created an account and are mid-signup are not affected.
        </Typography>
      </div>
      <FormControlLabel
        control={
          <Switch
            checked={value}
            onChange={e => onToggle('signup_lockout_enabled', e.target.checked)}
            disabled={saving}
            color='warning'
          />
        }
        label={value ? 'Locked' : 'Open'}
        labelPlacement='start'
      />
    </div>
  </Grid>
);

interface SecurityTabProps {
  config: SystemConfigData;
  onFlagToggle: (key: string, current: boolean) => void;
  onSettingSave: (key: string, value: string) => Promise<void>;
  togglingFlag: string | null;
  savingKey: string | null;
}

const SecurityTab: React.FC<SecurityTabProps> = ({
  config, onFlagToggle, onSettingSave, togglingFlag, savingKey
}) => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Mongo Cache'
            subheader='Controls how long Mongo-backed reference data remains in Redis.'
          />
          <Divider />
          <CardContent>
            <SettingRow
              label='Mongo Cache TTL'
              description='Allowed range: 1–24 hours; default: 8. Rails writes invalidate affected entries immediately.'
              settingKey='mongo_cache_ttl_hours'
              value={config.security?.mongo_cache_ttl_hours ?? '8'}
              onSave={onSettingSave}
              saving={savingKey === 'mongo_cache_ttl_hours'}
              inputType='number'
              min={1}
              max={24}
              suffix='hours'
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Session Timeout'
            subheader='Controls how long an inactive member session stays signed in.'
          />
          <Divider />
          <CardContent>
            <SettingRow
              label='Idle Session Timeout'
              description='Whole number of minutes of inactivity before Devise signs a member out; default: 30.'
              settingKey='devise_timeout_minutes'
              value={config.security?.devise_timeout_minutes ?? '30'}
              onSave={onSettingSave}
              saving={savingKey === 'devise_timeout_minutes'}
              inputType='number'
              min={1}
              suffix='minutes'
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6' gutterBottom>Two-Factor Authentication Enforcement</Typography>
        <Typography variant='body2' color='textSecondary' style={{ marginBottom: 16 }}>
          When required, privileged members who have not enrolled in 2FA will be redirected
          to their Security settings immediately after login and cannot access the portal until enrolled.
          All members can optionally enable 2FA from their Account Settings → Security tab.
        </Typography>
      </Grid>
      <TotpToggle
        label='Require 2FA for Admins'
        description='Admin accounts must have two-factor authentication enabled.'
        flagKey='require_totp_admin'
        value={config.flags.require_totp_admin}
        onToggle={(key) => onFlagToggle(key, config.flags.require_totp_admin)}
        saving={togglingFlag === 'require_totp_admin'}
      />
      <TotpToggle
        label='Require 2FA for Board Members'
        description='Board member accounts must have two-factor authentication enabled.'
        flagKey='require_totp_board'
        value={config.flags.require_totp_board}
        onToggle={(key) => onFlagToggle(key, config.flags.require_totp_board)}
        saving={togglingFlag === 'require_totp_board'}
      />
      <TotpToggle
        label='Require 2FA for Resource Managers'
        description='Resource manager accounts must have two-factor authentication enabled.'
        flagKey='require_totp_rm'
        value={config.flags.require_totp_rm}
        onToggle={(key) => onFlagToggle(key, config.flags.require_totp_rm)}
        saving={togglingFlag === 'require_totp_rm'}
      />

      <Grid size={{ xs: 12 }}><Divider style={{ margin: '16px 0' }} /></Grid>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6' gutterBottom>Maintenance</Typography>
      </Grid>
      <MaintenanceToggle
        value={config.flags.signup_lockout_enabled}
        onToggle={(key) => onFlagToggle(key, config.flags.signup_lockout_enabled)}
        saving={togglingFlag === 'signup_lockout_enabled'}
      />
    </Grid>
  );

// ── Templates Tab ──────────────────────────────────────────────────────────────

const templateStatusLabel = (template: ExternalTemplateStatus) => {
  if (template.status === 'ok') return 'Cached';
  if (template.status === 'empty') return 'Empty document';
  if (template.status === 'uncached') return 'Not cached';
  if (template.status === 'missing_env') return 'Using embedded template';
  if (template.status === 'permission_error') return 'Permission denied';
  if (template.status === 'invalid') return 'Invalid template';
  return 'Unavailable';
};

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = React.useState<ExternalTemplateStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [restoreTarget, setRestoreTarget] = React.useState<ExternalTemplateStatus | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getExternalTemplates();
    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : result.error.message || 'Unable to load templates.');
    } else {
      setTemplates(result.data?.templates || []);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const runAction = async (template: ExternalTemplateStatus, action: 'refresh' | 'restore' | 'populate') => {
    setRunning(template.name);
    setError('');
    const result = await runExternalTemplateAction(template.name, action);
    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : result.error.message || `Unable to ${action} template.`);
    } else if (result.data?.template) {
      setTemplates(current => current.map(item => item.name === template.name ? result.data.template : item));
    }
    setRunning(null);
    setRestoreTarget(null);
  };

  if (loading) return <CircularProgress />;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h6'>Google document templates</Typography>
        <Typography variant='body2' color='textSecondary'>
          Valid exports are cached in Redis. A failed refresh continues to preserve the last valid content.
        </Typography>
      </Grid>
      {error && <Grid size={{ xs: 12 }}><Alert severity='error'>{error}</Alert></Grid>}
      {templates.map(template => {
        const healthy = template.status === 'ok' || template.status === 'empty' || template.status === 'uncached';
        const retryable = !!template.edit_url && template.status !== 'missing_env';
        const placeholderHelp = `Template placeholders: ${template.template_placeholders.join(', ') || '(none)'}. Common placeholders: ${template.common_placeholders.join(', ')}.`;
        const tooltip = healthy
          ? placeholderHelp
          : template.status === 'missing_env'
            ? `${template.error || templateStatusLabel(template)} Create the Google document, grant the service account access, and set ${template.env_key} to a valid document ID. ${placeholderHelp}`
            : `${template.error || templateStatusLabel(template)} Correct the Google document or its access, then select Refresh to retry. ${placeholderHelp}`;
        return (
          <Grid size={{ xs: 12 }} key={template.name}>
            <Tooltip title={tooltip} placement='top-start' arrow>
              <Card variant='outlined'>
                <CardContent>
                  <Grid container spacing={2} alignItems='center'>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant='body1'><strong>{template.name}</strong></Typography>
                      <Typography variant='caption' color='textSecondary'>{template.env_key}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                      <Chip
                        size='small'
                        color={
                          template.status === 'ok'
                            ? 'success'
                            : template.status === 'empty'
                              ? 'warning'
                              : template.status === 'missing_env' || template.status === 'uncached'
                                ? 'info'
                                : 'error'
                        }
                        label={templateStatusLabel(template)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8, md: 2 }}>
                      <Typography variant='caption' color='textSecondary'>Cache fetched</Typography>
                      <Typography variant='body2'>
                        {template.status === 'missing_env' ? 'Environment variable missing' : formatDate(template.fetched_at)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      {retryable && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button
                            size='small'
                            variant='outlined'
                            startIcon={running === template.name ? <CircularProgress size={14} /> : <RefreshIcon />}
                            disabled={!!running}
                            onClick={() => runAction(template, 'refresh')}
                          >Refresh</Button>
                          {template.status === 'empty' ? (
                            <Button size='small' variant='outlined' disabled={!!running} onClick={() => runAction(template, 'populate')}>
                              Populate
                            </Button>
                          ) : template.status === 'ok' ? (
                            <Button
                              size='small'
                              variant='outlined'
                              color='warning'
                              startIcon={<RestoreIcon />}
                              disabled={!!running}
                              onClick={() => setRestoreTarget(template)}
                            >Restore default</Button>
                          ) : null}
                          <Button
                            size='small'
                            variant='outlined'
                            startIcon={<OpenInNewIcon />}
                            onClick={() => window.open(template.edit_url!, `google-template-${template.name}`, 'noopener,noreferrer')}
                          >Edit</Button>
                        </div>
                      )}
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Tooltip>
          </Grid>
        );
      })}
      <Dialog open={!!restoreTarget} onClose={() => !running && setRestoreTarget(null)}>
        <DialogTitle>Restore compiled-in default?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will wipe out all changes in {restoreTarget?.env_key} and replace the Google document with the compiled-in default content.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={!!running} onClick={() => setRestoreTarget(null)}>Cancel</Button>
          <Button
            color='warning'
            variant='contained'
            disabled={!!running}
            startIcon={running === restoreTarget?.name ? <CircularProgress size={14} /> : <RestoreIcon />}
            onClick={() => restoreTarget && runAction(restoreTarget, 'restore')}
          >
            Restore default
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const MemberPortalSettings: React.FC = () => {
  const { canViewPortalSettings } = useCapabilities();
  const [activeTab, setActiveTab]       = React.useState<TabKey>('slack');
  const [config, setConfig]             = React.useState<SystemConfigData | null>(null);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState<string | null>(null);
  const [actionError, setActionError]   = React.useState<string | null>(null);
  const [togglingFlag, setTogglingFlag] = React.useState<string | null>(null);
  const [savingKey, setSavingKey]       = React.useState<string | null>(null);
  const [runningJob, setRunningJob]     = React.useState<string | null>(null);
  const [jobMessage, setJobMessage]     = React.useState<Record<string, string>>({});

  const loadConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await getSystemConfigs();
    if (err) {
      setError('Failed to load settings.');
    } else {
      setConfig(data);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleFlagToggle = React.useCallback(async (key: string, current: boolean) => {
    setTogglingFlag(key);
    const { error: err } = await updateSystemFlag(key, !current);
    if (err) {
      setActionError('Failed to update setting. Please try again.');
    } else {
      setActionError(null);
      // Functional update: two toggles started in quick succession must not
      // let the second overwrite the first with a stale `config` snapshot.
      setConfig(prev => prev ? { ...prev, flags: { ...prev.flags, [key]: !current } } : prev);
    }
    setTogglingFlag(null);
  }, []);

  const handleSettingSave = React.useCallback(async (key: string, value: string) => {
    setSavingKey(key);
    const { error: err } = await updateSystemSetting({ key, value });
    if (err) {
      setActionError('Failed to save setting. Please try again.');
    } else {
      setActionError(null);
      setConfig(prev => {
        if (!prev) return prev;
        if (key.startsWith('slack_channel') || key === 'volunteer_pending_slack_channel') {
          return { ...prev, slack: { ...prev.slack, [key]: value } };
        } else if (key.startsWith('volunteer_')) {
          return { ...prev, volunteer: { ...prev.volunteer, [key]: value } };
        } else if (key === 'reservation_token') {
          return { ...prev, reservation: { ...prev.reservation, [key]: value } };
        } else if (key === 'mongo_cache_ttl_hours' || key === 'devise_timeout_minutes') {
          return { ...prev, security: { ...prev.security, [key]: value } };
        }
        return prev;
      });
    }
    setSavingKey(null);
  }, []);

  const handleRunJob = React.useCallback(async (jobKey: string) => {
    setRunningJob(jobKey);
    setJobMessage(prev => ({ ...prev, [jobKey]: '' }));
    const { data, error: err } = await runSystemJob({ key: jobKey });
    if (err) {
      setJobMessage(prev => ({ ...prev, [jobKey]: 'Failed to enqueue job.' }));
    } else {
      setJobMessage(prev => ({ ...prev, [jobKey]: data?.message || 'Job enqueued.' }));
    }
    setRunningJob(null);
  }, []);

  if (loading) {
    return (
      <Grid container justifyContent='center' style={{ padding: 48 }}>
        <CircularProgress />
      </Grid>
    );
  }

  if (error || !config) {
    return (
      <Grid container justifyContent='center' style={{ padding: 48 }}>
        <Typography color='error'>{error || 'Unable to load settings.'}</Typography>
      </Grid>
    );
  }

  return (
    <Grid container spacing={3} style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h5' gutterBottom>Member Portal Settings</Typography>
        <Typography variant='body2' color='textSecondary'>
          Manage portal configuration. Changes take effect immediately.
        </Typography>
      </Grid>

      {actionError && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setActionError(null)}>{actionError}</Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val as TabKey)}
          indicatorColor='primary'
          textColor='primary'
          variant='scrollable'
          scrollButtons='auto'
        >
          {TABS.filter(t => t.key !== 'templates' || canViewPortalSettings).map(t => (
            <Tab key={t.key} id={`settings-tab-${t.key}`} value={t.key} label={t.label} />
          ))}
        </Tabs>
      </Grid>

      <Grid size={{ xs: 12 }}>
        {activeTab === 'slack' && (
          <SlackTab
            config={config}
            onFlagToggle={handleFlagToggle}
            onSettingSave={handleSettingSave}
            togglingFlag={togglingFlag}
            savingKey={savingKey}
            onRunJob={handleRunJob}
            runningJob={runningJob}
            jobMessage={jobMessage}
          />
        )}
        {activeTab === 'volunteer' && (
          <VolunteerTab
            config={config}
            onFlagToggle={handleFlagToggle}
            onSettingSave={handleSettingSave}
            togglingFlag={togglingFlag}
            savingKey={savingKey}
          />
        )}
        {activeTab === 'reservations' && (
          <ReservationsTab
            config={config}
            onSettingSave={handleSettingSave}
            savingKey={savingKey}
          />
        )}
        {activeTab === 'security' && (
          <SecurityTab
            config={config}
            onFlagToggle={handleFlagToggle}
            onSettingSave={handleSettingSave}
            togglingFlag={togglingFlag}
            savingKey={savingKey}
          />
        )}
        {activeTab === 'templates' && canViewPortalSettings && <TemplatesTab />}
        {activeTab === 'jobs' && (
          <JobsTab
            config={config}
            onRunJob={handleRunJob}
            runningJob={runningJob}
            jobMessage={jobMessage}
          />
        )}
      </Grid>
    </Grid>
  );
};

export default MemberPortalSettings;
