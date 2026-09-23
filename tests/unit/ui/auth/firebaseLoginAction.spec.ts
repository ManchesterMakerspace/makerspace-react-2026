jest.mock('ui/auth/firebase', () => ({ firebaseSignOut: jest.fn().mockResolvedValue(undefined) }));
jest.mock('makerspace-ts-api-client', () => ({
  ...jest.requireActual('makerspace-ts-api-client'),
  listMembersPermissions: jest.fn(),
  signOut: jest.fn(),
}));
import { firebaseLoginAction, logoutUserAction, sessionLoginUserAction, loginUserAction } from 'ui/auth/actions';
import { listMembersPermissions, signOut } from 'makerspace-ts-api-client';
import { firebaseSignOut } from 'ui/auth/firebase';
import { platform } from 'app/platform';
import { Action } from 'ui/auth/constants';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; platform.native = false; jest.clearAllMocks(); });
test('Google TOTP challenges do not fetch permissions or authenticate prematurely', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 202, ok: true, json: async () => ({ totp_required: true }) });
  const dispatch = jest.fn();
  await (firebaseLoginAction('token') as any)(dispatch);
  expect(dispatch).toHaveBeenLastCalledWith({ type: Action.TotpRequired });
  expect(listMembersPermissions).not.toHaveBeenCalled();
});
test('Google enrollment requirements are dispatched atomically', async () => {
  const member = { id: 'member-1', totp_enrollment_required: true };
  global.fetch = jest.fn().mockResolvedValue({ status: 200, ok: true, json: async () => member });
  (listMembersPermissions as jest.Mock).mockResolvedValue({ data: { billing: true } });
  const dispatch = jest.fn();
  await (firebaseLoginAction('token') as any)(dispatch);
  expect(dispatch).toHaveBeenLastCalledWith({ type: Action.AuthEnrollmentRequired, data: { member, permissions: { billing: true } } });
  expect(dispatch.mock.calls.some(([action]) => action.type === Action.AuthUserSuccess)).toBe(false);
});
test('native logout clears local authentication when Rails is unreachable', async () => {
  platform.native = true;
  (signOut as jest.Mock).mockRejectedValue(new Error('offline'));
  const dispatch = jest.fn();
  await (logoutUserAction() as any)(dispatch);
  expect(firebaseSignOut).toHaveBeenCalled();
  expect(dispatch).toHaveBeenLastCalledWith({ type: Action.LogoutSuccess });
});
test('native session restoration recovers from connection failure', async () => {
  platform.native = true;
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const dispatch = jest.fn();
  await (sessionLoginUserAction() as any)(dispatch);
  expect(dispatch).toHaveBeenLastCalledWith({ type: Action.AuthUserFailure, error: undefined });
});
test('native password failure stops the spinner and allows explicit retry', async () => {
  platform.native = true;
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const dispatch = jest.fn();
  await (loginUserAction({ email: 'test@example.org', password: 'test' }) as any)(dispatch);
  expect(dispatch).toHaveBeenLastCalledWith({ type: Action.AuthUserFailure, error: expect.stringContaining('try again') });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
