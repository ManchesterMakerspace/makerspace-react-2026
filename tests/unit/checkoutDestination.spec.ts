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
  it.each(["https://example.com", "//example.com", "/tools/invalid/request-checkout", "/members"])("rejects %s", path => {
    window.history.replaceState({}, "", `/login?return_to=${encodeURIComponent(path)}`);
    expect(checkoutDestination()).toBeNull();
  });
});
