import axios from "axios";
import {
  Reservation, ReservationCatalog, ReservationInput, ReservationPreview
} from "app/entities/reservation";
import { apiErrorMessage } from "ui/common/apiErrors";

const token = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const api = axios.create({ withCredentials: true });
api.interceptors.request.use(config => {
  config.headers.set("X-XSRF-TOKEN", token());
  config.headers.set("Content-Type", "application/json");
  return config;
});

const wrap = async <T>(request: Promise<any>) => {
  try {
    const response = await request;
    return { data: response.data, response };
  } catch (err: any) {
    return {
      error: { message: apiErrorMessage(err.response?.data, err.message || "Request failed") },
      response: err.response
    };
  }
};

const body = (input: ReservationInput) => ({
  title: input.title,
  shop_id: input.shopId,
  reservation_scope: input.reservationScope,
  tool_ids: input.toolIds,
  start_at: input.startAt,
  end_at: input.endAt,
});

export const getReservationCatalog = (_params?: any) =>
  wrap<ReservationCatalog>(api.get("/api/reservation_catalog"));

export const listReservations = (params?: {
  shopId?: string; startAt?: string; endAt?: string; mine?: boolean; status?: string;
}) => wrap<Reservation[]>(api.get("/api/reservations", { params: {
  shop_id: params?.shopId,
  start_at: params?.startAt,
  end_at: params?.endAt,
  mine: params?.mine,
  status: params?.status,
} }));

export const getReservationAvailability = (params: { date: string; shopId?: string }) =>
  wrap<Reservation[]>(api.get("/api/reservations/availability", { params: {
    date: params.date,
    shop_id: params.shopId,
  } }));

export const previewReservation = ({ body: input }: { body: ReservationInput }) =>
  wrap<ReservationPreview>(api.post("/api/reservations/preview", body(input)));

export const createReservation = ({ body: input }: { body: ReservationInput }) =>
  wrap<Reservation>(api.post("/api/reservations", body(input)));

export const updateReservation = ({ id, body: input }: { id: string; body: ReservationInput }) =>
  wrap<Reservation>(api.put(`/api/reservations/${id}`, body(input)));

export const previewManagedReservation = ({ id, body: input }: { id: string; body: ReservationInput }) =>
  wrap<ReservationPreview>(api.post(`/api/admin/reservations/${id}/preview`, body(input)));

export const updateManagedReservation = ({ id, body: input }: { id: string; body: ReservationInput }) =>
  wrap<Reservation>(api.put(`/api/admin/reservations/${id}`, body(input)));

export const cancelReservation = ({ id }: { id: string }) =>
  wrap<Reservation>(api.delete(`/api/reservations/${id}`));

export const listManagedReservations = (params?: { shopId?: string; status?: string; future?: boolean }) =>
  wrap<Reservation[]>(api.get("/api/admin/reservations", { params: {
    shop_id: params?.shopId,
    status: params?.status,
    future: params?.future,
  } }));

export const approveReservation = ({ id, body: value }: { id: string; body?: { decisionNote?: string } }) =>
  wrap<Reservation>(api.post(`/api/admin/reservations/${id}/approve`, {
    decision_note: value?.decisionNote
  }));

export const denyReservation = ({ id, body: value }: { id: string; body?: { decisionNote?: string } }) =>
  wrap<Reservation>(api.post(`/api/admin/reservations/${id}/deny`, {
    decision_note: value?.decisionNote
  }));

export const cancelManagedReservation = ({ id }: { id: string }) =>
  wrap<Reservation>(api.delete(`/api/admin/reservations/${id}`));
