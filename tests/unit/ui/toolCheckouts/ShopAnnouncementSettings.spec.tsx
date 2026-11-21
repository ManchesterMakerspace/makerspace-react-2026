import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

jest.mock("ui/common/FormModal", () => ({ children, title, onSubmit, submitText }: any) =>
  <section aria-label={title}>{children}<button onClick={onSubmit}>{submitText}</button></section>);
jest.mock("ui/common/PublicCatalogQrCodeModal", () => () => null);
jest.mock("ui/common/CheckoutRequiredSheetButton", () => () => null);
jest.mock("ui/common/MemberSearchInput", () => () => null);
jest.mock("ui/toolCheckouts/ReservationSettingsFields", () => () => null);
jest.mock("ui/toolCheckouts/ShopColorField", () => ({ __esModule: true, default: () => null, colorUsage: () => ({}) }));
jest.mock("ui/toolCheckouts/RequestorAnnotationHelp", () => () => null);
jest.mock("ui/toolCheckouts/CheckoutCatalog", () => ({ useCheckoutCatalog: () => null }));
jest.mock("ui/common/Filters/QueryContext", () => ({ withQueryContext: (component: any) => component }));
jest.mock("app/permissions", () => ({ useCapabilities: () => ({}) }));
jest.mock("api/toolCheckouts", () => ({}));
jest.mock("ui/hooks/useWriteTransaction", () => () => ({}));

import { AddShopModal, EditShopModal } from "ui/toolCheckouts/ShopManager";

describe("shop empty reservation announcements", () => {
  let root: Root;
  let container: HTMLDivElement;
  const label = "Announce empty reservation agendas in Slack";
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const checkbox = () => container.querySelector(`input[type="checkbox"]`) as HTMLInputElement;
  const save = () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Save Shop")!;

  it.each([undefined, false, true])("edits saved value %s independently of whole-shop reservability", saved => {
    const onSave = jest.fn();
    act(() => root.render(<EditShopModal shop={{ id: "shop", name: "Woodshop", reservable: false,
      slackAnnounceEmptyReservations: saved } as any} tools={[]} onSave={onSave} onCancel={jest.fn()}
      saving={false} error="" canManageResourceManagers={false} />));
    expect(container.textContent).toContain(label);
    expect(checkbox().checked).toBe(saved ?? false);
    act(() => checkbox().click());
    act(() => save().click());
    expect(onSave).toHaveBeenCalledWith("shop", expect.objectContaining({
      slackAnnounceEmptyReservations: !(saved ?? false), reservable: false
    }));
  });

  it("shows an unchecked preference when adding a shop", () => {
    act(() => root.render(<AddShopModal shops={[]} onSave={jest.fn()} onClose={jest.fn()} loading={false} error="" />));
    expect(container.textContent).toContain(label);
    expect(checkbox().checked).toBe(false);
    expect(checkbox().closest("label")?.textContent).toContain(label);
  });

  it("disables the preference while the edit is saving", () => {
    act(() => root.render(<EditShopModal shop={{ id: "shop", name: "Woodshop" } as any} tools={[]}
      onSave={jest.fn()} onCancel={jest.fn()} saving={true} error="" canManageResourceManagers={false} />));
    expect(checkbox().disabled).toBe(true);
  });
});
