import { Shop, Tool } from "./toolCheckout";

export type ReservationStatus = "pending" | "unpaid" | "approved" | "denied" | "cancelled";
export type ReservationScope = "shop" | "tools";

export interface ReservationApprovalDetail {
  code: string;
  message: string;
  blackoutId?: string;
  blackoutTitle?: string;
}

export interface Reservation {
  outOfServiceToolNames?: string[];
  id: string;
  title: string;
  memberId: string;
  memberName: string;
  shopId: string;
  shopName: string;
  reservationScope: ReservationScope;
  toolIds: string[];
  toolNames: string[];
  fullDay?: boolean;
  invoice?: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  approvalReasons: string[];
  approvalDetails: ReservationApprovalDetail[];
  decisionNote?: string;
  decidedById?: string;
  decidedByName?: string;
  decidedAt?: string;
  source: "portal" | "slack";
  calendarEventId?: string;
  calendarHtmlLink?: string;
  calendarSyncStatus?: "pending" | "synced" | "failed" | "deleted";
  calendarSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationCatalog {
  shops: Shop[];
  tools: Tool[];
}

export interface ReservationInput {
  title: string;
  shopId: string;
  reservationScope: ReservationScope;
  toolIds: string[];
  fullDay?: boolean;
  feeConfirmation?: string;
  startAt: string;
  endAt: string;
}

export interface ReservationPreview {
  feeLines?: Array<{ resourceName: string; name: string; units: number; unitAmount: number; amount: number }>;
  feeWarning?: string;
  feeTotal?: number;
  feeConfirmation?: string;
  eligible: boolean;
  errors: string[];
  conflicts: string[];
  missingPrerequisites: Array<{ id: string; name: string }>;
  requiresApproval: boolean;
  approvalReasons: string[];
  approvalDetails: ReservationApprovalDetail[];
  maximumDurationHours: number;
}

export interface ReservationBlackout {
  id: string;
  title: string;
  shopId: string;
  shopName: string;
  recurrence: "daily" | "weekly";
  weekday?: number;
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationBlackoutInput {
  title: string;
  shopId: string;
  recurrence: "daily" | "weekly";
  weekday?: number;
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
}

export interface ReservationBlackoutOccurrence {
  blackoutId: string;
  title: string;
  fullDay?: boolean;
  feeConfirmation?: string;
  invoice?: string;
  startAt: string;
  endAt: string;
}

export interface SubscriptionCancellationImpact {
  reservationCount: number;
  membershipExpiresAt?: string;
  reservations: Array<{
    id: string;
    title: string;
    calendarHtmlLink?: string;
    startAt: string;
    endAt: string;
  }>;
}
