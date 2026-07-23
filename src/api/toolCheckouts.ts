import axios from "axios";
import {
  Shop, Tool, ToolCheckout, CheckoutApprover, ToolCheckoutRequest, GoogleCalendarColor
} from "app/entities/toolCheckout";
import { apiErrorMessage } from "ui/common/apiErrors";

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers.set("X-XSRF-TOKEN", getCsrfToken());
  config.headers.set("Content-Type", "application/json");
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
  } catch (err: any) {
    const error = {
      message: apiErrorMessage(err.response?.data, err.message || "Request failed")
    };
    return { error, response: err.response };
  }
};

// ── Shops ─────────────────────────────────────────────────────────────────────

export const listShops = (_params?: any) =>
  buildResponse<Shop[]>(api.get("/api/shops"));

export const listManagedShops = (_params?: any) =>
  buildResponse<Shop[]>(api.get("/api/admin/shops"));

export const listGoogleCalendarColors = (_params?: any) =>
  buildResponse<{ colors: GoogleCalendarColor[] }>(api.get("/api/admin/google_calendar/colors"));

export const adminCreateShop = ({ body }: { body: Partial<Shop> }) =>
  buildResponse<Shop>(api.post("/api/admin/shops", {
    name: body.name,
    slack_channel: body.slackChannel,
    reservable: body.reservable,
    max_concurrent_reservations: body.maxConcurrentReservations,
    reservation_horizon_days: body.reservationHorizonDays,
    max_reservation_duration_hours: body.maxReservationDurationHours,
    reservation_requires_approval: body.reservationRequiresApproval,
    reservation_prerequisite_tool_ids: body.reservationPrerequisiteToolIds || [],
    color_id: body.colorId,
  }));

export const adminUpdateShop = ({ id, body }: { id: string; body: Partial<Shop> }) =>
  buildResponse<Shop>(api.put(`/api/admin/shops/${id}`, {
    name: body.name,
    slack_channel: body.slackChannel,
    disabled: body.disabled,
    reservable: body.reservable,
    max_concurrent_reservations: body.maxConcurrentReservations,
    reservation_horizon_days: body.reservationHorizonDays,
    max_reservation_duration_hours: body.maxReservationDurationHours,
    reservation_requires_approval: body.reservationRequiresApproval,
    reservation_prerequisite_tool_ids: body.reservationPrerequisiteToolIds || [],
    color_id: body.colorId,
  }));

export const adminDeleteShop = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/shops/${id}`));

// ── Tools ─────────────────────────────────────────────────────────────────────

export const listTools = (params?: { shopId?: string }) =>
  buildResponse<Tool[]>(api.get("/api/admin/tools", {
    params: params?.shopId ? { shop_id: params.shopId } : {}
  }));

export const adminCreateTool = ({ body }: { body: Partial<Tool> }) =>
  buildResponse<Tool>(api.post("/api/admin/tools", {
    name: body.name,
    description: body.description,
    shop_id: body.shopId,
    disabled: body.disabled,
    announce: body.announce,
    announce_channel: body.announceChannel,
    users_channel: body.usersChannel,
    prerequisite_ids: body.prerequisiteIds || [],
    reservable: body.reservable,
    max_concurrent_reservations: body.maxConcurrentReservations,
    reservation_horizon_days: body.reservationHorizonDays,
    max_reservation_duration_hours: body.maxReservationDurationHours,
    reservation_requires_approval: body.reservationRequiresApproval,
    reservation_prerequisite_tool_ids: body.reservationPrerequisiteToolIds || [],
  }));

export const adminUpdateTool = ({ id, body }: { id: string; body: Partial<Tool> }) =>
  buildResponse<Tool>(api.put(`/api/admin/tools/${id}`, {
    name: body.name,
    description: body.description,
    shop_id: body.shopId,
    disabled: body.disabled,
    announce: body.announce,
    announce_channel: body.announceChannel,
    users_channel: body.usersChannel,
    prerequisite_ids: body.prerequisiteIds || [],
    reservable: body.reservable,
    max_concurrent_reservations: body.maxConcurrentReservations,
    reservation_horizon_days: body.reservationHorizonDays,
    max_reservation_duration_hours: body.maxReservationDurationHours,
    reservation_requires_approval: body.reservationRequiresApproval,
    reservation_prerequisite_tool_ids: body.reservationPrerequisiteToolIds || [],
  }));

export const adminDeleteTool = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/tools/${id}`));

