import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

jest.mock("api/reservations", () => ({
  getReservationCatalog: jest.fn(), getReservationAvailability: jest.fn(),
  getReservationBlackouts: jest.fn(), listReservations: jest.fn(),
  listManagedReservations: jest.fn(), previewReservationUpdate: jest.fn(), previewReservation: jest.fn(), createReservation: jest.fn(),
  previewManagedReservation: jest.fn(),
}));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: jest.fn(() => ({
  currentUser: { id: "member", status: "activeMember", expirationTime: 4102444800000 }
})) }));
jest.mock("app/permissions", () => ({ useCapabilities: () => ({}) }));
jest.mock("ui/member/utils", () => ({ memberIsResourceManager: () => false }));
jest.mock("ui/common/MemberSearchInput", () => () => null);
jest.mock("ui/toolCheckouts/ShopManager", () => () => null);
jest.mock("ui/toolCheckouts/ToolManager", () => () => null);
jest.mock("ui/reservations/ReservationBlackouts", () => () => null);
jest.mock("ui/reservations/DayAgenda", () => () => null);

jest.mock("api/shopFees", () => ({ listShopFeeItems: jest.fn() }));
import { listShopFeeItems } from "api/shopFees";
import ReservationSettingsFields from "ui/toolCheckouts/ReservationSettingsFields";
import MemberReservationsTab from "ui/reservations/MemberReservationsTab";
import * as api from "api/reservations";
import ReservationsPage from "ui/reservations/ReservationsPage";
import { useAuthState } from "ui/reducer/hooks";

