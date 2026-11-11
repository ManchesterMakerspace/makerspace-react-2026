import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { getPayNowSubscription, payNow } from "api/payNow";

jest.mock("api/payNow", () => ({ getPayNowSubscription: jest.fn(), payNow: jest.fn() }));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => ({ currentUser: { id: "me" } }) }));
import PayNowPanel from "ui/payNow/PayNowPanel";

const subscription = (overrides = {}) => ({
  id: "member_sub_1", status: "Past Due", amount: "65.00", canPayNow: true, payNowBlockedReason: null,
  lastFailureMessage: "insufficient funds", nextPayNowAt: null, ...overrides,
});
const loaded = (overrides = {}) => (getPayNowSubscription as jest.Mock).mockResolvedValue({ data: subscription(overrides) });

describe("Pay now panel", () => {
  let root: Root;
  let container: HTMLDivElement;
  const onPaid = jest.fn();

  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const render = async (variant: "banner" | "inline" = "banner", subscriptionId: string | null = "member_sub_1") => {
    await act(async () => {
      root.render(<MemoryRouter><PayNowPanel variant={variant} subscriptionId={subscriptionId} onPaid={onPaid} /></MemoryRouter>);
    });
  };
  const button = () => Array.from(container.querySelectorAll("button")).find(b => /Pay now|Paying/.test(b.textContent || "")) as HTMLButtonElement;
  const press = async () => { await act(async () => { button().click(); }); };

  it("shows nothing without a subscription, and does not look anything up", async () => {
    await render("banner", null);
    expect(container.textContent).toBe("");
    expect(getPayNowSubscription).not.toHaveBeenCalled();
  });

  it("shows nothing for a subscription that is not past due", async () => {
    loaded({ status: "Active", canPayNow: false, lastFailureMessage: null });
    await render();
    expect(container.textContent).toBe("");
  });

  it("shows nothing while the subscription is loading", async () => {
    (getPayNowSubscription as jest.Mock).mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.textContent).toBe("");
  });

  it("shows nothing when the subscription cannot be loaded", async () => {
    (getPayNowSubscription as jest.Mock).mockResolvedValue({ error: { status: 500, message: "boom" } });
    await render();
    expect(container.textContent).toBe("");
  });

  it("banner: amber warning with the amount, the reason and a Pay now button", async () => {
    loaded();
    await render();
    const banner = container.querySelector("[data-testid='pay-now-banner']")!;
    expect(banner.textContent).toContain("Your last payment of $65.00 didn't go through (insufficient funds). Pay now to keep your access.");
    expect(banner.className).toContain("MuiAlert-colorWarning");
    expect(banner.querySelector("svg")).not.toBeNull();
    expect(button().disabled).toBe(false);
  });

  it("leaves the reason out when it is not known", async () => {
    loaded({ lastFailureMessage: null });
    await render();
    expect(container.textContent).toContain("didn't go through. Pay now to keep your access.");
    expect(container.textContent).not.toContain("()");
  });

  it("inline: sits in settings with its own wording", async () => {
    loaded();
    await render("inline");
    expect(container.querySelector("[data-testid='pay-now-inline']")!.textContent).toContain("The last payment of $65.00 didn't go through (insufficient funds).");
  });

  it("loading: disables the button and says Paying while the charge runs", async () => {
    loaded();
    let finish: (value: any) => void = () => {};
    (payNow as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render();
    await press();
    expect(button().textContent).toContain("Paying");
    expect(button().disabled).toBe(true);
    await act(async () => { finish({ paid: true, subscription: subscription({ status: "Active" }) }); });
  });

  it("success: confirms, drops the button and tells the page to refresh", async () => {
    loaded();
    (payNow as jest.Mock).mockResolvedValue({ paid: true, subscription: subscription({ status: "Active" }) });
    await render();
    await press();
    expect(payNow).toHaveBeenCalledWith("member_sub_1");
    expect(container.textContent).toContain("Payment received, your access is restored.");
    expect(button()).toBeUndefined();
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("soft decline: shows why, then holds the button for the hour between attempts", async () => {
    loaded();
    (payNow as jest.Mock).mockResolvedValue({ paid: false, refusal: {
      status: 422, error: "payment_declined", message: "Your payment did not go through: insufficient funds.",
      failureMessage: "insufficient funds", canPayNow: false, payNowBlockedReason: "cooldown", nextPayNowAt: "2026-11-08T15:00:00Z",
    } });
    await render();
    await press();
    expect(container.textContent).toContain("Your payment did not go through: insufficient funds.");
    expect(container.textContent).toMatch(/You can try again after/);
    expect(button().disabled).toBe(true);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("hard decline: disabled with a link to change the payment method", async () => {
    loaded({ canPayNow: false, payNowBlockedReason: "hard_decline", lastFailureMessage: "the card has expired" });
    await render();
    expect(container.textContent).toContain("(the card has expired)");
    expect(container.textContent).toContain("This card cannot be tried again");
    expect(button().disabled).toBe(true);
    const link = Array.from(container.querySelectorAll("a")).find(a => /Update payment method/.test(a.textContent || ""))!;
    expect(link.getAttribute("href")).toContain("/me");
    expect(link.getAttribute("href")).toContain("settings");
  });

  it("hard decline in settings points to the Change Payment Method button below instead of a link", async () => {
    loaded({ canPayNow: false, payNowBlockedReason: "hard_decline" });
    await render("inline");
    expect(container.textContent).toContain("Use Change Payment Method below.");
    expect(container.querySelector("a")).toBeNull();
  });

  it("a hard decline found when pressing the button disables it", async () => {
    loaded();
    (payNow as jest.Mock).mockResolvedValue({ paid: false, refusal: {
      status: 422, error: "payment_declined", message: "Your payment did not go through: the card has expired. Update your payment method before trying again.",
      failureMessage: "the card has expired", canPayNow: false, payNowBlockedReason: "hard_decline", nextPayNowAt: null,
    } });
    await render();
    await press();
    expect(container.textContent).toContain("Update your payment method before trying again.");
    expect(button().disabled).toBe(true);
    expect(container.textContent).toContain("This card cannot be tried again");
  });

  it("cooldown: disabled, and says when to come back", async () => {
    loaded({ canPayNow: false, payNowBlockedReason: "cooldown", nextPayNowAt: "2026-11-08T15:00:00Z" });
    await render();
    expect(button().disabled).toBe(true);
    expect(container.textContent).toMatch(/You can try again after/);
  });

  it("daily limit: disabled, with the limit explained", async () => {
    loaded({ canPayNow: false, payNowBlockedReason: "daily_cap", nextPayNowAt: "2026-11-09T12:00:00Z" });
    await render();
    expect(button().disabled).toBe(true);
    expect(container.textContent).toContain("today's limit of 3 payment attempts");
  });

  it("a 429 from the server while pressing shows its message and disables the button", async () => {
    loaded();
    (payNow as jest.Mock).mockResolvedValue({ paid: false, refusal: {
      status: 429, error: "cooldown", message: "A payment was just attempted. Wait an hour before trying again.", nextPayNowAt: "2026-11-08T15:00:00Z",
    } });
    await render();
    await press();
    expect(container.textContent).toContain("A payment was just attempted. Wait an hour before trying again.");
    expect(button().disabled).toBe(true);
  });

  it("an unexpected error shows its message and leaves the button available to try again", async () => {
    loaded();
    (payNow as jest.Mock).mockResolvedValue({ paid: false, refusal: { status: 500, error: "unavailable", message: "Something went wrong. Please try again." } });
    await render();
    await press();
    expect(container.textContent).toContain("Something went wrong. Please try again.");
    expect(button().disabled).toBe(false);
  });
});
