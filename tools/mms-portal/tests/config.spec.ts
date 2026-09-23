const { settings } = require('../config.cjs');
test('uses the production portal by default', () => {
  expect(settings({})).toEqual({ origin: 'https://members.manchestermakerspace.org', debug: false });
});
test.each(['http://localhost:3002', 'https://user:pass@example.org', 'https://example.org/path', 'https://example.org?token=x'])('rejects unsafe production origin %s', url => {
  expect(() => settings({ MMS_PORTAL_API_URL: url })).toThrow();
});
test('allows explicitly opted-in local debug HTTP', () => {
  expect(settings({ MMS_PORTAL_API_URL: 'http://10.0.2.2:3002', MMS_PORTAL_DEBUG: 'true' }).origin).toBe('http://10.0.2.2:3002');
});
