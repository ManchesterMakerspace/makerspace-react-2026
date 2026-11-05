import axios from 'axios';
import { ApiDataResponse, ApiErrorResponse } from 'makerspace-ts-api-client';
import { attachGlobalAuthInterceptor } from 'ui/common/globalAuthInterceptor';
import { apiErrorMessage } from 'ui/common/apiErrors';

// The household endpoints return snake_case JSON (the server renders these hashes directly), so the types follow it.

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

// The public invitation lookup must work before sign-in, so it must not trigger the sign-in redirect the interceptor adds.
const publicApi = axios.create({ withCredentials: true });
publicApi.interceptors.request.use(config => {
  config.headers.set('X-XSRF-TOKEN', getCsrfToken());
  config.headers.set('Content-Type', 'application/json');
  return config;
});

const wrapHeaders = (axiosHeaders: any) => ({
  get: (key: string) => axiosHeaders[key.toLowerCase()] ?? null,
  has: (key: string) => key.toLowerCase() in axiosHeaders,
});

const buildResponse = async <T>(request: Promise<any>): Promise<ApiDataResponse<T> | ApiErrorResponse> => {
  try {
    const res = await request;
    return { data: res.data as T, response: { ...res, headers: wrapHeaders(res.headers) } } as unknown as ApiDataResponse<T>;
  } catch (err) {
    return {
      error: { status: err.response?.status || 0, message: apiErrorMessage(err.response?.data, 'Something went wrong. Please try again.') },
      response: err.response,
    } as ApiErrorResponse;
  }
};

export interface HouseholdInvitationRow {
  id: string;
  email: string;
  status: 'pending' | 'expired';
  expires_at: string;
  sent_count: number;
}

export interface HouseholdMemberRow {
  id: string;
  name: string;
  email?: string | null;
  fob_issued: boolean;
  status: string;
  expiration_time?: number | null;
}

export interface HouseholdSummary {
  id: string;
  display_name: string;
  size: number;
  seats_used: number;
  payment_accepted: boolean;
  expiration_time?: number | null;
  primary: { id: string; name: string; fob_issued: boolean } | null;
  members: HouseholdMemberRow[];
  // Only for the primary.
  invitations?: HouseholdInvitationRow[];
}

export interface HouseholdState {
  role: 'primary' | 'secondary' | null;
  household_plan: boolean;
  can_invite: boolean;
  invite_blocked_reason: string | null;
  plan_size: number | null;
  household: HouseholdSummary | null;
  invited_to_a_household: boolean;
  invitation_id?: string;
}

// Once an invitation is cancelled, expired or used the server returns only its status: no names, email or address.
export interface HouseholdInvitationPublic {
  status: 'pending' | 'expired' | 'accepted' | 'revoked';
  inviter_name: string | null;
  invited_email: string | null;
  expires_at: string;
}

export interface HouseholdInvitationPreview {
  status: string;
  primary_name: string | null;
  household_address: string | null;
  your_address: string;
  address_matches: boolean;
  payment_accepted: boolean;
  blocked_reason: string | null;
  expires_at: string;
}

export const getHousehold = () => buildResponse<HouseholdState>(api.get('/api/household'));

export const inviteToHousehold = ({ email }: { email: string }) =>
  buildResponse<HouseholdState>(api.post('/api/household/invitations', { email }));

export const resendHouseholdInvitation = ({ id }: { id: string }) =>
  buildResponse<HouseholdState>(api.post(`/api/household/invitations/${id}/resend`));

export const revokeHouseholdInvitation = ({ id }: { id: string }) =>
  buildResponse<HouseholdState>(api.delete(`/api/household/invitations/${id}`));

// The token is sent in the request body, never in a path or query string, so it is not written to request logs.
export const previewHouseholdInvitation = ({ token }: { token: string }) =>
  buildResponse<HouseholdInvitationPreview>(api.post('/api/household/invitations/preview', { token }));

export const acceptHouseholdInvitation = ({ token }: { token: string }) =>
  buildResponse<HouseholdState>(api.post('/api/household/invitations/accept', { token }));

export const getHouseholdInvitationPublic = ({ token }: { token: string }) =>
  buildResponse<HouseholdInvitationPublic>(publicApi.post('/api/household_invitations/lookup', { token }));

// Staff view of a member's household (Admin::GroupsController, camelCase serializer).
export interface StaffHouseholdMember {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  status?: string;
  expirationTime?: number | null;
  fobIssued?: boolean;
}

export interface StaffHousehold {
  id: string;
  groupName: string;
  groupRep: string;
  expiry?: number | null;
  size: number;
  seatsUsed: number;
  paymentAccepted: boolean;
  primaryMember: StaffHouseholdMember | null;
  secondaryMembers: StaffHouseholdMember[];
  invitations: { id: string; email: string; status: string; expiresAt: string; sentCount: number }[];
}

export const getStaffHousehold = ({ memberId }: { memberId: string }) =>
  buildResponse<StaffHousehold>(api.get('/api/admin/groups/for_member', { params: { member_id: memberId } }));
