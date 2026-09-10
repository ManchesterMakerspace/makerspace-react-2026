export interface DurationFee {
  invoiceOptionId: string;
  minimumHours: number;
  maximumHours: number;
  fullDay: boolean;
}

export interface Shop {
  id: string;
  name: string;
  wikiUrl: string;
  wikiUrlOverride?: string;
  gdriveId?: string;
  slackChannel: string;
  disabled: boolean;
  toolCount: number;
  reservable: boolean;
  maxConcurrentReservations: number;
  reservationHorizonDays: number;
  minimumAdvanceNoticeHours?: number;
  prohibitSameDayReservations?: boolean;
  reservationFullDay?: boolean;
  durationFees?: DurationFee[];
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
  name: string;
  backgroundColor: string;
  foregroundColor: string;
}

export interface Tool {
  id: string;
  name: string;
  wikiUrl: string;
  wikiUrlOverride?: string;
  gdriveId?: string;
  description?: string;
  // Sensitive (e.g. lock combo) -- only present when the API includes it for
  // this viewer (privileged, a checkout approver for the tool, or a member
  // with an active checkout on it).
  notes?: string;
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
  requestPending?: boolean;
  reservable?: boolean;
  maxConcurrentReservations?: number;
  reservationHorizonDays?: number;
  minimumAdvanceNoticeHours?: number;
  prohibitSameDayReservations?: boolean;
  reservationFullDay?: boolean;
  durationFees?: DurationFee[];
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
  shopWikiUrl?: string;
  checkedOutAt: string;
  revokedAt?: string;
  revocationReason?: string;
  signedOffVia: "portal" | "slack";
  approvedById?: string;
  approvedByName?: string;
  active: boolean;
  // Only present while the checkout is active and approved -- see Tool.notes.
  toolNotes?: string;
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
