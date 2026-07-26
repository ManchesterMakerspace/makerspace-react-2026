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
  signInWithRedirect,
  signOut,
} from 'firebase/auth';

export type ProviderKey = 'google' | 'apple' | 'github' | 'microsoft';

interface RuntimeConfigResponse {
  firebase_api_key?: unknown;
  firebase_project_id?: unknown;
  firebase_auth_domain?: unknown;
}

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
}

const PENDING_PROVIDER_KEY = 'firebase_pending_provider';
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
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return { app, auth: getAuth(app) };
  })();

  // A transient config/network error must not poison all subsequent attempts.
  initializer.catch(() => {
    initializer = undefined;
  });
  return initializer;
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

/**
 * Stage the provider and move to the callback before starting Firebase's
 * redirect. Firebase therefore uses /auth/callback as its continuation URI.
 */
export const initiateProviderSignIn = async (provider: ProviderKey): Promise<void> => {
  await initializeFirebase();
  sessionStorage.setItem(PENDING_PROVIDER_KEY, provider);
  window.location.assign('/auth/callback');
};

/** Finish a Firebase redirect, returning the SDK-issued ID token. */
export const completeProviderSignIn = async (): Promise<string> => {
  const { auth } = await initializeFirebase();
  const result = await getRedirectResult(auth);
  if (result) return result.user.getIdToken();

  const pendingProvider = sessionStorage.getItem(PENDING_PROVIDER_KEY) as ProviderKey | null;
  if (!pendingProvider || !['google', 'apple', 'github', 'microsoft'].includes(pendingProvider)) {
    throw new Error('No Firebase sign-in redirect found. Please try signing in again.');
  }

  sessionStorage.removeItem(PENDING_PROVIDER_KEY);
  await signInWithRedirect(auth, providerFor(pendingProvider));
  throw new Error('Firebase sign-in redirect did not start. Please try again.');
};

export const signInWithGoogle = () => initiateProviderSignIn('google');
export const signInWithApple = () => initiateProviderSignIn('apple');
export const signInWithGitHub = () => initiateProviderSignIn('github');
export const signInWithMicrosoft = () => initiateProviderSignIn('microsoft');

export const firebaseSignOut = async (): Promise<void> => {
  sessionStorage.removeItem(PENDING_PROVIDER_KEY);
  const { auth } = await initializeFirebase();
  // Ensure persisted credentials have been restored before attempting logout.
  await auth.authStateReady();
  await signOut(auth);
};
