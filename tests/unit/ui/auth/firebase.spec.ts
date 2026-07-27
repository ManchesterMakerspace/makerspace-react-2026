const initializeApp = jest.fn();
const getApps = jest.fn();
const getApp = jest.fn();
const getAuth = jest.fn();
const getRedirectResult = jest.fn();
const signInWithPopup = jest.fn();
const signInWithRedirect = jest.fn();
const signOut = jest.fn();
const addGoogleScope = jest.fn();

jest.mock('firebase/app', () => ({ initializeApp, getApps, getApp }));
jest.mock('firebase/auth', () => ({
  getAuth,
  getRedirectResult,
  signInWithPopup,
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
  const auth: { authStateReady: jest.Mock; currentUser: null | { getIdToken: jest.Mock } } = {
    authStateReady,
    currentUser: null,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    sessionStorage.clear();
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue(app);
    getAuth.mockReturnValue(auth);
    auth.currentUser = null;
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

  it('initializes Firebase and preserves redirect state after returning its token', async () => {
    sessionStorage.setItem('firebase_pending_provider', 'google');
    sessionStorage.setItem('firebase_redirect_started', 'true');
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).resolves.toBe('firebase-token');
    expect(fetch).toHaveBeenCalledWith('/api/config', expect.any(Object));
    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'api-key',
      projectId: 'project-id',
      authDomain: 'login.example.test',
    });
    expect(getRedirectResult).toHaveBeenCalledWith(auth);
    expect(sessionStorage.getItem('firebase_pending_provider')).toBe('google');
    expect(sessionStorage.getItem('firebase_redirect_started')).toBe('true');
  });

  it('preserves redirect markers when acquiring the ID token fails', async () => {
    const getIdToken = jest.fn().mockRejectedValue(new Error('token refresh failed'));
    getRedirectResult.mockResolvedValue({ user: { getIdToken } });
    sessionStorage.setItem('firebase_pending_provider', 'google');
    sessionStorage.setItem('firebase_redirect_started', 'true');
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).rejects.toThrow('token refresh failed');

    expect(sessionStorage.getItem('firebase_pending_provider')).toBe('google');
    expect(sessionStorage.getItem('firebase_redirect_started')).toBe('true');
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
    expect(sessionStorage.getItem('firebase_redirect_started')).toBe('true');
  });

  it('recovers the token from restored auth after the redirect credential was consumed', async () => {
    const getIdToken = jest.fn()
      .mockRejectedValueOnce(new Error('token refresh failed'))
      .mockResolvedValueOnce('restored-token');
    auth.currentUser = { getIdToken };
    getRedirectResult
      .mockResolvedValueOnce({ user: auth.currentUser })
      .mockResolvedValueOnce(null);
    sessionStorage.setItem('firebase_pending_provider', 'google');
    sessionStorage.setItem('firebase_redirect_started', 'true');
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).rejects.toThrow('token refresh failed');
    expect(sessionStorage.getItem('firebase_pending_provider')).toBe('google');
    expect(sessionStorage.getItem('firebase_redirect_started')).toBe('true');

    await expect(completeProviderSignIn()).resolves.toBe('restored-token');

    expect(authStateReady).toHaveBeenCalled();
    expect(getIdToken).toHaveBeenCalledTimes(2);
    expect(signInWithRedirect).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('firebase_pending_provider')).toBe('google');
    expect(sessionStorage.getItem('firebase_redirect_started')).toBe('true');
  });

  it('clears redirect markers only when explicitly finalized after server login', async () => {
    sessionStorage.setItem('firebase_pending_provider', 'google');
    sessionStorage.setItem('firebase_redirect_started', 'true');
    const { clearProviderSignInState } = await import('ui/auth/firebase');

    clearProviderSignInState();

    expect(sessionStorage.getItem('firebase_pending_provider')).toBeNull();
    expect(sessionStorage.getItem('firebase_redirect_started')).toBeNull();
  });

  it('does not restart a redirect when no credential or restored user exists', async () => {
    getRedirectResult.mockResolvedValue(null);
    sessionStorage.setItem('firebase_pending_provider', 'google');
    sessionStorage.setItem('firebase_redirect_started', 'true');
    const { completeProviderSignIn } = await import('ui/auth/firebase');

    await expect(completeProviderSignIn()).rejects.toThrow('returned without a credential');

    expect(signInWithRedirect).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('firebase_pending_provider')).toBeNull();
    expect(sessionStorage.getItem('firebase_redirect_started')).toBeNull();
  });

  it('uses popup authentication when configured and returns its token', async () => {
    const getIdToken = jest.fn().mockResolvedValue('popup-token');
    signInWithPopup.mockResolvedValue({ user: { getIdToken } });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...runtimeConfig, firebase_auth_type: 'signInWithPopup' }),
    });
    const { preloadFirebaseAuth, signInWithGoogle } = await import('ui/auth/firebase');

    await preloadFirebaseAuth();

    await expect(signInWithGoogle()).resolves.toBe('popup-token');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.any(Object));
    expect(signInWithRedirect).not.toHaveBeenCalled();
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
