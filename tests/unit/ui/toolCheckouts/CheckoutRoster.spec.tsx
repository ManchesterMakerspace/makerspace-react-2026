import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

let mockRows: any[] = [];
let mockCurrentUser: any = {};
const mockWrites: { fn: any; args: any }[] = [];
jest.mock('api/toolCheckouts', () => ({
  listToolGroups: jest.fn().mockResolvedValue({ data: [] }),
  adminReinstateToolCheckout: jest.fn(),
}));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => ({ currentUser: mockCurrentUser }) }));
jest.mock("ui/hooks/useReadTransaction", () => () => ({ data: mockRows, refresh: jest.fn() }));
jest.mock("ui/hooks/useWriteTransaction", () => (fn: any) => ({ call: (args: any) => mockWrites.push({ fn, args }) }));
jest.mock("ui/toolCheckouts/CheckoutCatalog", () => ({ useCheckoutCatalog: () => ({ data: [{ id: "wood", name: "Woodshop" }, { id: "other", name: "Other shop" }], refresh: jest.fn() }) }));
jest.mock("ui/common/Filters/QueryContext", () => ({ withQueryContext: (component: any) => component }));
jest.mock("ui/common/table/StatefulTable", () => ({ data, columns, setSelectedIds }: any) => <>
  {data.map((row: any) => <div key={row.id}>
    {columns.map((column: any) => <div key={column.id} data-column={column.id}>{column.cell(row)}</div>)}
    {setSelectedIds && <button onClick={() => setSelectedIds(row.id)}>Select {row.id}</button>}
  </div>)}
</>);
jest.mock("ui/common/FormModal", () => ({ isOpen, children, onSubmit }: any) => isOpen ? <div>{children}<button onClick={onSubmit}>Submit checkout</button></div> : null);
jest.mock("ui/common/MemberSearchInput", () => (props: any) => <input data-fully-active={props.fullyActiveUnexpired} />);
jest.mock("ui/toolCheckouts/GroupApproval", () => ({ group, memberId }: any) => <div>Review {group.name} for {memberId}</div>);
import { listToolGroups, adminReinstateToolCheckout } from 'api/toolCheckouts';
import CheckoutRoster from "ui/toolCheckouts/CheckoutRoster";

