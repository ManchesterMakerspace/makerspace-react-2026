import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

let mockRows: any[] = [];
jest.mock('api/toolCheckouts', () => ({ listToolGroups: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => ({ currentUser: {} }) }));
jest.mock("ui/hooks/useReadTransaction", () => () => ({ data: mockRows, refresh: jest.fn() }));
jest.mock("ui/hooks/useWriteTransaction", () => () => ({ call: jest.fn() }));
jest.mock("ui/toolCheckouts/CheckoutCatalog", () => ({ useCheckoutCatalog: () => ({ data: [{ id: "wood", name: "Woodshop" }, { id: "other", name: "Other shop" }], refresh: jest.fn() }) }));
jest.mock("ui/common/Filters/QueryContext", () => ({ withQueryContext: (component: any) => component }));
jest.mock("ui/common/table/StatefulTable", () => ({ data, columns }: any) => <>
  {data.map((row: any) => <div key={row.id}>{columns.find((column: any) => column.id === "toolName").cell(row)}</div>)}
</>);
jest.mock("ui/common/FormModal", () => ({ isOpen, children, onSubmit }: any) => isOpen ? <div>{children}<button onClick={onSubmit}>Submit checkout</button></div> : null);
jest.mock("ui/common/MemberSearchInput", () => (props: any) => <input data-fully-active={props.fullyActiveUnexpired} />);
jest.mock("ui/toolCheckouts/GroupApproval", () => ({ group, memberId }: any) => <div>Review {group.name} for {memberId}</div>);
import { listToolGroups } from 'api/toolCheckouts';
import CheckoutRoster from "ui/toolCheckouts/CheckoutRoster";

describe("checkout roster notes and member selection", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.useFakeTimers();
    mockRows = [{ id: "checkout", toolName: "Bandsaw", toolNotes: "Cabinet combination: 1234" }];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });

  it("exposes tool notes on keyboard focus in My Active Tool Checkouts", async () => {
    await act(async () => root.render(<CheckoutRoster memberView isAdmin={false} isResourceManager={false} />));
    expect(container.textContent).toContain("My Active Tool Checkouts");
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

});
