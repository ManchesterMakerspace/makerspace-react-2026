import { captureInviteToken, clearInviteToken, hasInviteToken } from 'ui/household/inviteToken';

const go = (url: string) => window.history.pushState({}, '', url);

describe('household invite token', () => {
  beforeEach(() => {
    clearInviteToken();
    window.sessionStorage.clear();
    go('/');
  });

  it('reads the token from the URL fragment, keeps it, and takes it out of the address bar', () => {
    go('/household/join#token=abc_123-XYZ');

    expect(captureInviteToken()).toBe('abc_123-XYZ');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/household/join');
    expect(window.sessionStorage.getItem('householdInviteToken')).toBe('abc_123-XYZ');
  });

  it('gives the stored token back on later pages, such as after sign-in, when the address has no token', () => {
    go('/household/join#token=abc');
    captureInviteToken();

    go('/login?redirect=%2Fhousehold%2Fjoin');
    expect(captureInviteToken()).toBe('abc');
    go('/household/join');
    expect(captureInviteToken()).toBe('abc');
    expect(hasInviteToken()).toBe(true);
  });

  it('accepts an older link with the token in the query string, and removes it from the address bar', () => {
    go('/household/join?token=legacy&keep=1');

    expect(captureInviteToken()).toBe('legacy');
    expect(window.location.search).toBe('?keep=1');
  });

  it('a newer link replaces the stored token', () => {
    go('/household/join#token=first');
    captureInviteToken();
    go('/household/join#token=second');

    expect(captureInviteToken()).toBe('second');
  });

  it('is empty when there is no link and nothing stored, and after it is cleared', () => {
    expect(captureInviteToken()).toBe('');
    expect(hasInviteToken()).toBe(false);

    go('/household/join#token=abc');
    captureInviteToken();
    clearInviteToken();

    expect(hasInviteToken()).toBe(false);
    expect(captureInviteToken()).toBe('');
  });

  it('still works when browser storage is blocked', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      go('/household/join#token=abc');

      expect(captureInviteToken()).toBe('abc');
      go('/household/join');
      expect(captureInviteToken()).toBe('abc');
    } finally {
      spy.mockRestore();
      getSpy.mockRestore();
    }
  });
});
