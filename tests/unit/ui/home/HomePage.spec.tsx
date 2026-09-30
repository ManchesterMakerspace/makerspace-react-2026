import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { getHome } from "api/home";
import { claimVolunteerTask, checkinVolunteerEvent } from "api/volunteer";
import { listInvoices } from "makerspace-ts-api-client";

let homeState: any;
let invoiceState: any;
const refreshHome = jest.fn();
const refreshInvoices = jest.fn();
const emptyCart = jest.fn();
const addToCart = jest.fn();
const read = jest.fn();
jest.mock("ui/hooks/useReadTransaction", () => ({ __esModule: true, default: (...args: any[]) => read(...args) }));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => ({ currentUser: { id: "me", role: "admin" }, permissions: { billing: true } }) }));
jest.mock("ui/checkout/cart", () => ({ useEmptyCart: () => emptyCart, useAddToCart: () => addToCart }));
jest.mock("api/volunteer", () => ({ claimVolunteerTask: jest.fn(), checkinVolunteerEvent: jest.fn() }));
import HomePage, { membershipCoverage } from "ui/home/HomePage";

const Location = () => { const location = useLocation(); return <span data-location>{location.pathname}</span>; };
const invoice = (overrides = {}) => ({ id: "invoice-1", memberId: "me", name: "Membership dues", resourceClass: "member", amount: "65.00", dueDate: Date.now() - 1000, pastDue: true, settled: false, ...overrides });
const opportunity = (overrides = {}) => ({ id: "task1", kind: "task", title: "Organize supplies", description: "Sort the storage bins", shopName: "Woodshop", creditValue: 1, eventDate: null, ...overrides });

