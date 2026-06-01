export interface VolunteerCredit {
  id: string;
  memberId: string;
  memberName: string;
  issuedById: string;
  issuedByName: string;
  taskId: string | null;
  taskTitle: string | null;
  description: string;
  creditValue: number;
  status: 'pending' | 'approved' | 'rejected' | 'reversal';
  discountApplied: boolean;
  discountAppliedAt: string | null;
  // Reversal fields on the original credit
  reversed: boolean;
  reversedById: string | null;
  reversedByName: string | null;
  reversedAt: string | null;
  // Fields on the negative offsetting (reversal) record
  reversalOfId: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendeeRemoval {
  memberId: string;
  removedById: string;
  removedAt: string;
}

export interface VolunteerTask {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  creditValue: number;
  shopId: string | null;
  shopName: string | null;
  status: 'available' | 'claimed' | 'pending' | 'completed' | 'cancelled';
  createdById: string;
  createdByName: string;
  claimedById: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  verifiedById: string | null;
  verifiedByName: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerEvent {
  id: string;
  eventNumber: number;
  title: string;
  description: string;
  creditValue: number;
  eventDate: string | null;
  status: 'open' | 'closed';
  createdById: string;
  createdByName: string;
  closedById: string | null;
  closedByName: string | null;
  closedAt: string | null;
  attendeeIds: string[];
  attendeeNames: string[];
  attendeeRemovals: AttendeeRemoval[];
  attendeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerSummary {
  year_count: number;
  lifetime_count: number;
  rolling_count: number;
  rolling_days: number;
  discounts_used: number | null;
  max_discounts: number | null;
  credits_per_discount: number | null;
  pending_count: number;
  is_earned_member: boolean;
  discount_active: boolean;
  message: string | null;
}
