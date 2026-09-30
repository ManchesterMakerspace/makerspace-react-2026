import axios from "axios";
import { ApiDataResponse, ApiErrorResponse, Member } from "makerspace-ts-api-client";
import { attachGlobalAuthInterceptor } from "ui/common/globalAuthInterceptor";
import { apiErrorMessage } from "ui/common/apiErrors";

export type HomeMember = Member & {
  household?: { displayName?: string; role?: "primary" | "secondary" } | null;
  householdRole?: "primary" | "secondary" | null;
  earnedMembershipActive?: boolean;
  paidPendingStart?: boolean;
};

export interface HomeVolunteerOpportunity {
  id: string;
  kind: "task" | "event";
  title: string;
  description: string | null;
  creditValue: number;
  shopName: string | null;
  eventDate: string | null;
}

export interface HomeData {
  member: HomeMember;
  slack: { accepted: boolean; newMembersChannelUrl: string | null };
  availableVolunteerOpportunities: HomeVolunteerOpportunity[];
  availableCheckouts: Array<{
    id: string;
    name: string;
    shopName: string;
    requestorAnnotation: string | null;
  }>;
}

const api = attachGlobalAuthInterceptor(axios.create({ withCredentials: true }));

export const getHome = async (_params: Record<string, never> = {}): Promise<ApiDataResponse<HomeData> | ApiErrorResponse> => {
  try {
    const response = await api.get<HomeData>("/api/home");
    return {
      data: response.data,
      response: { ...response, headers: {
        get: (key: string) => response.headers[key.toLowerCase()] ?? null,
        has: (key: string) => key.toLowerCase() in response.headers,
      } },
    } as unknown as ApiDataResponse<HomeData>;
  } catch (error: any) {
    return { error: {
      status: error.response?.status || 0,
      message: apiErrorMessage(error.response?.data, "Unable to load your home page. Please try again."),
    }, response: error.response } as ApiErrorResponse;
  }
};
