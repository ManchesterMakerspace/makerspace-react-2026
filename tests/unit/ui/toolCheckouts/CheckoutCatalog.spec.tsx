import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Provider } from "react-redux";
import { createStore } from "redux";

let mockStore: any;
jest.mock("app/main", () => ({ getStore: () => mockStore }));
jest.mock("ui/auth/actions", () => ({ authReducer: (state = {}) => state }));
jest.mock("ui/billing/actions", () => ({ billingReducer: (state = {}) => state }));
jest.mock("ui/earnedMemberships/actions", () => ({ earnedMembershipsReducer: (state = {}) => state }));
jest.mock("ui/checkout/cart", () => ({ cartReducer: (state = {}) => state }));
jest.mock("api/toolCheckouts", () => ({
  listShops: jest.fn(), listManagedShops: jest.fn(), listTools: jest.fn()
}));

import { getRootReducer } from "ui/reducer";
import { listShops, listManagedShops, listTools } from "api/toolCheckouts";
import { CheckoutCatalogProvider, useCheckoutCatalog } from "ui/toolCheckouts/CheckoutCatalog";

const Consumer = ({ resource }: { resource: "shops" | "managedShops" | "tools" }) => {
  const { data = [], refresh, error } = useCheckoutCatalog(resource);
  return <button onClick={refresh}>{error || data.map(row => row.name).join(",")}</button>;
};

describe("checkout catalog fetching", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = createStore(getRootReducer());
    for (const [fn, name] of [[listShops, "public"], [listManagedShops, "managed"], [listTools, "tool"]] as const) {
      (fn as jest.Mock).mockResolvedValue({ data: [{ id: name, name }], response: {} });
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  async function render(resources: Array<"shops" | "managedShops" | "tools">, scopeKey = "member-1") {
    await act(async () => {
      root.render(<Provider store={mockStore}>
        <CheckoutCatalogProvider key={scopeKey} scopeKey={scopeKey}>
          {resources.map((resource, index) => <Consumer key={`${resource}-${index}`} resource={resource} />)}
        </CheckoutCatalogProvider>
      </Provider>);
    });
  }

  it("fetches lazily once per resource across consumers and tab switches", async () => {
    await render(["tools", "tools"]);
    expect(listTools).toHaveBeenCalledTimes(1);
    expect(listShops).not.toHaveBeenCalled();
    await render(["shops"]);
    await render(["tools"]);
    expect(listTools).toHaveBeenCalledTimes(1);
    expect(listShops).toHaveBeenCalledTimes(1);
  });

  it("keeps public and management catalogs separate and refreshes after mutations", async () => {
    await render(["shops", "managedShops", "tools"]);
    expect(container.textContent).toContain("publicmanagedtool");
    await act(async () => container.querySelector("button")!.click());
    expect(listShops).toHaveBeenCalledTimes(2);
    expect(listManagedShops).toHaveBeenCalledTimes(2);
    expect(listTools).toHaveBeenCalledTimes(2);
  });

  it("refetches when the viewer changes and on focus", async () => {
    await render(["tools"]);
    await render(["tools"], "member-2");
    expect(listTools).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(listTools).toHaveBeenCalledTimes(3);
  });
});
