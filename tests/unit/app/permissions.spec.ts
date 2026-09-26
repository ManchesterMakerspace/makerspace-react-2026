import { computeCapabilities } from "app/permissions";

describe("resource-scoped checkout capabilities", () => {
  it('limits NFC inspection to active unexpired admins and board members', () => {
    const user = { id: 'member', status: 'activeMember', expirationTime: Date.now() + 60000 } as any;
    expect(computeCapabilities(user).canScanNfc).toBe(true);
    expect(computeCapabilities(user).canManageNfcCards).toBe(false);
    expect(computeCapabilities({ ...user, isResourceManager: true }).canManageNfcCards).toBe(false);
    expect(computeCapabilities({ ...user, isBoardMember: true }).canManageNfcCards).toBe(true);
    expect(computeCapabilities({ ...user, isAdmin: true, expirationTime: 1 }).canManageNfcCards).toBe(false);
    expect(computeCapabilities({ ...user, status: 'revoked' }).canScanNfc).toBe(false);
  });
  it.each(["isAdmin", "isBoardMember", "isResourceManager"])("allows shop QR codes for %s", role => {
    expect(computeCapabilities({ [role]: true } as any).canViewShopQrCodes).toBe(true);
  });
  it("does not grant shop QR actions to ordinary members or tool-only approvers", () => {
    expect(computeCapabilities({} as any).canViewShopQrCodes).toBe(false);
    expect(computeCapabilities({ isCheckoutApprover: true } as any).canViewShopQrCodes).toBe(false);
  });
  it("does not treat an unassigned Resource Manager as globally checkout-privileged", () => {
    const capabilities = computeCapabilities({
      isResourceManager: true,
      resourceManagerShopIds: [],
      isCheckoutApprover: false,
    } as any);

    expect(capabilities.canManageCheckouts).toBe(false);
  });

  it("allows checkout UI for assigned RMs and ordinary checkout approvers", () => {
    expect(computeCapabilities({
      isResourceManager: true,
      resourceManagerShopIds: ["shop-id"],
    } as any).canManageCheckouts).toBe(true);

    expect(computeCapabilities({
      isCheckoutApprover: true,
      checkoutApproverToolIds: ["tool-id"],
    } as any).canManageCheckouts).toBe(true);
  });
});
