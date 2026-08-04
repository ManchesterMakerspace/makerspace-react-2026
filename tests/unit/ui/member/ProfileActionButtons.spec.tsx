import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

let mockCurrentUser = { id: "member-1" };
let mockCanManageCheckouts = false;

jest.mock("ui/reducer/hooks", () => ({
  useAuthState: () => ({ currentUser: mockCurrentUser })
}));
jest.mock("app/permissions", () => ({
  useCapabilities: () => ({ canManageCheckouts: mockCanManageCheckouts })
}));
jest.mock("ui/member/utils", () => ({ memberIsResourceManager: () => false }));
jest.mock("ui/toolCheckouts/CheckoutRoster", () => () => <div>Checkout roster</div>);
jest.mock("api/reservations", () => ({
  listReservations: jest.fn().mockResolvedValue({ data: [] }),
  listManagedReservations: jest.fn().mockResolvedValue({ data: [] })
}));

import MemberCheckoutsTab from "ui/toolCheckouts/MemberCheckoutsTab";
import MemberReservationsTab from "ui/reservations/MemberReservationsTab";

const member = {
  id: "member-1",
  firstname: "Test",
  lastname: "Member"
} as any;

describe("member profile action buttons", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    mockCurrentUser = { id: "member-1" };
    mockCanManageCheckouts = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderTabs = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <MemberCheckoutsTab member={member} />
          <MemberReservationsTab member={member} />
        </MemoryRouter>
      );
      await Promise.resolve();
    });
  };

  it("links members from their own profile to request a checkout and make a reservation", async () => {
    mockCanManageCheckouts = true;
    await renderTabs();

    const links = Array.from(container.querySelectorAll("a"));
    const checkoutLink = links.find(link => link.textContent?.includes("Request Checkout"));
    const reservationLink = links.find(link => link.textContent?.includes("New Reservation"));
    expect(checkoutLink?.getAttribute("href")).toBe("/tool-checkouts?mode=self-service");
    expect(reservationLink?.getAttribute("href")).toBe("/reservations");
  });

  it("does not show self-service actions when another member's profile is viewed", async () => {
    mockCurrentUser = { id: "different-member" };

    await renderTabs();

    expect(container.textContent).not.toContain("Request Checkout");
    expect(container.textContent).not.toContain("New Reservation");
  });
});
