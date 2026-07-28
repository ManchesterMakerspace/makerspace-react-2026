import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import ApprovalDetails from "ui/reservations/ApprovalDetails";

describe("ApprovalDetails", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders blackout titles through their member-facing message", () => {
    act(() => root.render(
      <ApprovalDetails details={[{
        code: "blackout",
        message: "This reservation overlaps the shop blackout “Open House”.",
        blackoutTitle: "Open House",
      }]} />
    ));

    expect(container.textContent).toContain("Approval required because:");
    expect(container.textContent).toContain("Open House");
  });
});
