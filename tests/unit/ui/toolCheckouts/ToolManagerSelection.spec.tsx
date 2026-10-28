import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockRefresh = jest.fn();
let mockTools: any[] = [];
jest.mock("ui/toolCheckouts/CheckoutCatalog", () => ({
  useCheckoutCatalog: (resource: string) => ({
    data: resource === "tools" ? mockTools : [{ id: "shop-1", name: "Laser" }],
    response: { response: { headers: { get: () => "150" } } },
    error: "",
    isRequesting: false,
    refresh: mockRefresh
  })
}));
jest.mock("app/permissions", () => ({ useCapabilities: () => ({ canManageCheckoutApprovers: true }) }));
jest.mock("ui/common/Filters/QueryContext", () => ({
  withQueryContext: (component: any) => component,
  useQueryContext: () => ({ params: { pageNum: 0, orderBy: "", order: "asc" }, sort: jest.fn(), changePage: jest.fn(), setParam: jest.fn() })
}));
jest.mock("ui/common/FormModal", () => () => null);
jest.mock("ui/common/PublicCatalogQrCodeModal", () => () => null);
jest.mock("ui/toolCheckouts/ToolQrCodeModal", () => () => null);
jest.mock("ui/toolCheckouts/ReservationSettingsFields", () => () => null);
jest.mock("ui/toolCheckouts/ShopColorField", () => () => null);
jest.mock("ui/hooks/useReadTransaction", () => ({ __esModule: true, default: () => ({ data: [], refresh: jest.fn() }) }));
jest.mock("api/toolCheckouts", () => ({
  listToolGroups: jest.fn().mockResolvedValue({ data: [] }),
  adminCreateShop: jest.fn(), adminUpdateShop: jest.fn(), adminDeleteShop: jest.fn(),
  adminCreateTool: jest.fn(), adminUpdateTool: jest.fn(), adminDeleteTool: jest.fn(),
  adminUpdateToolNotes: jest.fn()
}));

import ToolManager from "ui/toolCheckouts/ToolManager";

const buttonsLabelled = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).filter(b => b.textContent === label);
const checkboxes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'));

describe("tool selection toolbar", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleError: jest.SpyInstance;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    mockTools = [
      { id: "tool-1", name: "Laser", shopId: "shop-1", canGenerateCheckoutRequiredSheet: true, canManageCheckoutExpiration: true },
      { id: "tool-2", name: "Rotary", shopId: "shop-1", canGenerateCheckoutRequiredSheet: true, canManageCheckoutExpiration: true }
    ];
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); consoleError.mockRestore(); });

  const expectToolbar = (count: number) => {
    expect(buttonsLabelled(container, "Checkout Required Sheet")).toHaveLength(count);
    expect(buttonsLabelled(container, "Set checkout expirations")).toHaveLength(count);
    expect(buttonsLabelled(container, "QR Code")).toHaveLength(count);
  };

  it("shows one toolbar for the selected tool and removes it when the selection changes", async () => {
    await act(async () => root.render(<ToolManager />));
    expect(checkboxes(container)).toHaveLength(2);
    expectToolbar(0);

    await act(async () => checkboxes(container)[0].click());
    expectToolbar(1);

    await act(async () => checkboxes(container)[0].click());
    expectToolbar(0);

    await act(async () => checkboxes(container)[1].click());
    expectToolbar(1);

    await act(async () => checkboxes(container)[0].click());
    expectToolbar(1);

    await act(async () => checkboxes(container)[1].click());
    expectToolbar(1);

    await act(async () => checkboxes(container)[1].click());
    expectToolbar(0);
  });

  it("does not give sibling toolbar buttons the same React key", async () => {
    await act(async () => root.render(<ToolManager />));
    await act(async () => checkboxes(container)[0].click());
    await act(async () => checkboxes(container)[1].click());
    const keyWarnings = consoleError.mock.calls.filter(args => String(args[0]).includes("same key"));
    expect(keyWarnings).toHaveLength(0);
  });
});
