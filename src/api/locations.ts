import axios from "axios";
import { ApiDataResponse, ApiErrorResponse } from "makerspace-ts-api-client";
import { Location } from "app/entities/toolCheckout";
import { apiErrorMessage } from "ui/common/apiErrors";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";

const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));
api.interceptors.request.use(config => {
  config.headers.set("X-XSRF-TOKEN", getCsrfToken());
  config.headers.set("Content-Type", "application/json");
  return config;
});

const wrapHeaders = (axiosHeaders: any) => ({
  get: (key: string) => axiosHeaders[key.toLowerCase()] ?? null,
  has: (key: string) => key.toLowerCase() in axiosHeaders,
});

const buildResponse = async <T>(request: Promise<any>): Promise<ApiDataResponse<T> | (ApiErrorResponse & { data?: undefined })> => {
  try {
    const res = await request;
    return { data: res.data, response: { ...res, headers: wrapHeaders(res.headers) } };
  } catch (err: any) {
    const error = {
      status: err.response?.status || 0,
      error: err.response?.data?.error || "request_failed",
      message: apiErrorMessage(err.response?.data, err.message || "Request failed")
    };
    return { error, response: err.response };
  }
};

export const adminListLocations = (params: { shopId: string } | { shopIds: string[] }) =>
  buildResponse<Location[]>(api.get("/api/admin/locations", {
    params: "shopIds" in params ? { shop_ids: params.shopIds } : { shop_id: params.shopId },
  }));

// Plain (non-admin) equivalent -- visible to any signed-in member, for the
// member-facing shop map view. Read-only; no create/update/destroy here.
export const listLocations = (params: { shopIds: string[] }) =>
  buildResponse<Location[]>(api.get("/api/locations", { params: { shop_ids: params.shopIds } }));

export const adminCreateLocation = ({ body }: { body: Partial<Location> }) =>
  buildResponse<Location>(api.post("/api/admin/locations", {
    name: body.name,
    kind: body.kind,
    parent_id: body.parentId,
    shop_id: body.shopId,
    svg_element_id: body.svgElementId,
    x_pct: body.xPct,
    y_pct: body.yPct,
    shape_points: body.shapePoints,
  }));

export const adminUpdateLocation = ({ id, body }: { id: string; body: Partial<Location> }) =>
  buildResponse<Location>(api.put(`/api/admin/locations/${id}`, {
    name: body.name,
    kind: body.kind,
    parent_id: body.parentId,
    shop_id: body.shopId,
    svg_element_id: body.svgElementId,
    x_pct: body.xPct,
    y_pct: body.yPct,
    shape_points: body.shapePoints,
  }));

export const adminDeleteLocation = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/locations/${id}`));