const tableParams = (params?: any) => ({
  ...(params?.orderBy && { order_by: params.orderBy }),
  ...(params?.order && { order: params.order }),
  ...(params?.pageNum !== undefined && { page_num: params.pageNum }),
  ...(params?.search && { search: params.search }),
});

export const listAvailableTools = (params?: any) =>
  buildResponse<Tool[]>(api.get("/api/tools", { params: tableParams(params) }));

// ── Tool Checkouts ────────────────────────────────────────────────────────────

export const listToolCheckouts = (params?: {
  memberId?: string;
  shopId?: string;
  toolId?: string;
  active?: boolean;
}) =>
  buildResponse<ToolCheckout[]>(api.get("/api/admin/tool_checkouts", {
    params: {
      ...(params?.memberId && { member_id: params.memberId }),
      ...(params?.shopId && { shop_id: params.shopId }),
      ...(params?.toolId && { tool_id: params.toolId }),
      ...(params?.active !== undefined && { active: params.active }),
    }
  }));

export const listMemberCheckouts = (params?: { memberId?: string }) =>
  buildResponse<ToolCheckout[]>(api.get("/api/tool_checkouts", {
    params: params?.memberId ? { member_id: params.memberId } : {}
  }));

export const adminCreateToolCheckout = ({ body }: {
  body: { memberId: string; toolId: string }
}) =>
  buildResponse<ToolCheckout & { unmetPrerequisites?: string[] }>(
    api.post("/api/admin/tool_checkouts", {
      member_id: body.memberId,
      tool_id: body.toolId,
    })
  );

export const adminRevokeToolCheckout = ({ id, body }: {
  id: string;
  body: { revocationReason: string }
}) =>
  buildResponse<ToolCheckout>(
    api.delete(`/api/admin/tool_checkouts/${id}`, {
      data: { revocation_reason: body.revocationReason }
    })
  );

export const listToolCheckoutRequests = (params?: any) =>
  buildResponse<ToolCheckoutRequest[]>(api.get("/api/admin/tool_checkout_requests", {
    params: tableParams(params)
  }));

export const listMyToolCheckoutRequests = (params?: any) =>
  buildResponse<ToolCheckoutRequest[]>(api.get("/api/tool_checkout_requests", {
    params: tableParams(params)
  }));

export const createToolCheckoutRequest = ({ body }: {
  body: { toolId: string; note?: string }
}) =>
  buildResponse<ToolCheckoutRequest>(api.post("/api/tool_checkout_requests", {
    tool_id: body.toolId,
    note: body.note,
  }));

export const updateToolCheckoutRequest = ({ id, body }: {
  id: string;
  body: { note?: string }
}) =>
  buildResponse<ToolCheckoutRequest>(api.put(`/api/tool_checkout_requests/${id}`, {
    note: body.note,
  }));

export const deleteToolCheckoutRequest = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/tool_checkout_requests/${id}`));

// ── Checkout Approvers ────────────────────────────────────────────────────────

export const listCheckoutApprovers = (_params?: any) =>
  buildResponse<CheckoutApprover[]>(api.get("/api/admin/checkout_approvers"));

export const adminCreateCheckoutApprover = ({ body }: {
  body: { memberId: string; shopIds: string[]; toolIds: string[] }
}) =>
  buildResponse<CheckoutApprover>(api.post("/api/admin/checkout_approvers", {
    member_id: body.memberId,
    shop_ids: body.shopIds,
    tool_ids: body.toolIds,
  }));

export const adminUpdateCheckoutApprover = ({ id, body }: {
  id: string;
  body: { shopIds: string[]; toolIds: string[] }
}) =>
  buildResponse<CheckoutApprover>(api.put(`/api/admin/checkout_approvers/${id}`, {
    shop_ids: body.shopIds,
    tool_ids: body.toolIds,
  }));

export const adminDeleteCheckoutApprover = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/checkout_approvers/${id}`));
