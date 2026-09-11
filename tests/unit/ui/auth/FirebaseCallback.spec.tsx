import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { checkoutDestination } from "ui/auth/checkoutDestination";

const navigate = jest.fn();
const firebaseLogin = jest.fn().mockResolvedValue(undefined);
const completeProviderSignIn = jest.fn().mockResolvedValue("provider-token");
const clearProviderSignInState = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
jest.mock("react-redux", () => ({ connect: () => (Component: any) => (props: any) =>
  <Component {...props} firebaseLogin={firebaseLogin} /> }));
jest.mock("ui/auth/actions", () => ({ firebaseLoginAction: jest.fn() }));
jest.mock("ui/auth/firebase", () => ({
  completeProviderSignIn: (...args: any[]) => completeProviderSignIn(...args),
  clearProviderSignInState: () => clearProviderSignInState(),
}));
import FirebaseCallback from "ui/auth/FirebaseCallback";

describe("Firebase checkout return handoff", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  it.each(["google", "apple", "github", "microsoft"])("keeps the %s return target through callback and login", async provider => {
    const target = "/tools/0123456789abcdef01234567/request-checkout";
    window.history.replaceState({}, "", `/login?return_to=${encodeURIComponent(target)}`);
    expect(checkoutDestination()).toBe(target);
    sessionStorage.setItem("firebase_pending_provider", provider);
    window.history.replaceState({}, "", "/auth/callback");
    expect(checkoutDestination()).toBe(target); // App reads this before callback completion.
    await act(async () => root.render(<FirebaseCallback />));
    expect(firebaseLogin).toHaveBeenCalledWith("provider-token");
    expect(clearProviderSignInState).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`/login?return_to=${encodeURIComponent(target)}`);
    window.history.replaceState({}, "", navigate.mock.calls[0][0]);
    expect(checkoutDestination()).toBe(target);
  });
  it("keeps ordinary provider sign-ins on the normal login handoff", async () => {
    window.history.replaceState({}, "", "/auth/callback");
    await act(async () => root.render(<FirebaseCallback />));
    expect(navigate).toHaveBeenCalledWith("/login");
  });
});
