import { computeCapabilities } from "app/permissions";

describe("resource-scoped checkout capabilities", () => {
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