describe("Home page", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    refreshHome.mockReset();
    (claimVolunteerTask as jest.Mock).mockReset();
    (checkinVolunteerEvent as jest.Mock).mockReset();
    homeState = { data: {
      member: { id: "me", status: "pending", subscription: false, expirationTime: null },
      slack: { accepted: false, newMembersChannelUrl: null },
      availableVolunteerOpportunities: [],
      availableCheckouts: [{ id: "orientation", name: "Orientation", shopName: "Facilities", requestorAnnotation: "Bring ID\nMeet at the front door" }],
    }, isRequesting: false, refresh: refreshHome };
    invoiceState = { data: [], isRequesting: false, refresh: refreshInvoices,
      response: { response: { headers: { get: () => "0" } } } };
    read.mockImplementation((fn: any) => fn === getHome ? homeState : invoiceState);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const render = async (path = "/home") => act(async () => root.render(<MemoryRouter initialEntries={[path]}><HomePage /><Location /></MemoryRouter>));
  const button = (text: string) => Array.from(container.querySelectorAll("button")).find(node => node.textContent === text)!;

  it("renders welcome, Slack guidance, inline annotations and invoices in order", async () => {
    await render("/home?newMember=true");
    expect(container.querySelector("h1")?.textContent).toBe("Welcome!");
    expect(container.querySelector('a[href="/members/me/settings"]')?.textContent).toBe("Account Settings");
    expect(container.textContent).toContain("Thank you for joining the Makerspace, you will receive several email messages");
    expect(container.textContent).toContain("in-person orientation and receive your access card.");
    expect(container.textContent).toContain("Please accept your Slack Invite (check your email)");
    expect(container.textContent).toContain("Annotation for requestorsBring ID");
    expect(container.querySelector('a[href="/tools/orientation/request-checkout"]')?.textContent).toBe("Request Safety Checkout");
    expect(Array.from(container.querySelectorAll("h2")).map(node => node.textContent)).toEqual(["Available safety checkouts", "Open unpaid invoices"]);
    expect(container.textContent).toContain("No unpaid invoices are currently due");
    expect(read).toHaveBeenCalledWith(getHome, {}, false, "member-home", true, true);
  });

  it.each(["/home", "/home?newMember=false", "/home?newMember=1"])("shows the summary at %s", async path => {
    homeState.data.member = { ...homeState.data.member, subscriptionId: "sub1", paidPendingStart: true };
    homeState.data.slack = { accepted: true, newMembersChannelUrl: "https://slack.com/app_redirect?team=T1&channel=C1" };
    await render(path);
    expect(container.textContent).toContain("Individual subscription");
    expect(container.textContent).toContain("Awaiting activation");
    expect(container.textContent).not.toContain("Thank you for joining");
    expect(container.querySelector('a[href^="https://slack.com/"]')?.textContent).toBe("Get started with Slack");
    expect(container.textContent).not.toContain("Please accept your Slack Invite");
  });

  it.each([
    [{ household: { role: "primary" }, subscriptionId: "sub1" }, "Household membership (primary member)"],
    [{ householdRole: "secondary" }, "Household membership (secondary member)"],
    [{ earnedMembershipActive: true }, "Earned membership"],
    [{ earnedMembershipActive: false, expirationTime: 1 }, "Prepaid membership"],
    [{ subscription: true }, "Individual subscription"],
    [{}, "No membership"],
  ])("summarizes coverage accurately", (member, expected) => {
    expect(membershipCoverage(member as any)).toBe(expected);
  });

  it("handles missing expiration, empty recommendations and missing Slack configuration", async () => {
    homeState.data.slack.accepted = true;
    homeState.data.availableCheckouts = [];
    await render();
    expect(container.textContent).toContain("Not set");
    expect(container.textContent).toContain("No safety checkouts are currently available");
    expect(container.textContent).toContain("Slack channel link is temporarily unavailable");
  });

  it("keeps invoices visible when Home fails and supports independent retries", async () => {
    homeState.error = "Home failed";
    invoiceState.data = [invoice()];
    await render();
    expect(container.textContent).toContain("Membership dues");
    await act(async () => button("Retry").click());
    expect(refreshHome).toHaveBeenCalled();
    invoiceState.error = "Invoices failed";
    await render();
    await act(async () => button("Retry invoices").click());
    expect(refreshInvoices).toHaveBeenCalled();
  });

  it("uses only self-service invoices for staff, paginates and stages payment", async () => {
    invoiceState.data = [invoice()];
    invoiceState.response.response.headers.get = () => "2";
    await render();
    expect(read).toHaveBeenCalledWith(listInvoices, { settled: false, pastDue: true, orderBy: "due_date", order: "asc", pageNum: 0 }, false, "home-invoices", true, true);
    await act(async () => button("Next").click());
    expect(read).toHaveBeenLastCalledWith(listInvoices, expect.objectContaining({ pageNum: 1 }), false, "home-invoices", true, true);
    await act(async () => button("Pay").click());
    expect(emptyCart).toHaveBeenCalledTimes(1);
    expect(addToCart).toHaveBeenCalledWith(invoiceState.data[0]);
    expect(container.querySelector("[data-location]")?.textContent).toBe("/checkout");
  });

  it("links automatic invoices to subscriptions and exposes accessible details", async () => {
    invoiceState.data = [invoice({ subscriptionId: "sub1" })];
    await render();
    expect(button("Pay")).toBeUndefined();
    expect(container.querySelector('a[href="/members/me/settings/subscriptions"]')?.textContent).toBe("Manage Subscription");
    await act(async () => button("View").click());
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-labelledby")).toBe("home-invoice-details-title");
  });

  it("shows volunteer tasks and events before safety checkouts for active members", async () => {
    homeState.data.member.status = "activeMember";
    homeState.data.availableVolunteerOpportunities = [opportunity(), opportunity({ id: "event1", kind: "event", title: "Open house", eventDate: "2030-10-05", creditValue: 2 })];
    await render();
    expect(Array.from(container.querySelectorAll("h2")).map(node => node.textContent)).toEqual([
      "Available Volunteer Opportunities", "Available safety checkouts", "Open unpaid invoices",
    ]);
    expect(container.textContent).toContain("Task · 1 volunteer credit · Woodshop");
    expect(container.textContent).toContain("Event · 2 volunteer credits · Woodshop · 05 Oct 2030");
    expect(container.textContent).toContain("Sort the storage bins");
    expect(button("Claim Task").getAttribute("aria-label")).toBe("Claim Task: Organize supplies");
    expect(button("Join Event").getAttribute("aria-label")).toBe("Join Event: Open house");
  });

  it.each(["pending", "inactive", "nonMember", "revoked", "suspended"])("omits volunteer opportunities for %s members", async status => {
    homeState.data.member.status = status;
    homeState.data.availableVolunteerOpportunities = [opportunity()];
    await render();
    expect(container.querySelector("#home-volunteer-title")).toBeNull();
  });

  it("omits the section for empty lists and older API responses", async () => {
    homeState.data.member.status = "activeMember";
    await render();
    expect(container.querySelector("#home-volunteer-title")).toBeNull();
    delete homeState.data.availableVolunteerOpportunities;
    await render();
    expect(container.querySelector("#home-volunteer-title")).toBeNull();
  });

  it.each(["task", "event"])("claims a %s, refreshes Home and announces success even when the list becomes empty", async kind => {
    homeState.data.member.status = "activeMember";
    homeState.data.availableVolunteerOpportunities = [opportunity({ kind })];
    const api = kind === "task" ? claimVolunteerTask : checkinVolunteerEvent;
    (api as jest.Mock).mockResolvedValue({ data: {} });
    refreshHome.mockImplementation(() => { homeState.data.availableVolunteerOpportunities = []; });
    await render();
    await act(async () => button(kind === "task" ? "Claim Task" : "Join Event").click());
    expect(api).toHaveBeenCalledWith({ id: "task1" });
    expect(refreshHome).toHaveBeenCalledTimes(1);
    expect(container.querySelector("#home-volunteer-title")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(kind === "task" ? "Task claimed" : "Joined event");
  });

  it("shows claim errors and permits retry without hiding the opportunities", async () => {
    homeState.data.member.status = "activeMember";
    homeState.data.availableVolunteerOpportunities = [opportunity()];
    (claimVolunteerTask as jest.Mock).mockResolvedValueOnce({ error: { message: "Task is no longer available" } }).mockResolvedValueOnce({ data: {} });
    await render();
    await act(async () => button("Claim Task").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Task is no longer available");
    expect(refreshHome).not.toHaveBeenCalled();
    await act(async () => button("Claim Task").click());
    expect(refreshHome).toHaveBeenCalledTimes(1);
  });

  it("disables all claim actions and prevents duplicate submissions while a claim is pending", async () => {
    homeState.data.member.status = "activeMember";
    homeState.data.availableVolunteerOpportunities = [opportunity(), opportunity({ id: "event1", kind: "event" })];
    let finish: (value: unknown) => void;
    (claimVolunteerTask as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render();
    await act(async () => { button("Claim Task").click(); button("Claim Task").click(); });
    expect(claimVolunteerTask).toHaveBeenCalledTimes(1);
    expect(button("Submitting…").disabled).toBe(true);
    expect(button("Join Event").disabled).toBe(true);
    await act(async () => finish!({ data: {} }));
    expect(refreshHome).toHaveBeenCalledTimes(1);
  });
});
