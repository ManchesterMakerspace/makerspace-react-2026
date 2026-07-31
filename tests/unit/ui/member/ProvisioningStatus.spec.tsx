import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  MemberProvisioning,
  ProvisioningStatusChip,
} from "ui/member/ProvisioningStatus";

describe("ProvisioningStatusChip", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows actionable Slack and Drive state labels", async () => {
    const provisioning: MemberProvisioning = {
      activationEligible: true,
      email: "member@example.com",
      slack: { status: "manual_promotion_required" },
      googleDrive: { status: "partial" },
    };

    await act(async () => {
      root.render(
        <>
          <ProvisioningStatusChip kind="slack" provisioning={provisioning} />
          <ProvisioningStatusChip kind="drive" provisioning={provisioning} />
        </>
      );
    });

    expect(container.textContent).toContain("Manual Slack promotion");
    expect(container.textContent).toContain("Only one of the two Google Drive permissions");
  });
});
