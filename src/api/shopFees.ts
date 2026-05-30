import axios from "axios";
import { ApiDataResponse, ApiErrorResponse } from "makerspace-ts-api-client";
import { ShopFeeItem } from "app/entities/shopFee";

// ── Shared helpers (same pattern as src/api/rentals.ts) ──────────────────────

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
  return match ? decodeURIComponent(match[1]) : "";
};

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers.set("X-XSRF-TOKEN", getCsrfToken());
  config.headers.set("Content-Type", "application/json");
  return config;
});

// ── Shop Fee Catalog (InvoiceOptions with resource_class: "fee") ──────────────

// List all fee catalog items — uses existing public invoice_options endpoint
// filtered to resource_class: "fee". Admins see disabled ones too.
export const listShopFeeItems = (_params?: any) =>
  buildResponse<ShopFeeItem[]>(
    api.get("/api/invoice_options", { params: { types: ["fee"], only_enabled: false } })
  );

// Create a new fee catalog item
export const adminCreateShopFeeItem = ({ body }: { body: Partial<ShopFeeItem> }) =>
  buildResponse<ShopFeeItem>(
    api.post("/api/admin/invoice_options", {
      name: body.name,
      description: body.description || "",
      amount: body.amount,
      quantity: body.quantity ?? 1,
      resource_class: "fee",
      plan_id: null,
    })
  );

// Update an existing fee catalog item (name, description, amount)
export const adminUpdateShopFeeItem = ({
  id,
  body,
}: {
  id: string;
  body: Partial<ShopFeeItem>;
}) =>
  buildResponse<ShopFeeItem>(
    api.put(`/api/admin/invoice_options/${id}`, {
      name: body.name,
      description: body.description,
      amount: body.amount,
      quantity: body.quantity,
      disabled: body.disabled,
    })
  );

// Delete a fee catalog item
export const adminDeleteShopFeeItem = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/invoice_options/${id}`));

// ── Shop Charge Invoice ───────────────────────────────────────────────────────

export interface CreateShopChargeBody {
  memberId: string;
  name: string;         // invoice display name (item name or admin label)
  description: string;  // joined line item summary
  amount: number;       // combined total
  resourceClass: "fee";
  resourceId: string;   // == memberId (fee invoices are scoped to the member)
  quantity: number;     // always 1 at the invoice level (line qty handled in amount)
  dueDate: string;      // ISO date string — due immediately (today)
}

// Create a one-off fee invoice via admin invoices endpoint.
// This produces an Invoice with resource_class: "fee", no plan_id,
// so BraintreeService::Transaction.submit_invoice_for_settlement takes the
// gateway.transaction.sale path (no subscription created).
export const adminCreateShopCharge = ({ body }: { body: CreateShopChargeBody }) =>
  buildResponse<{ id: string; memberId: string; amount: string; name: string }>(
    api.post("/api/admin/invoices", {
      member_id: body.memberId,
      name: body.name,
      description: body.description,
      amount: body.amount,
      resource_class: "fee",
      resource_id: body.memberId,
      quantity: 1,
      due_date: body.dueDate,
    })
  );
