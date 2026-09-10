// actions.ts also imports firebaseSignOut (for logoutUserAction, untested
// here) which pulls in the real Firebase SDK -- that import chain checks for
// a global `fetch` at load time and throws in this jsdom test environment.
// Mock the module rather than the SDK internals since nothing here exercises it.
jest.mock("ui/auth/firebase", () => ({ firebaseSignOut: jest.fn() }));

import { loginUserAction } from "ui/auth/actions";
import { Action as AuthAction } from "ui/auth/constants";

describe("loginUserAction", () => {
  const originalFetch = global.fetch;
  const form = { email: "member@example.com", password: "wrong" };
  let dispatch: jest.Mock;

  beforeEach(() => {
    dispatch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const mockResponse = (body: any, status = 401) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve(body),
    }) as any;
  };

  it("surfaces the backend's plain-string error message instead of swallowing it", async () => {
    // This is the shape require_completed_totp_challenge actually renders --
    // { error: "some string" }, not { error: { message } }. See #257.
    mockResponse({ error: "TOTP verification required." });

    await (loginUserAction(form as any) as any)(dispatch, () => ({}), undefined);

    expect(dispatch).toHaveBeenLastCalledWith({
      type: AuthAction.AuthUserFailure,
      error: "TOTP verification required.",
    });
  });

  it("falls back to a top-level message field when error is absent", async () => {
    mockResponse({ message: "Invalid Email or password." });

    await (loginUserAction(form as any) as any)(dispatch, () => ({}), undefined);

    expect(dispatch).toHaveBeenLastCalledWith({
      type: AuthAction.AuthUserFailure,
      error: "Invalid Email or password.",
    });
  });

  it("falls back to a generic message when the response body has neither", async () => {
    mockResponse({});

    await (loginUserAction(form as any) as any)(dispatch, () => ({}), undefined);

    expect(dispatch).toHaveBeenLastCalledWith({
      type: AuthAction.AuthUserFailure,
      error: "Invalid email or password.",
    });
  });
});