describe("checkout roster notes and member selection", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.useFakeTimers();
    mockCurrentUser = {};
    mockWrites.length = 0;
    mockRows = [{ id: "checkout", toolName: "Bandsaw", toolNotes: "Cabinet combination: 1234" }];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });

  it("exposes tool notes on keyboard focus in My Tool Checkouts", async () => {
    await act(async () => root.render(<CheckoutRoster memberView isAdmin={false} isResourceManager={false} />));
    expect(container.textContent).toContain("My Tool Checkouts");
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Notes for Bandsaw"]')!;
    expect(trigger.tabIndex).toBe(0);
    await act(async () => trigger.focus());
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Cabinet combination: 1234");
  });

  it("omits the tooltip for missing or whitespace-only notes", async () => {
    mockRows = [{ id: "a", toolName: "Lathe" }, { id: "b", toolName: "Saw", toolNotes: "  " }];
    await act(async () => root.render(<CheckoutRoster memberView isAdmin={false} isResourceManager={false} />));
    expect(container.querySelector('button[aria-label^="Notes for"]')).toBeNull();
  });

  it("opts the checkout modal into server-filtered member search", async () => {
    await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Check Out Member")!.click();
    });
    expect(container.querySelector('input[data-fully-active="true"]')).not.toBeNull();
  });
  it("allows group-only approvers to select their group shop and reach manual review", async () => {
    (listToolGroups as jest.Mock).mockResolvedValueOnce({ data: [
      { id: 'kit', name: 'Wood kit', shopId: 'wood', canApprove: true },
      { id: 'other-kit', name: 'Other kit', shopId: 'other', canApprove: false },
    ] });
    await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} preselectedMember={{ id: 'trainee', name: 'Trainee' }} />));
    await act(async () => { Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Add Checkout')!.click(); });
    const shop = container.querySelector<HTMLSelectElement>('select[aria-label="Shop"]')!;
    expect(Array.from(shop.options).map(option => option.value)).toEqual(['', 'wood']);
    await act(async () => { shop.value = 'wood'; shop.dispatchEvent(new Event('change', { bubbles: true })); });
    const tool = container.querySelector<HTMLSelectElement>('select[aria-label="Tool"]')!;
    expect(tool.disabled).toBe(false);
    expect(Array.from(tool.options).map(option => option.value)).toEqual(['', 'group:kit']);
    await act(async () => { tool.value = 'group:kit'; tool.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Submit checkout')!.click(); });
    expect(container.textContent).toContain('Review Wood kit for trainee');
  });

  describe("reinstating a revoked checkout", () => {
    const click = async (label: string) => act(async () => {
      Array.from(container.querySelectorAll("button")).find(button => button.textContent === label)!.click();
    });
    const hasButton = (label: string) =>
      Array.from(container.querySelectorAll("button")).some(button => button.textContent === label);
    beforeEach(() => {
      mockRows = [
        { id: "revoked", toolName: "Lathe", memberName: "Pat", shopName: "Metal", active: false, revokedAt: "2026-10-01T12:00:00Z" },
        { id: "live", toolName: "Mill", memberName: "Sam", shopName: "Metal", active: true },
      ];
    });

    it("lets an admin reinstate a selected revoked checkout with a reason", async () => {
      mockCurrentUser = { isAdmin: true };
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
      expect(hasButton("Reinstate Checkout")).toBe(false);
      await click("Select revoked");
      await click("Reinstate Checkout");
      const input = container.querySelector("textarea")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Retrained");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await click("Submit checkout");
      expect(mockWrites).toEqual([{ fn: adminReinstateToolCheckout, args: { id: "revoked", body: { reason: "Retrained" } } }]);
    });

    it("offers Reinstate to board members", async () => {
      mockCurrentUser = { isBoardMember: true };
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
      await click("Select revoked");
      expect(hasButton("Reinstate Checkout")).toBe(true);
    });

    it("never shows Reinstate to resource managers or on an active checkout", async () => {
      mockCurrentUser = { isResourceManager: true };
      await act(async () => root.render(<CheckoutRoster isAdmin={false} isResourceManager />));
      await click("Select revoked");
      expect(hasButton("Reinstate Checkout")).toBe(false);
      mockCurrentUser = { isAdmin: true };
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager />));
      await click("Select live");
      expect(hasButton("Reinstate Checkout")).toBe(false);
      expect(hasButton("Revoke Checkout")).toBe(true);
    });
  });

  describe("notes, reinstated status and filter", () => {
    const column = (id: string, index = 0) => container.querySelectorAll(`[data-column="${id}"]`)[index].textContent;
    beforeEach(() => {
      mockRows = [
        { id: "new", toolName: "Lathe", active: true, reinstatedFromId: "old", reinstatementReason: "Retrained",
          reinstatedByName: "Bo Board", reinstatedAt: "2026-03-02T12:00:00Z", requestNote: "ignored on reinstated" },
        { id: "old", toolName: "Lathe", active: false, reinstated: true, reinstatedByCheckoutId: "new",
          checkedOutAt: "2026-01-01T12:00:00Z", revokedAt: "2026-02-01T12:00:00Z", revocationReason: "Unsafe use",
          revokedByName: "Al Admin" },
        { id: "plain", toolName: "Mill", active: true, requestNote: "Building a table" },
        { id: "gone", toolName: "Saw", active: false, revokedAt: "2026-02-01T12:00:00Z", revocationReason: "Left unattended" },
      ];
    });

    it("shows revocation, reinstatement and request notes to managers", async () => {
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
      expect(column("notes", 0)).toContain("Reinstated: Retrained");
      expect(column("notes", 0)).toContain("by Bo Board");
      expect(column("notes", 1)).toContain("Revoked: Unsafe use");
      expect(column("notes", 1)).toContain("by Al Admin");
      expect(column("notes", 2)).toContain("Request note: Building a table");
      expect(column("notes", 3)).toContain("Revoked: Left unattended");
    });

    it("has no Notes column in the member's own view", async () => {
      await act(async () => root.render(<CheckoutRoster memberView isAdmin={false} isResourceManager={false} />));
      expect(container.querySelector('[data-column="notes"]')).toBeNull();
    });

    it("labels the superseded revoked row Reinstated and badges its replacement", async () => {
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
      expect(column("active", 0)).toContain("Active");
      expect(column("active", 0)).toContain("Reinstated");
      expect(column("active", 1)).toContain("Reinstated");
      expect(column("active", 1)).not.toContain("Revoked");
      expect(column("active", 3)).toContain("Revoked");
      expect(column("active", 2)).not.toContain("Reinstated");
    });

    it("offers the Reinstated status filter", async () => {
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
      const options = Array.from(container.querySelectorAll("select option")).map(option => option.textContent);
      expect(options).toEqual(expect.arrayContaining(["Active only", "Revoked only", "Reinstated", "All"]));
    });

    it("does not offer Reinstate on a revoked row that was already reinstated", async () => {
      mockCurrentUser = { isAdmin: true };
      await act(async () => root.render(<CheckoutRoster isAdmin isResourceManager={false} />));
      await act(async () => { Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Select old")!.click(); });
      expect(Array.from(container.querySelectorAll("button")).some(b => b.textContent === "Reinstate Checkout")).toBe(false);
      await act(async () => { Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Select gone")!.click(); });
      expect(Array.from(container.querySelectorAll("button")).some(b => b.textContent === "Reinstate Checkout")).toBe(true);
    });
  });
});
