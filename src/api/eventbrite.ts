import axios from 'axios';
import { attachGlobalAuthInterceptor } from 'ui/common/globalAuthInterceptor';
import type { SignupEvent, SignupAttribution } from 'makerspace-ts-api-client';
export type { SignupEvent, SignupAttribution } from 'makerspace-ts-api-client';

export interface EventbriteRecord {
  id: string; name: string; email?: string; status?: string; organizationId: string; eventbriteId: string;
  eventId?: string; startsAt?: string; timezone?: string; event?: Omit<SignupEvent, 'id'>;
  invalidatedAt?: string; invalidationReason?: string; refundedAt?: string; refunded?: boolean;
  memberId?: string; memberIds?: string[]; linkConflict?: boolean; ticketClassId?: string;
  ticketClassName?: string;
  ticketClasses?: EventbriteRecord[]; attendees?: EventbriteRecord[];
}
const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));
export const signupEvents = async (): Promise<SignupEvent[]> => (await api.get('/api/signup_events')).data;
export const saveSignupSource = async (body: SignupAttribution) => {
  const csrf = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return (await api.put('/api/signup_source', body, { headers: { 'X-XSRF-TOKEN': csrf ? decodeURIComponent(csrf[1]) : '' } })).data;
};
export const listEventbrite = async (kind: string, params: Record<string, string | number>, memberId?: string) => {
  const base = memberId ? `/api/admin/members/${encodeURIComponent(memberId)}/eventbrite` : '/api/admin/eventbrite';
  const response = await api.get(`${base}/${kind}`, { params });
  return { records: response.data as EventbriteRecord[], total: Number(response.headers['total-items'] || 0) };
};
export const getEventbrite = async (kind: string, id: string): Promise<EventbriteRecord> =>
  (await api.get(`/api/admin/eventbrite/${kind}/${encodeURIComponent(id)}`)).data;
export const sourcePayload = (value: string, detail?: string): SignupAttribution => value?.startsWith('event:')
  ? { signupSource: 'eventbrite', signupEventbriteEventId: value.slice(6) }
  : { signupSource: value || '', signupSourceDetail: detail || '' };
export const eventLabel = (event: Omit<SignupEvent, 'id'>) => `${event.name} — ${new Date(event.startsAt).toLocaleDateString('en-US', { timeZone: event.timezone || 'America/New_York', year: 'numeric', month: 'short', day: 'numeric' })}`;
