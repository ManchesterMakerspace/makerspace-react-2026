import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import MemberDeleteToggle from "ui/member/MemberDeleteToggle";

const member: any = { id: "m1", firstname: "Pat", lastname: "Dupe" };

describe("MemberDeleteToggle", () => {
  let host: HTMLDivElement;
  let root: Root;
  let fetchMock: jest.Mock;
  const onUpdated = jest.fn();

  const reply = (status: number, body: any) => ({ ok: status < 400, status, json: async () => body });
  const render = async (props: any = {}) => {
    await act(async () => root.render(<MemberDeleteToggle member={{ ...member, ...props }} onUpdated={onUpdated} />));
  };
  const click = async (selector: string) => {
    await act(async () => (document.querySelector(selector) as HTMLElement).click());
  };

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock;
    window.confirm = jest.fn(() => true);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("deletes straight away when nothing needs removing by hand", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await render();

    await click("#member-detail-delete-toggle");

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/members/m1/soft_delete", expect.objectContaining({ method: "POST" }));
    expect(onUpdated).toHaveBeenCalled();
    expect(document.getElementById("manual-removal-problems")).toBeNull();
  });

  it("shows what failed, keeps Delete disabled until the admin ticks the box, then confirms", async () => {
    fetchMock.mockResolvedValueOnce(reply(422, {
      message: "Pat Dupe was not removed from everything automatically", manual_removal_required: true,
      problems: ["Slack: not_allowed_token_type", "Google Drive (Resources folder): quota"],
    }));
    await render();

    await click("#member-detail-delete-toggle");

    expect(onUpdated).not.toHaveBeenCalled();
    expect(document.getElementById("manual-removal-problems")!.textContent).toContain("Slack: not_allowed_token_type");
    expect(document.getElementById("manual-removal-problems")!.textContent).toContain("Google Drive (Resources folder): quota");
    expect((document.getElementById("manual-removal-delete") as HTMLButtonElement).disabled).toBe(true);

    await click("#manual-removal-confirmed");
    expect((document.getElementById("manual-removal-delete") as HTMLButtonElement).disabled).toBe(false);

    fetchMock.mockResolvedValueOnce(reply(200, {}));
    await click("#manual-removal-delete");

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/members/m1/soft_delete?manual_removal_confirmed=true", expect.objectContaining({ method: "POST" }));
    expect(onUpdated).toHaveBeenCalled();
    // MUI keeps the dialog in the page while it fades out, but the problem list is emptied
    expect(document.getElementById("manual-removal-problems")?.textContent || "").toBe("");
  });

  it("closing the dialog leaves the account alone", async () => {
    fetchMock.mockResolvedValueOnce(reply(422, { message: "x", manual_removal_required: true, problems: ["Slack: failed"] }));
    await render();
    await click("#member-detail-delete-toggle");

    await click("#manual-removal-cancel");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("shows other refusals, such as an open invoice, as a message instead of the dialog", async () => {
    fetchMock.mockResolvedValue(reply(422, { message: "Pat Dupe has 1 open invoice and cannot be deleted.", open_invoices: 1 }));
    await render();

    await click("#member-detail-delete-toggle");

    expect(document.body.textContent).toContain("Pat Dupe has 1 open invoice and cannot be deleted.");
    expect(document.getElementById("manual-removal-problems")).toBeNull();
  });

  it("restores a deleted account without any manual-removal step", async () => {
    fetchMock.mockResolvedValue(reply(200, {}));
    await render({ mergedAt: "2026-10-01T00:00:00Z" });

    await click("#member-detail-delete-toggle");

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/members/m1/restore", expect.objectContaining({ method: "POST" }));
    expect(onUpdated).toHaveBeenCalled();
  });
});
