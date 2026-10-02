import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

let auth: any;
const dispatch = jest.fn();
jest.mock("react-redux", () => ({ useDispatch: () => dispatch }));
jest.mock("ui/reducer/hooks", () => ({ useAuthState: () => auth }));
jest.mock("ui/auth/actions", () => ({ sessionLoginUserAction: () => ({ type: "restore" }) }));
jest.mock("ui/common/globalAuthInterceptor", () => ({ setupGlobalAuthInterceptor: jest.fn(), setGlobalDispatch: jest.fn() }));
jest.mock("ui/common/Header", () => () => null);
jest.mock("ui/common/Footer", () => () => null);
jest.mock("ui/common/LoadingOverlay", () => () => null);
jest.mock("app/PrivateRouting", () => () => <div>Private</div>);
jest.mock("app/PublicRouting", () => () => <div>Public</div>);
import App from "app/App";

const homeVisits = ["member", "admin", "board_member", "resource_manager"].flatMap(role =>
  ["/home", "/home?newMember=true"].map(target => ({ role, target })));

describe("central post-login navigation", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    sessionStorage.clear();
    auth = { currentUser: {}, permissions: {}, isRequesting: true, totpEnrollmentRequired: false };
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));
  const render = () => act(async () => root.render(<BrowserRouter><App /></BrowserRouter>));
  const location = () => window.location.pathname + window.location.search + window.location.hash;
  const signIn = async (status = "activeMember", role = "member") => {
    auth = { ...auth, isRequesting: false, currentUser: { id: "me", role, status } };
    await render();
  };

  it.each(["/", "/login"])("routes pending members from %s after authentication", async path => {
    window.history.replaceState({}, "", path);
    await render();
    await signIn("pending");
    expect(location()).toBe("/home?newMember=true");
  });
  it("routes active restored sessions to plain Home", async () => {
    window.history.replaceState({}, "", "/");
    await render();
    await signIn();
    expect(location()).toBe("/home");
  });
  it.each(["admin", "board_member", "resource_manager"])("retains %s profile landing", async role => {
    window.history.replaceState({}, "", "/login");
    await render();
    await signIn("activeMember", role);
    expect(location()).toBe("/members/me");
  });
  it("preserves explicit destinations and their query/hash without double decoding", async () => {
    const target = "/home?newMember=true&value=%25#next";
    window.history.replaceState({}, "", `/login?redirect=${encodeURIComponent(target)}`);
    await render();
    await signIn();
    expect(location()).toBe(target);
  });
  it.each(homeVisits)("keeps $role at $target after restoring a session", async ({ role, target }) => {
    window.history.replaceState({}, "", target);
    await render();
    await signIn("activeMember", role);
    expect(location()).toBe(target);
  });
  it.each(homeVisits)("returns $role to $target after sign-in", async ({ role, target }) => {
    window.history.replaceState({}, "", `/login?redirect=${encodeURIComponent(target)}`);
    await render();
    auth.isRequesting = false;
    await render();
    await signIn("activeMember", role);
    expect(location()).toBe(target);
  });
  it.each(homeVisits)("honors $role navigating to $target during session restoration", async ({ role, target }) => {
    window.history.replaceState({}, "", "/members/me");
    await render();
    await act(async () => { window.history.pushState({}, "", target); window.dispatchEvent(new PopStateEvent("popstate")); });
    await signIn("activeMember", role);
    expect(location()).toBe(target);
  });
  it.each(homeVisits)("keeps signed-in $role at an explicitly visited $target", async ({ role, target }) => {
    window.history.replaceState({}, "", "/login");
    await render();
    await signIn("activeMember", role);
    await act(async () => { window.history.pushState({}, "", target); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(location()).toBe(target);
  });
  it("keeps signup in control until it finishes", async () => {
    window.history.replaceState({}, "", "/signup");
    await render();
    await signIn("pending");
    expect(location()).toBe("/signup");
  });
  it("prioritizes security enrollment and retains the explicit target", async () => {
    window.history.replaceState({}, "", "/login?redirect=%2Fworkshops");
    await render();
    auth.totpEnrollmentRequired = true;
    await signIn("activeMember", "admin");
    expect(location()).toBe("/members/me/settings/security");
    expect(sessionStorage.getItem("login-redirect")).toBe("/workshops");
  });
  it("resets navigation after logout and another login within the same app", async () => {
    window.history.replaceState({}, "", "/login");
    await render();
    await signIn();
    auth.currentUser = {};
    await render();
    await act(async () => { window.history.pushState({}, "", "/login"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await signIn("pending");
    expect(location()).toBe("/home?newMember=true");
  });
  it("retains a direct Home destination while requiring security enrollment", async () => {
    window.history.replaceState({}, "", "/home?newMember=true#next");
    await render();
    auth.totpEnrollmentRequired = true;
    await signIn("activeMember", "admin");
    expect(location()).toBe("/members/me/settings/security");
    expect(sessionStorage.getItem("login-redirect")).toBe("/home?newMember=true#next");
  });
  it.each(homeVisits)("retains $role's latest $target visit through security enrollment", async ({ role, target }) => {
    window.history.replaceState({}, "", "/members/me");
    await render();
    const destination = `${target}#next`;
    await act(async () => { window.history.pushState({}, "", destination); window.dispatchEvent(new PopStateEvent("popstate")); });
    auth.totpEnrollmentRequired = true;
    await signIn("activeMember", role);
    expect(location()).toBe("/members/me/settings/security");
    expect(sessionStorage.getItem("login-redirect")).toBe(destination);
  });
});
