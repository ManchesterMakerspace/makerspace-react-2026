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

export interface AnalyticsSummary {
  totalMembers: number;
  newMembers: number;
  subscribedMembers: number;
  pastDueInvoices: number;
  refundsPending: number;
}

export interface MemberGrowthPoint {
  month: string;   // "YYYY-MM"
  count: number;
}

export interface ActiveMemberPoint {
  date: string;    // "YYYY-MM" or "YYYY-MM-DD"
  count: number;
}

export interface CreditsMonthPoint {
  month: string;
  count: number;
  total_value: number;
}

export interface TasksMonthPoint {
  month: string;
  count: number;
}

export interface TopVolunteer {
  name: string;
  credits: number;
  value: number;
}

export interface VolunteerSummaryAnalytics {
  credits_by_month:   CreditsMonthPoint[];
  tasks_by_month:     TasksMonthPoint[];
  top_volunteers:     TopVolunteer[];
  total_credits:      number;
  total_credit_value: number;
  pending_credits:    number;
}

export const getAnalyticsSummary = () =>
  buildResponse<AnalyticsSummary>(api.get('/api/admin/analytics'));

export const getMemberGrowth = (params?: { year?: number; start_date?: string; end_date?: string }) =>
  buildResponse<MemberGrowthPoint[]>(api.get('/api/admin/analytics/member_growth', { params }));

export const getActiveMembers = (params?: { year?: number; month?: number; granularity?: 'day' | 'month' }) =>
  buildResponse<ActiveMemberPoint[]>(api.get('/api/admin/analytics/active_members', { params }));

export const getVolunteerSummaryAnalytics = (params?: { year?: number }) =>
  buildResponse<VolunteerSummaryAnalytics>(api.get('/api/admin/analytics/volunteer_summary', { params }));
