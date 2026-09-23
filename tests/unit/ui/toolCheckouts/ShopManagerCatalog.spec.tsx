import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Provider } from "react-redux";
import { createStore } from "redux";

let mockStore: any;
const mockSuccessCallbacks = new Map<Function, () => void>();
jest.mock("app/main", () => ({ getStore: () => mockStore }));
jest.mock("ui/auth/actions", () => ({ authReducer: (state = {}) => state }));
jest.mock("ui/billing/actions", () => ({ billingReducer: (state = {}) => state }));
jest.mock("ui/earnedMemberships/actions", () => ({ earnedMembershipsReducer: (state = {}) => state }));
jest.mock("ui/checkout/cart", () => ({ cartReducer: (state = {}) => state }));
jest.mock("app/permissions", () => ({ useCapabilities: () => ({ canManageCheckoutApprovers: true }) }));
jest.mock("ui/hooks/useWriteTransaction", () => (transaction: Function, onSuccess: () => void) => {
  mockSuccessCallbacks.set(transaction, onSuccess);
  return { call: jest.fn(), isRequesting: false };
});
jest.mock("ui/common/Filters/QueryContext", () => ({ withQueryContext: (component: any) => component }));
jest.mock("ui/common/table/StatefulTable", () => ({ data }: any) => <div data-testid="shops">
  {data.map((shop: any) => <p key={shop.id}>{shop.name}</p>)}
</div>);
jest.mock("ui/common/FormModal", () => () => null);
jest.mock("ui/common/PublicCatalogQrCodeModal", () => () => null);
jest.mock("ui/toolCheckouts/ReservationSettingsFields", () => () => null);
jest.mock("ui/toolCheckouts/ShopColorField", () => () => null);
jest.mock("api/toolCheckouts", () => ({
  listShops: jest.fn(), listManagedShops: jest.fn(), listTools: jest.fn(),
  adminCreateShop: jest.fn(), adminUpdateShop: jest.fn(), adminDeleteShop: jest.fn()
}));

import { getRootReducer } from "ui/reducer";
import { listShops, listManagedShops, listTools, adminCreateShop, adminUpdateShop, adminDeleteShop } from "api/toolCheckouts";
import { CheckoutCatalogProvider } from "ui/toolCheckouts/CheckoutCatalog";
import ShopManager, { resourceManagerIdsUpdate } from "ui/toolCheckouts/ShopManager";

describe("shop manager permissions", () => {
  it("omits resource-manager assignments from non-privileged updates", () => {
    const managers = [{ id: "manager-1" }];
    expect(resourceManagerIdsUpdate(false, managers)).toEqual({});
    expect(resourceManagerIdsUpdate(true, managers)).toEqual({ resourceManagerIds: ["manager-1"] });
  });
});

describe.each([false, true])("ShopManager with catalog provider=%s", (withCatalog) => {
  let container: HTMLDivElement;
  let root: Root;
  const result = (name: string) => ({ data: [{ id: "shop-1", name }], response: {} });
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.resetAllMocks();
    mockSuccessCallbacks.clear();
    mockStore = createStore(getRootReducer());
    (listShops as jest.Mock).mockResolvedValue(result("Public record"));
    (listManagedShops as jest.Mock).mockResolvedValue(result("Original managed record"));
    (listTools as jest.Mock).mockResolvedValue({ data: [], response: {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  async function renderManager() {
    await act(async () => root.render(<Provider store={mockStore}>
      {withCatalog
        ? <CheckoutCatalogProvider scopeKey="member-1"><ShopManager /></CheckoutCatalogProvider>
        : <ShopManager />}
    </Provider>));
  }

  it("recovers a failed management request through Retry management settings", async () => {
    (listManagedShops as jest.Mock).mockResolvedValueOnce({ error: { message: "Management unavailable" }, response: {} });
    await renderManager();
    const retry = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent === "Retry management settings")!;
    expect(retry).toBeDefined();
    await act(async () => retry.click());
    expect(listManagedShops).toHaveBeenCalledTimes(2);
    expect(listShops).toHaveBeenCalledTimes(withCatalog ? 2 : 1);
    expect(container.textContent).not.toContain("Management unavailable");
    expect(container.querySelector('[data-testid="shops"]')!.textContent).toBe("Original managed record");
  });

  it.each([
    ["add", adminCreateShop], ["edit", adminUpdateShop], ["delete", adminDeleteShop]
  ] as const)("refreshes both shop reads once after successful %s", async (_operation, transaction) => {
    await renderManager();
    expect(container.querySelector('[data-testid="shops"]')!.textContent).toBe("Original managed record");
    (listManagedShops as jest.Mock).mockResolvedValue(result("Updated managed record"));
    await act(async () => mockSuccessCallbacks.get(transaction)!());
    expect(listShops).toHaveBeenCalledTimes(2);
    expect(listManagedShops).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="shops"]')!.textContent).toBe("Updated managed record");
  });
});
