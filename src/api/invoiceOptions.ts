import axios from "axios";
import {
  ApiDataResponse,
  ApiErrorResponse,
  InvoiceOption,
} from "makerspace-ts-api-client";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";

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
  } catch (err: any) {
    const error = err.response
      ? err.response.data?.error || { message: err.response.data?.message || err.message }
      : { message: err.message };
    return { error, response: err.response } as unknown as ApiErrorResponse;
  }
};

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));

export const listSignupInvoiceOptions = (_params: Record<string, never> = {}) =>
  buildResponse<InvoiceOption[]>(api.get("/api/invoice_options/signup"));
