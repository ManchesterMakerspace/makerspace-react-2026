import axios from 'axios';

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers.set('X-XSRF-TOKEN', getCsrfToken());
  config.headers.set('Content-Type', 'application/json');
  return config;
});

const wrapHeaders = (axiosHeaders: any) => ({
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
  /** Braintree discount ID for volunteer awards. Empty string = no credit active.
   *  The discount ID must contain 'volunteer' (e.g. volunteer_discount_10). */
  volunteer_discount_id: string;
  volunteer_task_max_credit: string;
  volunteer_bounty_token: string;
  volunteer_rolling_days: string;
  volunteer_leaderboard_top: string;
}

export interface TotpSettings {
  require_totp_admin: boolean;
  require_totp_board: boolean;
  require_totp_rm: boolean;
}

export interface SystemConfigData {
  flags: {
    slack_sync_enabled: boolean;
    volunteer_bounty_token_enabled: boolean;
    require_totp_admin: boolean;
    require_totp_board: boolean;
    require_totp_rm: boolean;
  };
  jobs: JobStatus[];
  slack: SlackSettings;
  volunteer: VolunteerSettings;
  totp: TotpSettings;
}

/** A Braintree discount as returned by /api/billing/discounts */
export interface BraintreeDiscount {
  id: string;
  name: string;
  description: string;
  amount: string;
}

export const getSystemConfigs = () =>
  buildResponse<SystemConfigData>(api.get('/api/admin/system_configs'));

export const updateSystemFlag = (key: string, value: boolean) =>
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

/**
 * Fetches Braintree discounts filtered to the 'volunteer' type.
 * Only discounts whose ID contains 'volunteer' are returned.
 * Used to populate the volunteer discount selector in admin settings.
 */
export const getBraintreeDiscounts = () =>
  buildResponse<BraintreeDiscount[]>(
    api.get('/api/billing/discounts', { params: { types: ['volunteer'] } })
  );
