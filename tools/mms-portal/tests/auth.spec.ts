import { googleSignIn } from '../src/auth';
const setup = () => ({
  configuration: jest.fn().mockResolvedValue({ configured: true, projectId: 'makerspace' }),
  projectId: () => 'makerspace',
  signIn: jest.fn().mockResolvedValue({ credential: { idToken: 'raw-google-token' } }),
  idToken: jest.fn().mockResolvedValue({ token: 'firebase-token' }),
});
test('returns the Firebase ID token, not the Google credential', async () => {
  const bridge = setup();
  expect(await googleSignIn(bridge)()).toBe('firebase-token');
});
test.each([false, true])('fails before login for missing or mismatched config (%s)', configured => {
  const bridge = setup();
  bridge.configuration.mockResolvedValue({ configured, projectId: 'wrong-project' });
  return expect(googleSignIn(bridge)()).rejects.toThrow('not configured');
});
test('cancellation does not acquire a Firebase token', async () => {
  const bridge = setup(); bridge.signIn.mockRejectedValue(new Error('Sign-in canceled'));
  await expect(googleSignIn(bridge)()).rejects.toThrow('canceled');
  expect(bridge.idToken).not.toHaveBeenCalled();
});
