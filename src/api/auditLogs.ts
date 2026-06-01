import axios from 'axios';
import { ApiDataResponse, ApiErrorResponse } from 'makerspace-ts-api-client';

export interface AuditLog {
  id:              string;
  logType:         string;
  eventType:       string;
  actorId:         string | null;
  actorName:       string | null;
  subjectId:       string | null;
  subjectName:     string | null;
  resourceType:    string;
  resourceId:      string;
  changes:         Record<string, [unknown, unknown]> | null;
  beforeSnapshot:  Record<string, unknown> | null;
  afterSnapshot:   Record<string, unknown> | null;
  slackChannel:    string | null;
  slackMessage:    string;
  slackPosted:     boolean | null;
  ipAddress:       string | null;
  createdAt:       string;
}

export interface AuditLogQueryParams {
  logType?:    string;
  eventType?:  string;
  actorId?:    string;
  subjectId?:  string;
  fromDate?:   string;
  toDate?:     string;
  pageNum?:    number;
  orderBy?:    string;
  order?:      string;
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

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers.set('X-XSRF-TOKEN', getCsrfToken());
  config.headers.set('Content-Type', 'application/json');
  return config;
});

export const adminListAuditLogs = (params: AuditLogQueryParams) =>
  buildResponse<AuditLog[]>(api.get('/api/admin/audit_logs', { params }));
