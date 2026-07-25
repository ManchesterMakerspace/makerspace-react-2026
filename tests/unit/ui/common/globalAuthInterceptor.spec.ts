import {
  attachGlobalAuthInterceptor,
  setGlobalDispatch,
  setupGlobalAuthInterceptor,
  shouldRedirectToLogin,
} from "ui/common/globalAuthInterceptor";

describe("global authentication interception", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/login");
  });

  it("recognizes protected and public routes", () => {
    expect(shouldRedirectToLogin("/members/123")).toBe(true);
    expect(shouldRedirectToLogin("/reservations")).toBe(true);
    expect(shouldRedirectToLogin("/login")).toBe(false);
    expect(shouldRedirectToLogin("/signup")).toBe(false);
    expect(shouldRedirectToLogin("/resetPassword")).toBe(false);
  });

  it("handles a 401 from an isolated Axios instance", async () => {
    const dispatch = jest.fn();
    const use = jest.fn();
    const api = {
      interceptors: {
        response: { use },
      },
    } as any;
    setGlobalDispatch(dispatch);
    attachGlobalAuthInterceptor(api);

    const rejectResponse = use.mock.calls[0][1];
    const error = { response: { status: 401 } };
    await expect(rejectResponse(error)).rejects.toBe(error);

    expect(dispatch).toHaveBeenCalledWith({ type: "reset" });
    expect(dispatch).toHaveBeenCalledWith({ type: "AUTH/LOGOUT" });
  });

  it("handles API 401 responses returned through window.fetch", async () => {
    const dispatch = jest.fn();
    const originalFetch = jest.fn().mockResolvedValue({ status: 401 });
    window.fetch = originalFetch as any;
    setupGlobalAuthInterceptor(dispatch);

    await window.fetch("/api/reservations");

    expect(originalFetch).toHaveBeenCalledWith("/api/reservations");
    expect(dispatch).toHaveBeenCalledWith({ type: "reset" });
    expect(dispatch).toHaveBeenCalledWith({ type: "AUTH/LOGOUT" });
  });
});
