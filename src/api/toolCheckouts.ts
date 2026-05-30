import axios from "axios";
import { Shop, Tool, ToolCheckout, CheckoutApprover } from "app/entities/toolCheckout";

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
  } catch (err) {
    const error = err.response?.data?.error || { message: err.message };
    return { error, response: err.response };
  }
};

// ── Shops ─────────────────────────────────────────────────────────────────────

export const listShops = (_params?: any) =>
  buildResponse<Shop[]>(api.get("/api/shops"));

export const adminCreateShop = ({ body }: { body: Partial<Shop> }) =>
  buildResponse<Shop>(api.post("/api/admin/shops", {
    name: body.name,
    slack_channel: body.slackChannel,
  }));

export const adminUpdateShop = ({ id, body }: { id: string; body: Partial<Shop> }) =>
  buildResponse<Shop>(api.put(`/api/admin/shops/${id}`, {
    name: body.name,
    slack_channel: body.slackChannel,
    disabled: body.disabled,
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
    prerequisite_ids: body.prerequisiteIds || [],
  }));

export const adminUpdateTool = ({ id, body }: { id: string; body: Partial<Tool> }) =>
  buildResponse<Tool>(api.put(`/api/admin/tools/${id}`, {
    name: body.name,
    description: body.description,
    shop_id: body.shopId,
    disabled: body.disabled,
    prerequisite_ids: body.prerequisiteIds || [],
  }));

export const adminDeleteTool = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/tools/${id}`));

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

// ── Checkout Approvers ────────────────────────────────────────────────────────

export const listCheckoutApprovers = (_params?: any) =>
  buildResponse<CheckoutApprover[]>(api.get("/api/admin/checkout_approvers"));

export const adminCreateCheckoutApprover = ({ body }: {
  body: { memberId: string; shopIds: string[] }
}) =>
  buildResponse<CheckoutApprover>(api.post("/api/admin/checkout_approvers", {
    member_id: body.memberId,
    shop_ids: body.shopIds,
  }));

export const adminUpdateCheckoutApprover = ({ id, body }: {
  id: string;
  body: { shopIds: string[] }
}) =>
  buildResponse<CheckoutApprover>(api.put(`/api/admin/checkout_approvers/${id}`, {
    shop_ids: body.shopIds,
  }));

export const adminDeleteCheckoutApprover = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/checkout_approvers/${id}`));
