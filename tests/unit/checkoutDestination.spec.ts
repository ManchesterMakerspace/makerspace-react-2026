import { checkoutDestination, clearCheckoutDestination } from "ui/auth/checkoutDestination";

describe("checkout login destination", () => {
  beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/login"); });
  it("retains a stable tool destination across login and TOTP navigation", () => {
    const path = "/tools/0123456789abcdef01234567/request-checkout";
    window.history.replaceState({}, "", `/login?return_to=${encodeURIComponent(path)}`);
    expect(checkoutDestination()).toBe(path);
    window.history.replaceState({}, "", "/members/abc/settings/security");
    expect(checkoutDestination()).toBe(path);
    clearCheckoutDestination();
    expect(checkoutDestination()).toBeNull();
  });
  it.each(["/", "/signup", "/workshops", "/login", "/login?redirect=%2Fworkshops"])("abandons a checkout target on %s", next => {
    const path = "/tools/0123456789abcdef01234567/request-checkout";
    window.history.replaceState({}, "", `/login?return_to=${encodeURIComponent(path)}`);
    expect(checkoutDestination()).toBe(path);
    window.history.replaceState({}, "", next);
    expect(checkoutDestination()).toBeNull();
    expect(sessionStorage.getItem("checkout-return-to")).toBeNull();
    window.history.replaceState({}, "", "/login");
    expect(checkoutDestination()).toBeNull();
  });
  it("gives an explicit redirect priority even alongside return_to", () => {
    const path = "/tools/0123456789abcdef01234567/request-checkout";
    window.history.replaceState({}, "", `/login?return_to=${encodeURIComponent(path)}&redirect=/workshops`);
    expect(checkoutDestination()).toBeNull();
  });
  it.each(["https://example.com", "//example.com", "/tools/invalid/request-checkout", "/members"])("rejects %s", path => {
    window.history.replaceState({}, "", `/login?return_to=${encodeURIComponent(path)}`);
    expect(checkoutDestination()).toBeNull();
  });
});
