export interface ReservationEligibleMember {
  isBoardMember?: boolean;
  status?: string;
  expirationTime?: number;
}

export const isReservationCreationEligible = (
  member: ReservationEligibleMember,
  now: number = Date.now()
): boolean =>
  !!member.isBoardMember ||
  (member.status === "activeMember" &&
    !!member.expirationTime && member.expirationTime > now);
