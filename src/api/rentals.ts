import axios from "axios";
import { ApiDataResponse, ApiErrorResponse } from "makerspace-ts-api-client";
import { RentalType, RentalSpot } from "app/entities/rentalSpot";

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

// ─── Rental Types ─────────────────────────────────────────────────────────────
export const listRentalTypes = (_params?: any) =>
  buildResponse<RentalType[]>(api.get("/api/rental_types"));

export const adminListRentalTypes = (_params?: any) =>
  buildResponse<RentalType[]>(api.get("/api/admin/rental_types"));

export const adminCreateRentalType = ({ body }: { body: Partial<RentalType> }) =>
  buildResponse<RentalType>(api.post("/api/admin/rental_types", body));

export const adminUpdateRentalType = ({ id, body }: { id: string; body: Partial<RentalType> }) =>
  buildResponse<RentalType>(api.put(`/api/admin/rental_types/${id}`, body));

export const adminDeleteRentalType = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/rental_types/${id}`));

// ─── Rental Spots ─────────────────────────────────────────────────────────────
export const listRentalSpots = (params?: { available?: string; rentalTypeId?: string }) =>
  buildResponse<RentalSpot[]>(api.get("/api/rental_spots", { params }));

export const adminListRentalSpots = (params?: any) =>
  buildResponse<RentalSpot[]>(api.get("/api/admin/rental_spots", { params }));

export const adminCreateRentalSpot = ({ body }: { body: Partial<RentalSpot> }) =>
  buildResponse<RentalSpot>(api.post("/api/admin/rental_spots", body));

export const adminUpdateRentalSpot = ({ id, body }: { id: string; body: Partial<RentalSpot> }) =>
  buildResponse<RentalSpot>(api.put(`/api/admin/rental_spots/${id}`, body));

export const adminDeleteRentalSpot = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/admin/rental_spots/${id}`));

// ─── Member Rentals ───────────────────────────────────────────────────────────

// Creates rental with status pending_agreement (or pending if approval required)
// No invoice is generated at this point
export const createRental = ({ body }: { body: { rentalSpotId: string; notes?: string } }) =>
  buildResponse<any>(api.post("/api/rentals", body));

// Called when member signs the agreement — triggers invoice generation
export const cancelRental = ({ id, body }: { id: string; body: { vacated: boolean } }) =>
  buildResponse<{}>(api.delete(`/api/rentals/${id}/cancel`, { data: body }));

// Called when a vacating rental is marked as fully vacated
export const markRentalVacated = ({ id }: { id: string }) =>
  buildResponse<{}>(api.post(`/api/rentals/${id}/mark_vacated`));

// Called when member declines the agreement — voids the rental
export const declineRentalAgreement = ({ id }: { id: string }) =>
  buildResponse<{}>(api.delete(`/api/rentals/${id}/decline_agreement`));

// ─── Admin Rentals ────────────────────────────────────────────────────────────
export const adminListPendingRentals = (_params?: any) =>
  buildResponse<any[]>(api.get("/api/admin/rentals", { params: { status: "pending" } }));

export const approveRental = ({ id }: { id: string }) =>
  buildResponse<{}>(api.post(`/api/admin/rentals/${id}/approve`));

export const denyRental = ({ id, body }: { id: string; body?: { reason?: string } }) =>
  buildResponse<{}>(api.post(`/api/admin/rentals/${id}/deny`, body || {}));
