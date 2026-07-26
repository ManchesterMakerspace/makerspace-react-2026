const initializeApp = jest.fn();
const getApps = jest.fn();
const getApp = jest.fn();
const getAuth = jest.fn();
const getRedirectResult = jest.fn();
const signInWithRedirect = jest.fn();
const signOut = jest.fn();
const addGoogleScope = jest.fn();

jest.mock('firebase/app', () => ({ initializeApp, getApps, getApp }));
jest.mock('firebase/auth', () => ({
  getAuth,
  getRedirectResult,
  signInWithRedirect,
  signOut,
  GoogleAuthProvider: jest.fn(() => ({ addScope: addGoogleScope })),
  GithubAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
}));

const runtimeConfig = {
  firebase_api_key: 'api-key',
  firebase_project_id: 'project-id',
  firebase_auth_domain: 'login.example.test',
};

describe('Firebase SDK authentication bridge', () => {
  const app = { name: 'app' };
  const authStateReady = jest.fn();
  const auth = { authStateReady };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    sessionStorage.clear();
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue(app);
    getAuth.mockReturnValue(auth);
    authStateReady.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
    getRedirectResult.mockResolvedValue({
      user: { getIdToken: jest.fn().mockResolvedValue('firebase-token') },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(runtimeConfig),
    } as unknown as Response);
  });

  it('initializes the modular SDK with the runtime auth domain and returns its token', async () => {
    sessionStorage.setItem('firebase_pending_provider', 'google');
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).resolves.toBe('firebase-token');
    expect(fetch).toHaveBeenCalledWith('/api/config', expect.any(Object));
    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'api-key',
      projectId: 'project-id',
      authDomain: 'login.example.test',
    });
    expect(getRedirectResult).toHaveBeenCalledWith(auth);
    expect(sessionStorage.getItem('firebase_pending_provider')).toBeNull();
  });

  it('clears a rejected initializer so a later attempt can retry', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => runtimeConfig });
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).rejects.toThrow('offline');
    await expect(completeProviderSignIn()).resolves.toBe('firebase-token');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('restores persisted auth state before signing out', async () => {
    const { firebaseSignOut } = await import('ui/auth/firebase');
    const calls: string[] = [];
    authStateReady.mockImplementation(async () => { calls.push('ready'); });
    signOut.mockImplementation(async () => { calls.push('sign-out'); });

    await firebaseSignOut();

    expect(calls).toEqual(['ready', 'sign-out']);
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('starts the SDK redirect from the callback for the staged provider', async () => {
    getRedirectResult.mockResolvedValue(null);
    signInWithRedirect.mockResolvedValue(undefined);
    sessionStorage.setItem('firebase_pending_provider', 'google');
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).rejects.toThrow('redirect did not start');

    expect(addGoogleScope).toHaveBeenCalledWith('email');
    expect(addGoogleScope).toHaveBeenCalledWith('profile');
    expect(signInWithRedirect).toHaveBeenCalledWith(auth, expect.any(Object));
    expect(sessionStorage.getItem('firebase_pending_provider')).toBe('google');
  });

  it('rejects runtime configuration that omits authDomain', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...runtimeConfig, firebase_auth_domain: undefined }),
    });
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).rejects.toThrow('FIREBASE_AUTH_DOMAIN');
  });
});
