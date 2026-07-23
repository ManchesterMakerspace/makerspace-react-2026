import { Shop, Tool } from "./toolCheckout";

export type ReservationStatus = "pending" | "approved" | "denied" | "cancelled";
export type ReservationScope = "shop" | "tools";

export interface Reservation {
  id: string;
  title: string;
  memberId: string;
  memberName: string;
  shopId: string;
  shopName: string;
  reservationScope: ReservationScope;
  toolIds: string[];
  toolNames: string[];
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  approvalReasons: string[];
  decisionNote?: string;
  decidedById?: string;
  decidedByName?: string;
  decidedAt?: string;
  source: "portal" | "slack";
  calendarEventId?: string;
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
  startAt: string;
  endAt: string;
}

export interface ReservationPreview {
  eligible: boolean;
  errors: string[];
  conflicts: string[];
  missingPrerequisites: Array<{ id: string; name: string }>;
  requiresApproval: boolean;
  approvalReasons: string[];
  maximumDurationHours: number;
}

export interface SubscriptionCancellationImpact {
  reservationCount: number;
  membershipExpiresAt?: string;
  reservations: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
  }>;
}
