// actions.ts also imports firebaseSignOut (for logoutUserAction, untested
// here) which pulls in the real Firebase SDK -- that import chain checks for
// a global `fetch` at load time and throws in this jsdom test environment.
// Mock the module rather than the SDK internals since nothing here exercises it.
jest.mock("ui/auth/firebase", () => ({ firebaseSignOut: jest.fn() }));

import { firebaseLoginAction, loginUserAction } from "ui/auth/actions";
import { listMembersPermissions } from 'makerspace-ts-api-client';
jest.mock('makerspace-ts-api-client', () => ({
  ...jest.requireActual('makerspace-ts-api-client'),
  listMembersPermissions: jest.fn(),
  isApiErrorResponse: (response: any) => !!response.error,
}));
import { Action as AuthAction } from "ui/auth/constants";

describe("loginUserAction", () => {
  const originalFetch = global.fetch;
  const form = { email: "member@example.com", password: "wrong" };
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('sends the password persistence choice without turning a challenge into success', async () => {
    mockResponse({ totp_required: true }, 202);
    await (loginUserAction({ ...form, rememberMe: true }) as any)(dispatch);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).member.rememberMe).toBe(true);
    expect(dispatch).toHaveBeenLastCalledWith({ type: AuthAction.TotpRequired });
    expect(listMembersPermissions).not.toHaveBeenCalled();
  });

  it('sends the provider choice and handles 202 before attempting to fetch permissions', async () => {
    mockResponse({ totp_required: true }, 202);
    await (firebaseLoginAction('token', true) as any)(dispatch);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ id_token: 'token', rememberMe: true });
    expect(dispatch).toHaveBeenLastCalledWith({ type: AuthAction.TotpRequired });
    expect(listMembersPermissions).not.toHaveBeenCalled();
  });

  it('handles provider enrollment without marking authentication complete', async () => {
    const member = { id: 'member1', totp_enrollment_required: true };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => member });
    (listMembersPermissions as jest.Mock).mockResolvedValue({ data: [] });
    await (firebaseLoginAction('token', false) as any)(dispatch);
    expect(dispatch).toHaveBeenLastCalledWith({ type: AuthAction.AuthEnrollmentRequired, data: { member, permissions: [] } });
  });
});
