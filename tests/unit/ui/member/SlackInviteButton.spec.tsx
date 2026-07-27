import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import SlackInviteButton from "ui/member/SlackInviteButton";

describe("SlackInviteButton", () => {
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

  it("surfaces the API failure message to the admin or board member", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "not_authed" } }),
    } as Response);
    (globalThis as any).fetch = fetchMock;

    await act(async () => {
      root.render(
        <SlackInviteButton
          member={{
            id: "member-id",
            email: "member@example.com",
          } as any}
        />
      );
    });

    await act(async () => {
      container.querySelector("button")!.click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/members/member-id/invite_slack",
      expect.objectContaining({ method: "POST" })
    );
    expect(document.body.querySelector("[role='alert']")?.textContent)
      .toContain("not_authed");
  });
});
