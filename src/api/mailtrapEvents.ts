import axios from 'axios';
import { ApiDataResponse, ApiErrorResponse } from 'makerspace-ts-api-client';
import { attachGlobalAuthInterceptor } from 'ui/common/globalAuthInterceptor';

export interface MailtrapEvent {
  id: string;
  occurred_at: string;
  status: string;
  event_type: string;
  email: string;
  message_id: string;
  sending_domain_name: string;
  sending_stream: string;
  subject?: string;
  mailer_class?: string;
  action?: string;
}

const wrapHeaders = (axiosHeaders: any) => ({
  get: (key: string) => axiosHeaders[key.toLowerCase()] ?? null,
  has: (key: string) => key.toLowerCase() in axiosHeaders,
});

const buildResponse = async <T>(
  request: Promise<any>
): Promise<ApiDataResponse<T> | ApiErrorResponse> => {
  try {
    const axiosResponse = await request;
    return {
      data: axiosResponse.data,
      response: { ...axiosResponse, headers: wrapHeaders(axiosResponse.headers) },
    } as ApiDataResponse<T>;
  } catch (err) {
    const error = err.response
      ? err.response.data?.error || { message: err.response.data?.message || err.message }
      : { message: err.message };
    return { error, response: err.response } as unknown as ApiErrorResponse;
  }
};

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

export const adminListMailtrapEvents = (params: { memberId: string }) =>
  buildResponse<MailtrapEvent[]>(api.get(`/api/admin/members/${params.memberId}/mailtrap_events`));
