import axios from 'axios';
import { ApiDataResponse, ApiErrorResponse } from 'makerspace-ts-api-client';
import { VolunteerCredit, VolunteerTask, VolunteerEvent, VolunteerSummary } from 'app/entities/volunteer';

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

// ── Member endpoints ──────────────────────────────────────────────────────────

export const getMemberVolunteerCredits = (_params?: any) =>
  buildResponse<VolunteerCredit[]>(api.get('/api/volunteer/credits'));

export const getVolunteerSummary = (_params?: any) =>
  buildResponse<VolunteerSummary>(api.get('/api/volunteer/summary'));

export const getMemberVolunteerTasks = (_params?: any) =>
  buildResponse<VolunteerTask[]>(api.get('/api/volunteer/tasks'));

export const getMemberVolunteerEvents = (_params?: any) =>
  buildResponse<VolunteerEvent[]>(api.get('/api/volunteer/events'));

export const claimVolunteerTask = ({ id }: { id: string }) =>
  buildResponse<VolunteerTask>(api.post(`/api/volunteer/tasks/${id}/claim`));

export const completeVolunteerTask = ({ id }: { id: string }) =>
  buildResponse<VolunteerTask>(api.post(`/api/volunteer/tasks/${id}/complete`));

export const checkinVolunteerEvent = ({ id }: { id: string }) =>
  buildResponse<VolunteerEvent>(api.post(`/api/volunteer/events/${id}/checkin`));

/** Member removes their own check-in. Blocked once event is closed. */
export const removeCheckinVolunteerEvent = ({ id }: { id: string }) =>
  buildResponse<VolunteerEvent>(api.delete(`/api/volunteer/events/${id}/checkin`));

// ── Admin endpoints ───────────────────────────────────────────────────────────

export const adminListVolunteerCredits = (params?: { memberId?: string; status?: string }) =>
  buildResponse<VolunteerCredit[]>(api.get('/api/admin/volunteer_credits', { params }));

export const adminAwardVolunteerCredit = ({ body }: { body: { memberId: string; description: string } }) =>
  buildResponse<VolunteerCredit>(api.post('/api/admin/volunteer_credits', {
    member_id:   body.memberId,
    description: body.description,
  }));

export const adminApproveVolunteerCredit = ({ id }: { id: string }) =>
  buildResponse<VolunteerCredit>(api.post(`/api/admin/volunteer_credits/${id}/approve`));

export const adminRejectVolunteerCredit = ({ id }: { id: string }) =>
  buildResponse<VolunteerCredit>(api.post(`/api/admin/volunteer_credits/${id}/reject`));

/** Reverse an approved credit. Admin/board only. Creates a negative offsetting record. */
export const adminReverseVolunteerCredit = ({ id, reason }: { id: string; reason: string }) =>
  buildResponse<VolunteerCredit>(api.post(`/api/admin/volunteer_credits/${id}/reverse`, { reason }));

export const adminDeleteVolunteerCredit = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/volunteer_credits/${id}`));

export const adminListVolunteerTasks = (params?: { status?: string }) =>
  buildResponse<VolunteerTask[]>(api.get('/api/admin/volunteer_tasks', { params }));

export const adminCreateVolunteerTask = ({ body }: { body: Partial<VolunteerTask> }) =>
  buildResponse<VolunteerTask>(api.post('/api/admin/volunteer_tasks', {
    title:        body.title,
    description:  body.description,
    credit_value: body.creditValue,
    shop_id:      body.shopId || null,
  }));

export const adminUpdateVolunteerTask = ({ id, body }: { id: string; body: Partial<VolunteerTask> }) =>
  buildResponse<VolunteerTask>(api.put(`/api/admin/volunteer_tasks/${id}`, {
    title:        body.title,
    description:  body.description,
    credit_value: body.creditValue,
    shop_id:      body.shopId || null,
  }));

export const adminCompleteVolunteerTask = ({ id }: { id: string }) =>
  buildResponse<VolunteerTask>(api.post(`/api/admin/volunteer_tasks/${id}/complete`));

export const adminCancelVolunteerTask = ({ id }: { id: string }) =>
  buildResponse<VolunteerTask>(api.post(`/api/admin/volunteer_tasks/${id}/cancel`));

export const adminReleaseVolunteerTask = ({ id, reason }: { id: string; reason: string }) =>
  buildResponse<VolunteerTask>(api.post(`/api/admin/volunteer_tasks/${id}/release`, { reason }));

export const adminRejectPendingVolunteerTask = ({ id, reason }: { id: string; reason: string }) =>
  buildResponse<VolunteerTask>(api.post(`/api/admin/volunteer_tasks/${id}/reject_pending`, { reason }));

export const adminDeleteVolunteerTask = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/volunteer_tasks/${id}`));

// ── Admin event endpoints ─────────────────────────────────────────────────────

export const adminListVolunteerEvents = (params?: { status?: string }) =>
  buildResponse<VolunteerEvent[]>(api.get('/api/admin/volunteer_events', { params }));

export const adminCreateVolunteerEvent = ({ body }: { body: Partial<VolunteerEvent> }) =>
  buildResponse<VolunteerEvent>(api.post('/api/admin/volunteer_events', {
    title:        body.title,
    description:  body.description,
    credit_value: body.creditValue,
    event_date:   body.eventDate || null,
  }));

export const adminCloseVolunteerEvent = ({ id }: { id: string }) =>
  buildResponse<VolunteerEvent>(api.post(`/api/admin/volunteer_events/${id}/close`));

export const adminAddEventAttendee = ({ id, memberId }: { id: string; memberId: string }) =>
  buildResponse<VolunteerEvent>(api.post(`/api/admin/volunteer_events/${id}/add_attendee`, {
    member_id: memberId,
  }));

/** Admin removes a member's check-in from an open event. DMs the member. */
export const adminRemoveEventAttendee = ({ id, memberId }: { id: string; memberId: string }) =>
  buildResponse<VolunteerEvent>(api.delete(`/api/admin/volunteer_events/${id}/remove_attendee`, {
    data: { member_id: memberId },
  }));

export const adminDeleteVolunteerEvent = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/volunteer_events/${id}`));
