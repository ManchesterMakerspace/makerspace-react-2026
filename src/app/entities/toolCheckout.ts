export interface DurationFee {
  invoiceOptionId: string;
  minimumHours: number;
  maximumHours: number;
  fullDay: boolean;
}

export interface Shop {
  requestorAnnotation?: string | null;
  id: string;
  floorName?: string;
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
  resourceManagers?: ShopResourceManager[];
  resourceManagerIds?: string[];
}

export interface ShopResourceManager {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  name: string;
  kind?: string;
  parentId?: string;
  shopId: string;
  svgElementId?: string;
  xPct?: number;
  yPct?: number;
  shapePoints?: { x: number; y: number }[];
  // Floor plan this location is drawn on (B, 1 or 2); the server fills in
  // the shop's own floor when none was set.
  floorName?: string;
  // Marker glyph key (see markerIcons.tsx); blank draws the default pin.
  icon?: string;
  toolNames?: string[];
  // Index-aligned with toolNames (both derive from the same server-side
  // fetch, not two separate queries, so a given index always names/ids the
  // same tool).
  toolIds?: string[];
}

export interface GoogleCalendarColor {
  id: string;
  name: string;
  backgroundColor: string;
  foregroundColor: string;
}

export interface Tool {
  allowPending?: boolean;
  outOfService?: boolean;
  requestorAnnotation?: string | null;
  open?: boolean;
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
  locationId?: string;
  locationName?: string;
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
  outOfService?: boolean;
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
  toolGroups?: { id: string; name: string; shopId: string }[];
  toolGroupIds?: string[];
  tools?: { id: string; name: string; shopId: string; outOfService: boolean }[];
  outOfServiceToolNames?: string[];
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
  toolGroupId?: string;
  targetType?: 'tool' | 'group';
  targetName?: string;
  groupRevision?: number;
  includedToolIds?: string[];
  outOfService?: boolean;
  requestorAnnotation?: string | null;
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberSlackUrl?: string;
  toolId?: string;
  toolName?: string;
  shopId: string;
  shopName: string;
  note?: string;
  requestDate: string;
  status: "open" | "closed" | "deleted";
  messageId?: string;
  checkedOutId?: string;
}

export interface ToolGroup {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  prerequisiteIds: string[];
  includedToolIds: string[];
  includedTools: Tool[];
  reservable: boolean;
  requestable: boolean;
  announce: boolean;
  announceChannel?: string;
  archived: boolean;
  revision: number;
  targetType: 'group';
  canManage: boolean;
  canApprove: boolean;
  canRequest: boolean;
}

export interface GroupCheckoutReview {
  group: ToolGroup;
  prerequisiteNames: string[];
  revision: number;
  includedToolIds: string[];
  heldToolIds: string[];
  createToolIds: string[];
  prerequisiteIds: string[];
  missingPrerequisiteIds: string[];
}
