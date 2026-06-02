import axios from 'axios';

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers.set('X-XSRF-TOKEN', getCsrfToken());
  return config;
});

const buildResponse = async <T>(request: Promise<any>): Promise<{ data?: T; error?: string }> => {
  try {
    const r = await request;
    return { data: r.data };
  } catch (err) {
    return { error: err.response?.data?.error || err.message };
  }
};

export interface SpaceUsagePoint {
  date: string;          // "YYYY-MM" or "YYYY-MM-DD"
  unique_members: number;
}

export interface SpaceUsageDateRange {
  earliest_year: number;
  latest_year: number;
}

export const getSpaceUsage = (params?: {
  granularity?: 'day' | 'month';
  year?: number;
  month?: number;
  rolling?: '30';
}) =>
  buildResponse<SpaceUsagePoint[]>(api.get('/api/admin/space_usage', { params }));

export const getSpaceUsageDateRange = () =>
  buildResponse<SpaceUsageDateRange>(api.get('/api/admin/space_usage/date_range'));
