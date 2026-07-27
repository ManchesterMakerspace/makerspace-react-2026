/** Firebase Authentication bridge backed by the official modular SDK. */
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  AuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';

export type ProviderKey = 'google' | 'apple' | 'github' | 'microsoft';

interface RuntimeConfigResponse {
  firebase_api_key?: unknown;
  firebase_project_id?: unknown;
  firebase_auth_domain?: unknown;
  firebase_auth_type?: unknown;
}

type FirebaseAuthType = 'popup' | 'redirect';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  authType: FirebaseAuthType;
}

const PENDING_PROVIDER_KEY = 'firebase_pending_provider';
const REDIRECT_STARTED_KEY = 'firebase_redirect_started';
let initializer: Promise<FirebaseServices> | undefined;

const requiredString = (value: unknown, setting: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Firebase is not configured. Set ${setting} in your environment.`);
  }
  return value;
};

const initializeFirebase = (): Promise<FirebaseServices> => {
  if (initializer) return initializer;

  initializer = (async () => {
    const response = await fetch('/api/config', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to load Firebase configuration from server.');
    }

    const config = await response.json() as RuntimeConfigResponse;
    const firebaseConfig = {
      apiKey: requiredString(config.firebase_api_key, 'FIREBASE_API_KEY'),
      projectId: requiredString(config.firebase_project_id, 'FIREBASE_PROJECT_ID'),
      authDomain: requiredString(config.firebase_auth_domain, 'FIREBASE_AUTH_DOMAIN'),
    };
    const authType: FirebaseAuthType = ['popup', 'signInWithPopup'].includes(String(config.firebase_auth_type))
      ? 'popup'
      : 'redirect';
    console.info('[Firebase Auth] Configuration loaded', {
      authType,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return { app, auth: getAuth(app), authType };
  })();

  // A transient config/network error must not poison all subsequent attempts.
  initializer.catch(() => {
    initializer = undefined;
  });
  return initializer;
};

/** Load runtime configuration and initialize the SDK before a provider button is clicked. */
export const preloadFirebaseAuth = async (): Promise<void> => {
  console.info('[Firebase Auth] Preloading Firebase services');
  await initializeFirebase();
  console.info('[Firebase Auth] Firebase services ready for provider authentication');
};

const providerFor = (provider: ProviderKey): AuthProvider => {
  switch (provider) {
    case 'google': {
      const google = new GoogleAuthProvider();
      google.addScope('profile');
      google.addScope('email');
      return google;
    }
    case 'github':
      return new GithubAuthProvider();
    case 'apple': {
      const apple = new OAuthProvider('apple.com');
      apple.addScope('email');
      apple.addScope('name');
      return apple;
    }
    case 'microsoft': {
      const microsoft = new OAuthProvider('microsoft.com');
      microsoft.addScope('email');
      microsoft.addScope('profile');
      return microsoft;
    }
  }
};

/** Start the configured popup flow, or stage the provider for the redirect callback. */
export const initiateProviderSignIn = async (provider: ProviderKey): Promise<void | string> => {
  const { auth, authType } = await initializeFirebase();
  console.info('[Firebase Auth] Starting provider authentication', { provider, authType });

  if (authType === 'popup') {
    console.info('[Firebase Auth] Opening provider popup', { provider });
    const result = await signInWithPopup(auth, providerFor(provider));
    console.info('[Firebase Auth] Provider popup completed', { provider, hasUser: !!result.user });
    const idToken = await result.user.getIdToken();
    console.info('[Firebase Auth] Popup ID token acquired', { provider });
    return idToken;
  }

  sessionStorage.setItem(PENDING_PROVIDER_KEY, provider);
  sessionStorage.removeItem(REDIRECT_STARTED_KEY);
  console.info('[Firebase Auth] Provider staged for redirect callback', { provider });
  window.location.assign('/auth/callback');
};

/** Finish a Firebase redirect, returning the SDK-issued ID token. */
export const completeProviderSignIn = async (): Promise<string> => {
  const { auth } = await initializeFirebase();
  const pendingProvider = sessionStorage.getItem(PENDING_PROVIDER_KEY) as ProviderKey | null;
  const redirectStarted = sessionStorage.getItem(REDIRECT_STARTED_KEY) === 'true';
  console.info('[Firebase Auth] Checking redirect result', { pendingProvider, redirectStarted });
  const result = await getRedirectResult(auth);
  if (result) {
    console.info('[Firebase Auth] Redirect credential received', { pendingProvider, hasUser: !!result.user });
    const idToken = await result.user.getIdToken();
    sessionStorage.removeItem(PENDING_PROVIDER_KEY);
    sessionStorage.removeItem(REDIRECT_STARTED_KEY);
    console.info('[Firebase Auth] Redirect ID token acquired', { pendingProvider });
    return idToken;
  }

  console.info('[Firebase Auth] No redirect credential returned', { pendingProvider, redirectStarted });
  if (!pendingProvider || !['google', 'apple', 'github', 'microsoft'].includes(pendingProvider)) {
    throw new Error('No Firebase sign-in redirect found. Please try signing in again.');
  }

  if (redirectStarted) {
    console.error('[Firebase Auth] Redirect returned without a credential', { pendingProvider });
    sessionStorage.removeItem(PENDING_PROVIDER_KEY);
    sessionStorage.removeItem(REDIRECT_STARTED_KEY);
    throw new Error('Firebase sign-in returned without a credential. Please try signing in again.');
  }

  sessionStorage.setItem(REDIRECT_STARTED_KEY, 'true');
  console.info('[Firebase Auth] Sending browser to Firebase provider', { pendingProvider });
  await signInWithRedirect(auth, providerFor(pendingProvider));
  throw new Error('Firebase sign-in redirect did not start. Please try again.');
};

export const signInWithGoogle = () => initiateProviderSignIn('google');
export const signInWithApple = () => initiateProviderSignIn('apple');
export const signInWithGitHub = () => initiateProviderSignIn('github');
export const signInWithMicrosoft = () => initiateProviderSignIn('microsoft');

export const firebaseSignOut = async (): Promise<void> => {
  sessionStorage.removeItem(PENDING_PROVIDER_KEY);
  sessionStorage.removeItem(REDIRECT_STARTED_KEY);
  const { auth } = await initializeFirebase();
  // Ensure persisted credentials have been restored before attempting logout.
  await auth.authStateReady();
  await signOut(auth);
};
