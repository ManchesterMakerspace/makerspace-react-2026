import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import MemberStatusLabel from "ui/member/MemberStatusLabel";

describe("MemberStatusLabel", () => {
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

  const renderLabel = async (member: any) => {
    await act(async () => {
      root.render(<MemberStatusLabel member={member} id="label" />);
    });
    return container.textContent;
  };

  it("names a non-member with no term instead of showing N/A", async () => {
    expect(await renderLabel({ status: "nonMember", expirationTime: undefined })).toContain("Non-Member");
  });

  it("still shows N/A for an active member with no term and no subscription", async () => {
    expect(await renderLabel({ status: "activeMember", expirationTime: undefined })).toContain("N/A");
  });

  it("shows Not started for a non-member who has a subscription but no term", async () => {
    expect(await renderLabel({ status: "nonMember", expirationTime: undefined, subscriptionId: "sub_1" })).toContain("Not started");
  });

  it("shows Inactive for an inactive member", async () => {
    expect(await renderLabel({ status: "inactive", expirationTime: undefined })).toContain("Inactive");
  });
});