describe("reservation fee confirmation and full-day dates", () => {
  let container: HTMLDivElement;
  let root: Root;
  const preview = {
    eligible: true, errors: [], conflicts: [], missingPrerequisites: [],
    requiresApproval: false, approvalReasons: [], approvalDetails: [], maximumDurationHours: 48,
    feeTotal: 15, feeConfirmation: "quote-15",
    feeLines: [{ resourceName: "Shop", name: "Daily fee", units: 1, unitAmount: 15, amount: 15 }],
  };

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers({ now: new Date("2026-09-09T13:00:00Z") });
    jest.clearAllMocks();
    (useAuthState as jest.Mock).mockReturnValue({ currentUser: { id: 'member', status: 'activeMember', expirationTime: 4102444800000 } });
    (api.getReservationCatalog as jest.Mock).mockResolvedValue({ data: {
      shops: [{ id: "shop", name: "Shop", reservable: true, reservationFullDay: true, maxReservationDurationHours: 48 }], tools: []
    } });
    for (const fn of [api.getReservationAvailability, api.getReservationBlackouts, api.listReservations, api.listManagedReservations]) {
      (fn as jest.Mock).mockResolvedValue({ data: [] });
    }
    (api.previewReservation as jest.Mock).mockResolvedValue({ data: preview });
    (api.createReservation as jest.Mock).mockResolvedValue({ data: { id: "reservation", title: "Project", status: "unpaid" } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  const button = (text: string) => Array.from(container.querySelectorAll("button"))
    .find(node => node.textContent?.trim() === text) as HTMLButtonElement;

  const prepare = async () => {
    await act(async () => { root.render(<ReservationsPage />); });
    const title = container.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Project");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { jest.advanceTimersByTime(300); });
  };

  it('opens another member\'s managed reservation from an outage review link', async () => {
    (useAuthState as jest.Mock).mockReturnValue({ currentUser: { id: 'manager', isAdmin: true, status: 'activeMember', expirationTime: 4102444800000 } });
    (api.listManagedReservations as jest.Mock).mockResolvedValue({ data: [{ id: 'affected', memberId: 'other', title: 'Affected booking', shopId: 'shop', reservationScope: 'shop', fullDay: true, status: 'approved', startAt: '2026-09-10T04:00:00Z', endAt: '2026-09-11T04:00:00Z' }] });
    (api.previewManagedReservation as jest.Mock).mockResolvedValue({ data: preview });
    window.scrollTo = jest.fn();
    window.history.replaceState({}, '', '/reservations?edit=affected');
    await act(async () => root.render(<ReservationsPage />));
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(api.previewManagedReservation).toHaveBeenCalledWith({ id: 'affected', body: expect.objectContaining({ title: 'Affected booking' }) });
    expect(api.previewReservationUpdate).not.toHaveBeenCalled();
  });

  it("shows approval explanations on unpaid member reservations", async () => {
    (api.listReservations as jest.Mock).mockResolvedValue({ data: [{
      id: "booking", memberId: "member", title: "Project", status: "unpaid", shopName: "Shop",
      startAt: "2026-09-10T04:00:00Z", endAt: "2026-09-11T04:00:00Z",
      approvalReasons: ["resource_requires_approval"],
      approvalDetails: [{ code: "resource_requires_approval", message: "Manager approval is still required" }]
    }] });
    await act(async () => root.render(<MemberReservationsTab member={{ id: "member" } as any} />));
    expect(container.textContent).toContain("Manager approval is still required");
  });

  it("keeps every reserved tool while separately warning about unavailable ones", async () => {
    (api.listReservations as jest.Mock).mockResolvedValue({ data: [{
      id: "booking", memberId: "member", title: "Project", status: "approved", shopName: "Shop",
      toolNames: ["Lathe", "Drill press"], outOfServiceToolNames: ["Lathe"],
      startAt: "2026-09-10T04:00:00Z", endAt: "2026-09-11T04:00:00Z", approvalReasons: []
    }] });
    await act(async () => root.render(<MemberReservationsTab member={{ id: "member" } as any} />));
    expect(container.textContent).toContain("Lathe, Drill press");
    expect(container.textContent).toContain("Out of service: Lathe");
  });

  it("preserves an existing full-day booking after the configured maximum is reduced", async () => {
    window.history.replaceState({}, "", "/?edit=booking");
    window.scrollTo = jest.fn();
    (api.getReservationCatalog as jest.Mock).mockResolvedValue({ data: {
      shops: [{ id: "shop", name: "Shop", reservable: true, maxReservationDurationHours: 8 }], tools: []
    } });
    (api.listReservations as jest.Mock).mockResolvedValue({ data: [{
      id: "booking", memberId: "member", title: "Project", status: "approved", shopId: "shop", fullDay: true,
      reservationScope: "shop", toolIds: [], approvalReasons: [],
      startAt: "2026-09-10T04:00:00Z", endAt: "2026-09-11T04:00:00Z"
    }] });
    (api.previewReservationUpdate as jest.Mock).mockResolvedValue({ data: preview });
    await prepare();
    expect(container.textContent).not.toContain("Start time");
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(api.previewReservationUpdate).toHaveBeenLastCalledWith({ id: "booking", body: expect.objectContaining({
      fullDay: true, startAt: "2026-09-10T04:00:00.000Z", endAt: "2026-09-11T04:00:00.000Z"
    }) });
  });

  it("disables adding fees while loading and enables it after a fee arrives", async () => {
    let resolve: (value: any) => void = () => {};
    (listShopFeeItems as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    const change = jest.fn();
    await act(async () => root.render(<ReservationSettingsFields value={{ reservable: true }} onChange={change} />));
    expect(button("Add duration-based fee").disabled).toBe(true);
    await act(async () => resolve({ data: [{ id: "fee", name: "Fee", amount: 10, disabled: false }] }));
    await act(async () => button("Add duration-based fee").click());
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ durationFees: [expect.objectContaining({ invoiceOptionId: "fee" })] }));
  });

  it("keeps adding disabled for empty or disabled-only fee catalogs", async () => {
    (listShopFeeItems as jest.Mock).mockResolvedValue({ data: [{ id: "fee", disabled: true, amount: 10 }] });
    await act(async () => root.render(<ReservationSettingsFields value={{ reservable: true }} onChange={jest.fn()} />));
    expect(button("Add duration-based fee").disabled).toBe(true);
  });

  it("offers retry after a failed fee catalog load", async () => {
    (listShopFeeItems as jest.Mock).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: [{ id: "fee", name: "Fee", amount: 10 }] });
    await act(async () => root.render(<ReservationSettingsFields value={{ reservable: true }} onChange={jest.fn()} />));
    expect(button("Add duration-based fee").disabled).toBe(true);
    await act(async () => button("Retry").click());
    expect(button("Add duration-based fee").disabled).toBe(false);
  });

  it("forces full day on, hides times, and sends future midnight boundaries", async () => {
    await prepare();
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(container.textContent).not.toContain("Start time");
    const dates = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(dates).toHaveLength(2);
    expect(dates[0].value).toBe("2026-09-10");
    expect(dates[0].min).toBe("2026-09-10");
    expect(api.previewReservation).toHaveBeenLastCalledWith({ body: expect.objectContaining({
      fullDay: true, startAt: "2026-09-10T04:00:00.000Z", endAt: "2026-09-11T04:00:00.000Z"
    }) });
  });

  it("shows the rounded notice cutoff and prevents a disallowed submission", async () => {
    jest.setSystemTime(new Date("2026-09-09T21:11:00Z"));
    (api.getReservationCatalog as jest.Mock).mockResolvedValue({ data: {
      shops: [{ id: "shop", name: "Shop", reservable: true, minimumAdvanceNoticeHours: 2 }], tools: []
    } });
    (api.previewReservation as jest.Mock).mockResolvedValue({ data: { ...preview, eligible: false,
      errors: ["Minimum advance notice is 2 hours"]
    } });
    await prepare();
    expect(container.textContent).toContain("Sep 9, 2026 19:00");
    expect(button("Reserve").disabled).toBe(true);
  });

  it("sets tomorrow as the earliest date when same-day bookings are prohibited", async () => {
    (api.getReservationCatalog as jest.Mock).mockResolvedValue({ data: {
      shops: [{ id: "shop", name: "Shop", reservable: true, prohibitSameDayReservations: true }], tools: []
    } });
    await prepare();
    expect(container.querySelector<HTMLInputElement>('input[type="date"]')?.min).toBe("2026-09-10");
    expect(container.textContent).toContain("Same day reservations are prohibited.");
  });

  it("shows the charge and requires a second click to approve it", async () => {
    await prepare();
    expect(container.textContent).toContain("Reservation fee: $15.00");
    await act(async () => button("Reserve").click());
    expect(api.createReservation).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Click again to approve this fee");
    await act(async () => button("Approve $15.00 and save").click());
    expect(api.createReservation).toHaveBeenCalledWith({ body: expect.objectContaining({ feeConfirmation: "quote-15", fullDay: true }) });
  });

  it("shows overdue debt and prevents submission", async () => {
    (api.previewReservation as jest.Mock).mockResolvedValue({ data: { ...preview, eligible: false,
      errors: ["Pay all overdue shop fee invoices before making or changing a fee-incurring reservation"]
    } });
    await prepare();
    expect(container.textContent).toContain("Pay all overdue shop fee invoices");
    expect(button("Reserve").disabled).toBe(true);
    expect(api.createReservation).not.toHaveBeenCalled();
  });

  it("explains that fees are invoiced after RM approval", async () => {
    (api.previewReservation as jest.Mock).mockResolvedValue({ data: { ...preview,
      requiresApproval: true, approvalReasons: ["resource_requires_approval"]
    } });
    await prepare();
    expect(container.textContent).toContain("The invoice will be issued only after RM approval.");
    await act(async () => button("Reserve").click());
    expect(api.createReservation).not.toHaveBeenCalled();
  });

});
