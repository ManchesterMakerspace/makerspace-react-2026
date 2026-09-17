import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockRefresh = jest.fn();
let mockManagedError = "";
let mockLoadingManaged = false;
let mockTools: any[] = [];
let mockShops: any[] = [];
jest.mock("ui/toolCheckouts/CheckoutCatalog", () => ({
  useCheckoutCatalog: (resource: string) => ({
    data: resource === "tools" ? mockTools : mockShops,
    response: { response: { headers: { get: () => "150" } } },
    error: resource === "managedShops" ? mockManagedError : "",
    isRequesting: resource === "managedShops" && mockLoadingManaged,
    refresh: mockRefresh
  })
}));
jest.mock("app/permissions", () => ({ useCapabilities: () => ({ canManageCheckoutApprovers: true }) }));
jest.mock("ui/common/Filters/QueryContext", () => ({ withQueryContext: (component: any) => component }));
jest.mock("ui/common/table/StatefulTable", () => ({ data, columns, totalItems }: any) => <div data-testid="manager-table" data-total-items={totalItems} data-row-count={data.length}>
  {data.map((row: any) => <div key={row.id}>{columns.find((column: any) => column.id === "notes")?.cell(row)}</div>)}
</div>);
jest.mock("ui/common/FormModal", () => () => null);
jest.mock("ui/common/PublicCatalogQrCodeModal", () => () => null);
jest.mock("ui/toolCheckouts/ToolQrCodeModal", () => () => null);
jest.mock("ui/toolCheckouts/ReservationSettingsFields", () => () => null);
jest.mock("ui/toolCheckouts/ShopColorField", () => () => null);
jest.mock("api/toolCheckouts", () => ({
  adminCreateShop: jest.fn(), adminUpdateShop: jest.fn(), adminDeleteShop: jest.fn(),
  adminCreateTool: jest.fn(), adminUpdateTool: jest.fn(), adminDeleteTool: jest.fn(),
  adminUpdateToolNotes: jest.fn()
}));

import ShopManager from "ui/toolCheckouts/ShopManager";
import ToolManager from "ui/toolCheckouts/ToolManager";
import { adminUpdateToolNotes } from "api/toolCheckouts";

describe("manager catalog refresh callbacks", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    mockManagedError = "";
    mockLoadingManaged = false;
    mockTools = [{ id: "tool-1", name: "Bandsaw", notes: "Cabinet combination", shopId: "shop-1" }];
    mockShops = [];
    (adminUpdateToolNotes as jest.Mock).mockResolvedValue({ data: {}, response: {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("retries failed management settings through the catalog refresh", async () => {
    mockManagedError = "Request failed";
    await act(async () => root.render(<ShopManager />));
    const retry = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent === "Retry management settings")!;
    expect(retry).toBeDefined();
    await act(async () => retry.click());
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    mockLoadingManaged = true;
    await act(async () => root.render(<ShopManager />));
    expect(Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent === "Retrying…")?.disabled).toBe(true);
  });

  it("refreshes the shared catalog once after a successful inline notes save", async () => {
    await act(async () => root.render(<ToolManager />));
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Edit notes"]')!.click());
    expect(container.querySelector("textarea")).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Save"] button')!.click());
    expect(adminUpdateToolNotes).toHaveBeenCalledWith({ id: "tool-1", notes: "Cabinet combination" });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("uses the filtered tool count for pagination instead of the catalog response total", async () => {
    mockShops = [
      { id: "shop-1", name: "Woodshop" },
      { id: "shop-2", name: "Metalshop" },
      { id: "shop-empty", name: "Empty shop" }
    ];
    mockTools = [
      { id: "tool-1", name: "Bandsaw", shopId: "shop-1" },
      { id: "tool-2", name: "Lathe", shopId: "shop-1" },
      { id: "tool-3", name: "Welder", shopId: "shop-2" }
    ];
    await act(async () => root.render(<ToolManager />));
    const table = () => container.querySelector('[data-testid="manager-table"]')!;
    expect(table().getAttribute("data-total-items")).toBe("3");
    for (const [shopId, count] of [["shop-1", "2"], ["shop-2", "1"], ["shop-empty", "0"], ["", "3"]]) {
      await act(async () => {
        const select = container.querySelector("select")!;
        select.value = shopId;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(table().getAttribute("data-row-count")).toBe(count);
      expect(table().getAttribute("data-total-items")).toBe(count);
    }
  });
});
