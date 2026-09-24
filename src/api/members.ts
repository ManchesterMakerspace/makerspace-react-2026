import axios from "axios";
import {
  ApiDataResponse,
  ApiErrorResponse,
  MemberSummary,
} from "makerspace-ts-api-client";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";

// Local override for GET /api/members. The generated client's listMembers()
// hardcodes a param whitelist (pageNum, orderBy, order, currentMembers,
// search) -- showDeleted isn't in it, so it's silently dropped before the
// request is even sent, and the "Show deleted accounts" filter has no way
// to reach the backend through the generated function. Mirrors the pattern
// in api/invoiceOptions.ts (avoids depending on an unpublished
// makerspace-ts-api-client release) rather than fighting the generated one.

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

export interface ListMembersWithDeletedParams {
  pageNum?: number;
  orderBy?: string;
  order?: string;
  currentMembers?: boolean;
  showDeleted?: boolean;
  search?: string;
}

export const listMembersWithDeleted = (params: ListMembersWithDeletedParams = {}) =>
  buildResponse<MemberSummary[]>(api.get("/api/members", { params }));
