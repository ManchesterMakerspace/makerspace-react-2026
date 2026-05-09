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
} from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import CancelIcon from '@material-ui/icons/Cancel';

import {
  getSystemConfigs,
  updateSystemFlag,
  updateSystemSetting,
  runSystemJob,
  SystemConfigData,
  JobStatus,
} from 'api/systemConfig';

type TabKey = 'slack' | 'volunteer' | 'jobs';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'slack',     label: 'Slack' },
  { key: 'volunteer', label: 'Volunteer' },
  { key: 'jobs',      label: 'Jobs' },
];

const JOB_LABELS: Record<string, string> = {
  slack_sync:      'Slack User Sync',
  member_review:   'Member Review',
  invoice_review:  'Invoice Review',
  garbage_collect: 'Garbage Collector',
  db_backup:       'Database Backup',
};

const JOB_DESCRIPTIONS: Record<string, string> = {
  slack_sync:      'Bulk syncs Slack workspace users to member records by matching email. Use Run Now after onboarding a batch of new members.',
  member_review:   'Reviews membership statuses and sends a weekly summary report to Slack.',
  invoice_review:  'Reviews invoice statuses, flags past due accounts, and reports to the treasurer channel.',
  garbage_collect: 'Cleans up old Redis invoicing cache keys from the previous month.',
  db_backup:       'Backs up the MongoDB database to Google Drive.',
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
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, settingKey, value, onSave, saving }) => {
  const [editing, setEditing]   = React.useState(false);
  const [draft, setDraft]       = React.useState(value);

  React.useEffect(() => { setDraft(value); }, [value]);

  const handleSave = async () => {
    await onSave(settingKey, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <Grid container alignItems='center' spacing={1} style={{ marginBottom: 12 }}>
      <Grid item xs={12} sm={4}>
        <Typography variant='body1'>{label}</Typography>
        {description && (
          <Typography variant='caption' color='textSecondary'>{description}</Typography>
        )}
      </Grid>
      <Grid item xs={12} sm={8}>
        {editing ? (
          <TextField
            value={draft}
            onChange={e => setDraft(e.target.value)}
            size='small'
            variant='outlined'
            fullWidth
            disabled={saving}
            InputProps={{
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
            }}
          />
        ) : (
          <Grid container alignItems='center' spacing={1}>
            <Grid item>
              <Typography variant='body2' style={{ fontFamily: 'monospace' }}>
                {value || <span style={{ color: '#999' }}>not set</span>}
              </Typography>
            </Grid>
            <Grid item>
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

  return (
    <Grid container spacing={3}>
      {/* Channel names */}
      <Grid item xs={12}>
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

      {/* Slack sync */}
      <Grid item xs={12}>
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
            {slackSyncJob && (
              <Grid container alignItems='center' spacing={2} style={{ marginTop: 12 }}>
                <Grid item>
                  <Typography variant='caption' color='textSecondary'>
                    Last run: {formatDate(slackSyncJob.last_run_at)}
                  </Typography>
                </Grid>
                <Grid item>
                  {slackSyncJob.last_run_status === 'success' && (
                    <Chip icon={<CheckCircleIcon />} label='Success' size='small' style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }} />
                  )}
                  {slackSyncJob.last_run_status === 'failure' && (
                    <Chip icon={<ErrorIcon />} label='Failed' size='small' style={{ backgroundColor: '#ffebee', color: '#c62828' }} />
                  )}
                </Grid>
                <Grid item>
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
    <Grid item xs={12}>
      <Card>
        <CardHeader title='Credit Thresholds' subheader='Controls how credits translate into billing discounts.' />
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
          <SettingRow
            label='Discount Amount ($)'
            description='Dollar amount applied to next billing cycle. Set to 0 to disable until board decides.'
            settingKey='volunteer_discount_amount'
            value={config.volunteer.volunteer_discount_amount}
            onSave={onSettingSave}
            saving={savingKey === 'volunteer_discount_amount'}
          />
        </CardContent>
      </Card>
    </Grid>

    <Grid item xs={12}>
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

    <Grid item xs={12}>
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
            description='Token appended to the bounty URL: /volunteer/bounties?token=...'
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
      <Grid item xs={12} key={job.key}>
        <Card variant='outlined'>
          <CardContent>
            <Grid container alignItems='center' spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant='body1'>{JOB_LABELS[job.key] || job.key}</Typography>
                <Typography variant='caption' color='textSecondary'>
                  {JOB_DESCRIPTIONS[job.key] || job.task}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant='caption' color='textSecondary'>Last run</Typography>
                <Typography variant='body2'>{formatDate(job.last_run_at)}</Typography>
              </Grid>
              <Grid item xs={6} sm={2}>
                {job.last_run_status === 'success' && (
                  <Chip icon={<CheckCircleIcon />} label='Success' size='small' style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }} />
                )}
                {job.last_run_status === 'failure' && (
                  <Chip icon={<ErrorIcon />} label='Failed' size='small' style={{ backgroundColor: '#ffebee', color: '#c62828' }} />
                )}
                {!job.last_run_status && <Chip label='No data' size='small' />}
              </Grid>
              <Grid item xs={6} sm={3}>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const MemberPortalSettings: React.FC = () => {
  const [activeTab, setActiveTab]       = React.useState<TabKey>('slack');
  const [config, setConfig]             = React.useState<SystemConfigData | null>(null);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState<string | null>(null);
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
    const { error: err } = await updateSystemFlag({ key, value: !current });
    if (!err && config) {
      setConfig({
        ...config,
        flags: { ...config.flags, [key]: !current },
      });
    }
    setTogglingFlag(null);
  }, [config]);

  const handleSettingSave = React.useCallback(async (key: string, value: string) => {
    setSavingKey(key);
    const { error: err } = await updateSystemSetting({ key, value });
    if (!err && config) {
      // Update the correct section based on key prefix
      if (key.startsWith('slack_channel') || key === 'volunteer_pending_slack_channel') {
        setConfig({ ...config, slack: { ...config.slack, [key]: value } });
      } else if (key.startsWith('volunteer_')) {
        setConfig({ ...config, volunteer: { ...config.volunteer, [key]: value } });
      }
    }
    setSavingKey(null);
  }, [config]);

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
      <Grid container justify='center' style={{ padding: 48 }}>
        <CircularProgress />
      </Grid>
    );
  }

  if (error || !config) {
    return (
      <Grid container justify='center' style={{ padding: 48 }}>
        <Typography color='error'>{error || 'Unable to load settings.'}</Typography>
      </Grid>
    );
  }

  return (
    <Grid container spacing={3} style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Grid item xs={12}>
        <Typography variant='h5' gutterBottom>Member Portal Settings</Typography>
        <Typography variant='body2' color='textSecondary'>
          Manage portal configuration. Changes take effect immediately.
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val as TabKey)}
          indicatorColor='primary'
          textColor='primary'
          variant='scrollable'
          scrollButtons='auto'
        >
          {TABS.map(t => (
            <Tab key={t.key} id={`settings-tab-${t.key}`} value={t.key} label={t.label} />
          ))}
        </Tabs>
      </Grid>

      <Grid item xs={12}>
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
