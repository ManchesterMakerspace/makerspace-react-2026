import axios from 'axios';
import { attachGlobalAuthInterceptor } from 'ui/common/globalAuthInterceptor';
import type { ContinuousPaidMembership, IncreaseContinuousPaidMembership } from 'makerspace-ts-api-client';
export type { ContinuousPaidMembership, IncreaseContinuousPaidMembership } from 'makerspace-ts-api-client';

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));
api.interceptors.request.use(config => {
  const token = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  config.headers.set('X-XSRF-TOKEN', token ? decodeURIComponent(token[1]) : '');
  config.headers.set('Content-Type', 'application/json');
  return config;
});

export class PaidMembershipError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request(operation: Promise<any>): Promise<ContinuousPaidMembership> {
  try { return (await operation).data; }
  catch (failure: any) {
    const data = failure.response?.data;
    throw new PaidMembershipError(data?.error?.message || data?.message ||
      'Could not load or save paid membership months. Please retry.', failure.response?.status || 0);
  }
}

export const getContinuousPaidMembership = (id: string) =>
  request(api.get(`/api/members/${encodeURIComponent(id)}/continuous_paid_membership`));

export const increaseContinuousPaidMembership = (id: string, body: IncreaseContinuousPaidMembership) =>
  request(api.put(`/api/admin/members/${encodeURIComponent(id)}/continuous_paid_membership`, body));
