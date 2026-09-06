import axios from 'axios';
import { attachGlobalAuthInterceptor } from 'ui/common/globalAuthInterceptor';

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));
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

export interface SlackIdentityConflict {
  slack_id: string;
  slack_name: string;
  slack_email: string;
  member_id: string;
  member_name: string;
  conflicting_slack_id: string;
  conflicting_slack_name: string;
  conflicting_slack_email: string;
}

export const getSlackIdentityConflicts = () =>
  buildResponse<{ conflicts: SlackIdentityConflict[] }>(
    api.get('/api/admin/slack_identity_conflicts')
  );

export const resolveSlackIdentityConflict = ({ slackId, memberId }: { slackId: string; memberId: string }) =>
  buildResponse<{ message: string; member_id: string }>(
    api.post('/api/admin/slack_identity_conflicts/reassign', { slack_id: slackId, member_id: memberId })
  );
