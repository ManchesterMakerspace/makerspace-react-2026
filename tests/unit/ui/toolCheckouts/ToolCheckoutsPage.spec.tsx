import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

jest.mock("ui/reducer/hooks", () => ({
  useAuthState: () => ({ currentUser: { id: "admin-1", resourceManagerShopIds: [] } })
}));
jest.mock("ui/member/utils", () => ({ memberIsResourceManager: () => false }));
jest.mock("app/permissions", () => ({
  useCapabilities: () => ({
    canManageCheckouts: true,
    canManageCheckoutApprovers: true
  })
}));
jest.mock("ui/toolCheckouts/ToolCheckoutRequestsManager", () => ({ canManage }: { canManage: boolean }) => (
  <div>{canManage ? "Managed requests" : "Self-service requests"}</div>
));
jest.mock("ui/toolCheckouts/CheckoutRoster", () => () => <div>Management roster</div>);
jest.mock("ui/toolCheckouts/ShopManager", () => () => <div>Shop manager</div>);
jest.mock("ui/toolCheckouts/ToolManager", () => () => <div>Tool manager</div>);
jest.mock("ui/toolCheckouts/CheckoutApproversManager", () => () => <div>Approvers manager</div>);

import ToolCheckoutsPage from "ui/toolCheckouts/ToolCheckoutsPage";

describe("ToolCheckoutsPage routing modes", () => {
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

  const renderPage = async (path: string) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <ToolCheckoutsPage />
        </MemoryRouter>
      );
    });
  };

  it("opens the member request workflow for privileged users in self-service mode", async () => {
    await renderPage("/tool-checkouts?mode=self-service");

    expect(container.textContent).toContain("Self-service requests");
    expect(container.textContent).not.toContain("Management roster");
  });

  it("keeps the management roster as the normal privileged default", async () => {
    await renderPage("/tool-checkouts");

    expect(container.textContent).toContain("Management roster");
    expect(container.textContent).not.toContain("Self-service requests");
  });
});
