import { useMemo } from 'react';
import { useAuthState } from 'ui/reducer/hooks';
import { AuthMember } from 'ui/auth/interfaces';

/**
 * UserCapabilities — what a user can DO, not what role they have.
 *
 * Components ONLY check capabilities, never roles directly.
 * Roles (isAdmin, isBoardMember, isResourceManager) are used only in
 * Header.tsx for badge display.
 *
 * To change who has access to a feature, edit computeCapabilities only.
 * Zero component changes needed.
 */
export interface UserCapabilities {
  // Member management
  canViewAllMembers:           boolean; // admin, board, rm
  canEditMembers:              boolean; // admin, board
  canCreateMembers:            boolean; // admin, board
  canChangeOtherPasswords:     boolean; // admin, board
  canViewEmailStatus:          boolean; // admin, board, rm

  // Billing & invoices
  canManageInvoices:           boolean; // admin, board
  canSettleInvoices:           boolean; // admin, board
  canManageBilling:            boolean; // admin, board
  canRefundTransactions:       boolean; // admin, board
  canCancelOtherSubscriptions: boolean; // admin, board
  canManageEarnedMemberships:  boolean; // admin, board

  // Rentals
  canManageRentals:            boolean; // admin, board, rm
  canDeleteRentals:            boolean; // admin, board

  // Shop operations
  canManageShopFees:           boolean; // admin, board, rm
  canManageCheckouts:          boolean; // admin, board, rm, checkoutApprover
  canManageCheckoutApprovers:  boolean; // admin, board
  canManageVolunteer:          boolean; // admin, board, rm
  canDeleteVolunteerRecords:   boolean; // admin, board

  // System — Portal Settings is admin ONLY
  canViewPortalSettings:       boolean; // admin ONLY

  // Audit log — privileged (admin + board)
  canViewAuditLog:             boolean; // admin, board

  // Analytics dashboard
  canViewAnalytics:            boolean; // admin, board
}

export const computeCapabilities = (user: AuthMember): UserCapabilities => {
  const admin    = !!user?.isAdmin;
  const board    = !!user?.isBoardMember;
  const rm       = !!user?.isResourceManager;
  const approver = !!(user as any)?.isCheckoutApprover;
  const managesShops = rm && ((user as any)?.resourceManagerShopIds || []).length > 0;

  const privileged = admin || board;

  return {
    canViewAllMembers:           privileged || rm,
    canEditMembers:              privileged,
    canCreateMembers:            privileged,
    canChangeOtherPasswords:     privileged,
    canViewEmailStatus:          privileged || rm,

    canManageInvoices:           privileged,
    canSettleInvoices:           privileged,
    canManageBilling:            privileged,
    canRefundTransactions:       privileged,
    canCancelOtherSubscriptions: privileged,
    canManageEarnedMemberships:  privileged,

    canManageRentals:            privileged || rm,
    canDeleteRentals:            privileged,

    canManageShopFees:           privileged || rm,
    canManageCheckouts:          privileged || managesShops || approver,
    canManageCheckoutApprovers:  privileged,
    canManageVolunteer:          privileged || rm,
    canDeleteVolunteerRecords:   privileged,

    canViewPortalSettings:       admin, // admin ONLY
    canViewAuditLog:             privileged,
    canViewAnalytics:            privileged,
  };
};

export const useCapabilities = (): UserCapabilities => {
  const { currentUser } = useAuthState();
  return useMemo(() => computeCapabilities(currentUser), [currentUser]);
};
