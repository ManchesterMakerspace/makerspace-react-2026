import axios from "axios";
import { ApiDataResponse, ApiErrorResponse } from "makerspace-ts-api-client";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";

// "Pay now" for a past-due Braintree subscription. The generated client is not republished with these fields, so the calls live
// here. The server renders camelCase JSON for the subscription and for the refusals below.

export type PayNowBlockedReason = "hard_decline" | "cooldown" | "daily_cap" | "unavailable";

export interface PayNowSubscription {
  id: string;
  planId?: string;
  status: string;
  amount?: string;
  canPayNow: boolean;
  payNowBlockedReason: PayNowBlockedReason | null;
  lastFailureMessage: string | null;
  nextPayNowAt: string | null;
}

/** A Pay now request the server turned down or the bank declined (HTTP 422 or 429). */
export interface PayNowRefusal {
  status: number;
  error: "payment_declined" | PayNowBlockedReason;
  message: string;
  failureType?: string | null;
  failureMessage?: string | null;
  canPayNow?: boolean;
  payNowBlockedReason?: PayNowBlockedReason | null;
  nextPayNowAt?: string | null;
}

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

const ok = <T>(res: any) =>
  ({ data: res.data as T, response: { ...res, headers: wrapHeaders(res.headers) } }) as unknown as ApiDataResponse<T>;

export const getPayNowSubscription = async (params: { id: string }): Promise<ApiDataResponse<PayNowSubscription> | ApiErrorResponse> => {
  try {
    return ok<PayNowSubscription>(await api.get(`/api/billing/subscriptions/${encodeURIComponent(params.id)}`));
  } catch (err: any) {
    return {
      error: { status: err.response?.status || 0, message: err.response?.data?.message || "Could not load your payment status." },
      response: err.response,
    } as ApiErrorResponse;
  }
};

export type PayNowResult =
  | { paid: true; subscription: PayNowSubscription }
  | { paid: false; refusal: PayNowRefusal };

/** Presses Pay now. A decline or refusal is a result (not a thrown error) because the screen shows it as part of its normal states. */
export const payNow = async (id: string): Promise<PayNowResult> => {
  try {
    const res = await api.post<PayNowSubscription>(`/api/billing/subscriptions/${encodeURIComponent(id)}/pay_now`, {});
    return { paid: true, subscription: res.data };
  } catch (err: any) {
    const status = err.response?.status || 0;
    const body = err.response?.data || {};
    if (status === 422 || status === 429) {
      return { paid: false, refusal: { ...body, status, message: body.message || "Your payment could not be made." } as PayNowRefusal };
    }
    return {
      paid: false,
      refusal: { status, error: "unavailable", message: body.message || "Something went wrong. Please try again." },
    };
  }
};
