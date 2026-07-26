const initializeApp = jest.fn();
const getApps = jest.fn();
const getApp = jest.fn();
const getAuth = jest.fn();
const getRedirectResult = jest.fn();
const signInWithRedirect = jest.fn();
const signOut = jest.fn();

const providers: Array<{ kind: string; scopes: string[] }> = [];
const makeProvider = (kind: string) => {
  const provider = { kind, scopes: [] as string[], addScope(scope: string) { this.scopes.push(scope); } };
  providers.push(provider);
  return provider;
};

jest.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => initializeApp(...args),
  getApps: () => getApps(),
  getApp: () => getApp(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => getAuth(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  signOut: (...args: unknown[]) => signOut(...args),
  GoogleAuthProvider: function () { return makeProvider('google'); },
  GithubAuthProvider: function () { return makeProvider('github'); },
  OAuthProvider: function (kind: string) { return makeProvider(kind); },
}));

import {
  completeProviderSignIn,
  firebaseSignOut,
  initiateProviderSignIn,
  resetFirebaseAuthForTests,
} from 'ui/auth/firebase';

describe('Firebase Authentication SDK bridge', () => {
  const app = { name: 'app' };
  const auth = { name: 'auth' };

  beforeEach(() => {
    jest.clearAllMocks();
    providers.splice(0);
    resetFirebaseAuthForTests();
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue(app);
    getAuth.mockReturnValue(auth);
    window.history.replaceState({}, '', '/login');
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        firebase_api_key: 'api-key',
        firebase_auth_domain: 'members.example.test',
        firebase_project_id: 'makerspace',
        firebase_app_id: 'web-app',
      }),
    });
  });

  it('initializes once with the complete runtime configuration', async () => {
    await initiateProviderSignIn('google');
    await initiateProviderSignIn('github');

    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'api-key',
      authDomain: 'members.example.test',
      projectId: 'makerspace',
      appId: 'web-app',
    });
    expect(signInWithRedirect).toHaveBeenCalledTimes(2);
  });

  it('allows optional project and app metadata to be omitted', async () => {
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ firebase_api_key: 'api-key', firebase_auth_domain: 'members.example.test' }),
    });

    await initiateProviderSignIn('github');

    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'api-key',
      authDomain: 'members.example.test',
    });
  });

  it.each([
    ['google', 'google', ['email', 'profile']],
    ['github', 'github', []],
    ['apple', 'apple.com', ['email', 'name']],
    ['microsoft', 'microsoft.com', ['email', 'profile']],
  ] as const)('uses the SDK provider for %s', async (key, kind, scopes) => {
    await initiateProviderSignIn(key);

    expect(providers[0]).toMatchObject({ kind, scopes: [...scopes] });
    expect(signInWithRedirect).toHaveBeenCalledWith(auth, providers[0]);
  });

  it('starts the redirect from the application callback route', async () => {
    await initiateProviderSignIn('google');
    expect(window.location.pathname).toBe('/auth/callback');
  });

  it('restores the login URL when redirect setup fails', async () => {
    signInWithRedirect.mockRejectedValueOnce(new Error('redirect failed'));
    await expect(initiateProviderSignIn('google')).rejects.toThrow('redirect failed');
    expect(window.location.pathname).toBe('/login');
  });

  it('returns the Firebase user ID token after redirect', async () => {
    const getIdToken = jest.fn().mockResolvedValue('firebase-token');
    getRedirectResult.mockResolvedValue({ user: { getIdToken } });

    await expect(completeProviderSignIn()).resolves.toBe('firebase-token');
    expect(getRedirectResult).toHaveBeenCalledWith(auth);
  });

  it('rejects a callback that has no redirect credential', async () => {
    getRedirectResult.mockResolvedValue(null);
    await expect(completeProviderSignIn()).rejects.toThrow('No Firebase sign-in result');
  });

  it('signs out through Firebase Auth after initialization', async () => {
    await initiateProviderSignIn('google');
    await firebaseSignOut();
    expect(signOut).toHaveBeenCalledWith(auth);
  });
});
