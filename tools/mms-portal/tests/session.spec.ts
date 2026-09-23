import { sessionCsrf } from '../src/session';

test('reads fresh tokens rather than caching them across mutations', async () => {
  const read = jest.fn().mockResolvedValueOnce({ token: 'first' }).mockResolvedValueOnce({ token: 'rotated' });
  const bootstrap = jest.fn();
  const csrf = sessionCsrf(read, bootstrap);
  expect(await csrf()).toBe('first');
  expect(await csrf()).toBe('rotated');
  expect(bootstrap).not.toHaveBeenCalled();
});
test('bootstraps after logout and shares concurrent bootstraps', async () => {
  let token = '';
  const bootstrap = jest.fn(async () => { await Promise.resolve(); token = 'new-session'; });
  const csrf = sessionCsrf(async () => ({ token }), bootstrap);
  expect(await Promise.all([csrf(), csrf()])).toEqual(['new-session', 'new-session']);
  expect(bootstrap).toHaveBeenCalledTimes(1);
});
test('allows an explicit retry after bootstrap failure', async () => {
  let token = '';
  const bootstrap = jest.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(async () => { token = 'restored'; });
  const csrf = sessionCsrf(async () => ({ token }), bootstrap);
  await expect(csrf()).rejects.toThrow('offline');
  expect(await csrf()).toBe('restored');
});
test('rejects bootstrap without an XSRF cookie before a mutation can run', async () => {
  await expect(sessionCsrf(async () => ({ token: '' }), async () => {})()).rejects.toThrow('secure portal session');
});
