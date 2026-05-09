import axios from 'axios';

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers['X-XSRF-TOKEN'] = getCsrfToken();
  config.headers['Content-Type'] = 'application/json';
  return config;
});

const wrapHeaders = (axiosHeaders: Record<string, any>) => ({
  get: (key: string) => axiosHeaders[key.toLowerCase()] ?? null,
  has: (key: string) => key.toLowerCase() in axiosHeaders,
});

const buildResponse = async <T>(request: Promise<any>) => {
  try {
    const res = await request;
    return { data: res.data, response: { ...res, headers: wrapHeaders(res.headers) } };
  } catch (err) {
    const error = err.response?.data?.error || { message: err.message };
    return { error, response: err.response };
  }
};

export interface JobStatus {
  key: string;
  task: string;
  last_run_at: string | null;
  last_run_status: 'success' | 'failure' | null;
}

export interface SlackSettings {
  slack_channel_treasurer: string;
  slack_channel_rm: string;
  slack_channel_admin: string;
  slack_channel_logs: string;
  volunteer_pending_slack_channel: string;
}

export interface VolunteerSettings {
  volunteer_credits_per_discount: string;
  volunteer_max_discounts_per_year: string;
  volunteer_discount_amount: string;
  volunteer_task_max_credit: string;
  volunteer_bounty_token: string;
}

export interface SystemConfigData {
  flags: {
    slack_sync_enabled: boolean;
    volunteer_bounty_token_enabled: boolean;
  };
  jobs: JobStatus[];
  slack: SlackSettings;
  volunteer: VolunteerSettings;
}

export const getSystemConfigs = () =>
  buildResponse<SystemConfigData>(api.get('/api/admin/system_configs'));

export const updateSystemFlag = ({ key, value }: { key: string; value: boolean }) =>
  buildResponse<{ key: string; value: string }>(
    api.put('/api/admin/system_configs/update_flag', { key, value: value.toString() })
  );

export const updateSystemSetting = ({ key, value }: { key: string; value: string }) =>
  buildResponse<{ key: string; value: string }>(
    api.put('/api/admin/system_configs/update_setting', { key, value })
  );

export const runSystemJob = ({ key }: { key: string }) =>
  buildResponse<{ message: string }>(
    api.post('/api/admin/system_configs/run_job', { key })
  );
