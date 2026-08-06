import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import GoogleDriveInviteButton from "ui/member/GoogleDriveInviteButton";

describe("GoogleDriveInviteButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    originalFetch = (globalThis as any).fetch;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalFetch) {
      (globalThis as any).fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
    jest.restoreAllMocks();
  });

  it("disables manual provisioning until activation eligibility is satisfied", async () => {
    const fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock;

    await act(async () => {
      root.render(
        <GoogleDriveInviteButton
          member={{
            id: "member-id",
            email: "member@example.com",
            provisioning: {
              activationEligible: false,
              slack: { status: "not_invited" },
              googleDrive: { status: "pending_activation" },
            },
          } as any}
        />
      );
    });

    expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits and refreshes eligible provisioning", async () => {
    const onProvisioned = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    (globalThis as any).fetch = fetchMock;

    await act(async () => {
      root.render(
        <GoogleDriveInviteButton
          member={{
            id: "member-id",
            email: "member@example.com",
            provisioning: {
              activationEligible: true,
              slack: { status: "guest" },
              googleDrive: { status: "not_provisioned" },
            },
          } as any}
          onProvisioned={onProvisioned}
        />
      );
    });
    await act(async () => {
      container.querySelector("button")!.click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/members/member-id/invite_google_drive",
      expect.objectContaining({ method: "POST" })
    );
    expect(onProvisioned).toHaveBeenCalledTimes(1);
  });
});
