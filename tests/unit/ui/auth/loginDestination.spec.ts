import { clearLoginDestination, defaultLoginDestination, loginDestination, safeLoginRedirect } from "ui/auth/loginDestination";
import { loginUrlForLocation } from "ui/common/globalAuthInterceptor";

describe("member login destination", () => {
  beforeEach(() => sessionStorage.clear());
  it("preserves Home queries/fragments when a 401 requires a full login reload", () => {
    expect(loginUrlForLocation({ pathname: "/home", search: "?newMember=true", hash: "#next" }))
      .toBe("/login?redirect=%2Fhome%3FnewMember%3Dtrue%23next");
    expect(loginUrlForLocation({ pathname: "/tools/abc/request-checkout", search: "", hash: "" }))
      .toBe("/login?return_to=%2Ftools%2Fabc%2Frequest-checkout");
    expect(loginUrlForLocation({ pathname: "/tools/abc/check-out-member", search: "", hash: "" }))
      .toBe("/login?return_to=%2Ftools%2Fabc%2Fcheck-out-member");
  });
  it.each([
    ["member", "pending", "/home?newMember=true"],
    ["member", "activeMember", "/home"],
    ["member", "inactive", "/home"],
    ["admin", "activeMember", "/members/me"],
    ["board_member", "pending", "/members/me"],
    ["resource_manager", "activeMember", "/members/me"],
  ])("routes %s / %s to %s", (role, status, expected) => {
    expect(defaultLoginDestination({ id: "me", role, status })).toBe(expected);
  });

  it("preserves a Home query through provider callback and TOTP enrollment", () => {
    const destination = "/home?newMember=true#next";
    window.history.replaceState({}, "", `/login?redirect=${encodeURIComponent(destination)}`);
    expect(loginDestination()).toBe(destination);
    for (const path of ["/auth/callback", "/members/me/settings/security"]) {
      window.history.replaceState({}, "", path);
      expect(loginDestination()).toBe(destination);
    }
    clearLoginDestination();
    expect(loginDestination()).toBeNull();
  });

  it.each(["/login", "/signup", "/"])("abandons an old target at %s", path => {
    window.history.replaceState({}, "", "/login?redirect=%2Fworkshops");
    loginDestination();
    window.history.replaceState({}, "", path);
    expect(loginDestination()).toBeNull();
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "/login", "/auth/callback", "/"])("rejects unsafe or looping redirect %s", path => {
    expect(safeLoginRedirect(path)).toBeNull();
  });
});
