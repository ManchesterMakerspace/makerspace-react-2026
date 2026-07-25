import { computeCapabilities } from "app/permissions";

describe("resource-scoped checkout capabilities", () => {
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
