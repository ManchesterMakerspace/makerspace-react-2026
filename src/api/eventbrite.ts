import axios from 'axios';
import moment from 'ui/utils/moment';
import { attachGlobalAuthInterceptor } from 'ui/common/globalAuthInterceptor';
import type { SignupEvent, SignupAttribution } from 'makerspace-ts-api-client';
export type { SignupEvent, SignupAttribution } from 'makerspace-ts-api-client';

type StaffEvent = { name?: string; startsAt?: string; endsAt?: string; timezone?: string };

export interface EventbriteRecord extends StaffEvent {
  id: string; name: string; email?: string; status?: string; organizationId: string; eventbriteId: string;
  eventId?: string; event?: StaffEvent;
  invalidatedAt?: string; invalidationReason?: string; refundedAt?: string; refunded?: boolean;
  memberId?: string; memberIds?: string[]; linkConflict?: boolean; ticketClassId?: string;
  ticketClassName?: string;
  ticketClasses?: EventbriteRecord[]; attendees?: EventbriteRecord[];
}
const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));
export const defaultEventbriteDates = (now = new Date()) => {
  const today = moment.tz(now, 'America/New_York');
  return { from_date: today.format('YYYY-MM-DD'), to_date: today.clone().add(6, 'months').format('YYYY-MM-DD') };
};
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

export function staffEventLabel({ name, startsAt, endsAt, timezone }: StaffEvent) {
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const titleWords = ` ${normalize(name || '')} `;
  const options = { timeZone: timezone || 'America/New_York', year: 'numeric', day: 'numeric' } as const;
  const dates = new Set<string>();
  for (const value of [startsAt, endsAt]) {
    if (!value) continue;
    const day = new Date(value);
    if (Number.isNaN(day.getTime())) continue;
    const short = day.toLocaleDateString('en-US', { ...options, month: 'short' });
    const long = day.toLocaleDateString('en-US', { ...options, month: 'long' });
    if (![short, long].some(date => titleWords.includes(` ${normalize(date)} `))) dates.add(short);
  }
  return [name, [...dates].join(' – ')].filter(Boolean).join(' — ');
}
