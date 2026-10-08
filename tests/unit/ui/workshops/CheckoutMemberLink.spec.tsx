import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const mockDialog = jest.fn();
jest.mock("ui/workshops/CheckoutMemberDialog", () => ({ __esModule: true, default: (props: any) => {
  mockDialog(props);
  return <div role="dialog">Dialog for {props.tool.name}</div>;
} }));
const nothing = { __esModule: true, default: () => null };
jest.mock("ui/workshops/RequestCheckoutModal", () => nothing);
jest.mock("ui/workshops/AddToolModal", () => nothing);
jest.mock("ui/workshops/ShopOutageAction", () => nothing);
jest.mock("ui/fixTickets/ToolOutageAction", () => nothing);
jest.mock("ui/toolCheckouts/ToolGroupList", () => nothing);
jest.mock("ui/toolCheckouts/ToolEditorModal", () => nothing);
jest.mock("ui/toolCheckouts/ShopLocationMap", () => nothing);
jest.mock("ui/common/PublicCatalogQrCodeModal", () => nothing);
jest.mock("ui/common/ToolAvailability", () => nothing);
jest.mock("ui/toolCheckouts/ShopManager", () => ({ AddShopModal: () => null, EditShopModal: () => null }));
jest.mock("app/permissions", () => ({ useCapabilities: () => ({}) }));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => ({ currentUser: { id: "me" } }) }));
jest.mock("api/workshops", () => ({ listWorkshops: jest.fn() }));
jest.mock("api/volunteer", () => ({ claimVolunteerTask: jest.fn() }));

import CheckoutMemberLinkPage from "ui/workshops/CheckoutMemberLinkPage";
import { WorkshopTools } from "ui/workshops/WorkshopsPage";

const Where: React.FC = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;

const render = async (element: React.ReactElement) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, unmount: () => { act(() => root.unmount()); host.remove(); } };
};

describe("the public tool page's sign-in link for approvers", () => {
  it("sends the signed-in visitor to that tool in Workshops with the checkout option", async () => {
    sessionStorage.setItem("checkout-return-to", "/tools/abc/check-out-member");
    const { host, unmount } = await render(
      <MemoryRouter initialEntries={["/tools/0123456789abcdef01234567/check-out-member"]}>
        <Routes>
          <Route path="/tools/:id/check-out-member" element={<CheckoutMemberLinkPage />} />
          <Route path="/workshops" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    try {
      expect(host.querySelector('[data-testid="where"]')!.textContent)
        .toBe("/workshops?tool=0123456789abcdef01234567&checkout=member");
      expect(sessionStorage.getItem("checkout-return-to")).toBeNull();
    } finally { unmount(); }
  });
});

describe("opening Check Out Member from the link", () => {
  const workshop = (canCheckoutMember: boolean): any => ({
    id: "shop", name: "Woodworking", isShopManager: false, canAddTool: false,
    tools: [{ id: "t1", name: "Laguna Bandsaw", disabled: false, prerequisiteNames: [], canCheckoutMember }],
  });
  const tools = (canCheckoutMember: boolean, extra: Record<string, any> = {}) => (
    <MemoryRouter>
      <WorkshopTools workshop={workshop(canCheckoutMember)} managedShops={[]} managedTools={[]} catalogsReady
        onRefresh={jest.fn()} selectedToolId="t1" {...extra} />
    </MemoryRouter>
  );

  beforeEach(() => {
    mockDialog.mockClear();
    // jsdom has no scrollIntoView; the page scrolls the scanned tool into view.
    Element.prototype.scrollIntoView = jest.fn();
  });

  it("opens the dialog once for an approver and then marks the link handled", async () => {
    const handled = jest.fn();
    const { host, unmount } = await render(tools(true, { autoCheckoutMember: true, onAutoCheckoutHandled: handled }));
    try {
      expect(host.ownerDocument.body.textContent).toContain("Dialog for Laguna Bandsaw");
      expect(handled).toHaveBeenCalledTimes(1);
    } finally { unmount(); }
  });

  it("only shows the tool for someone who cannot check members out", async () => {
    const handled = jest.fn();
    const { host, unmount } = await render(tools(false, { autoCheckoutMember: true, onAutoCheckoutHandled: handled }));
    try {
      expect(mockDialog).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Laguna Bandsaw");
      expect(host.textContent).not.toContain("Check Out Member");
      expect(handled).toHaveBeenCalledTimes(1);
    } finally { unmount(); }
  });

  it("does not open the dialog when the link was not used", async () => {
    const { host, unmount } = await render(tools(true));
    try {
      expect(mockDialog).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Check Out Member");
    } finally { unmount(); }
  });
});
