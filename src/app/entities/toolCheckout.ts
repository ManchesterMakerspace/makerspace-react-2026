export interface Shop {
  id: string;
  name: string;
  slackChannel: string;
  disabled: boolean;
  toolCount: number;
  reservable: boolean;
  maxConcurrentReservations: number;
  reservationHorizonDays: number;
  maxReservationDurationHours: number;
  reservationRequiresApproval: boolean;
  reservationPrerequisiteToolIds: string[];
  reservationPrerequisiteNames?: string[];
  colorId?: string;
  googleResourceId?: string;
  resourceEmail?: string;
}

export interface GoogleCalendarColor {
  id: string;
  backgroundColor: string;
  foregroundColor: string;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  disabled?: boolean;
  announce?: boolean;
  announceChannel?: string;
  usersChannel?: string;
  shopId: string;
  shopName: string;
  prerequisiteIds: string[];
  prerequisiteNames: string[];
  unmetPrerequisiteIds?: string[];
  unmetPrerequisiteNames?: string[];
  requestable?: boolean;
  reservable?: boolean;
  maxConcurrentReservations?: number;
  reservationHorizonDays?: number;
  maxReservationDurationHours?: number;
  reservationRequiresApproval?: boolean;
  reservationPrerequisiteToolIds?: string[];
  effectiveReservationPrerequisiteIds?: string[];
  reservationPrerequisiteNames?: string[];
  googleResourceId?: string;
  resourceEmail?: string;
}

export interface ToolCheckout {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  toolId: string;
  toolName: string;
  shopName: string;
  shopId: string;
  checkedOutAt: string;
  revokedAt?: string;
  revocationReason?: string;
  signedOffVia: "portal" | "slack";
  approvedById?: string;
  approvedByName?: string;
  active: boolean;
}

export interface CheckoutApprover {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  shopIds: string[];
  shopNames: string[];
  toolIds: string[];
  toolNames: string[];
}

export interface ToolCheckoutRequest {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberSlackUrl?: string;
  toolId: string;
  toolName: string;
  shopId: string;
  shopName: string;
  note?: string;
  requestDate: string;
  status: "open" | "closed" | "deleted";
  messageId?: string;
  checkedOutId?: string;
}
