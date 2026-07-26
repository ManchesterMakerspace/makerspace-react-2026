import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
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

interface RuntimeFirebaseConfig {
  firebase_api_key?: string;
  firebase_auth_domain?: string;
  firebase_project_id?: string;
  firebase_app_id?: string;
}

let authPromise: Promise<Auth> | undefined;

const loadFirebaseOptions = async (): Promise<FirebaseOptions> => {
  const response = await fetch('/api/config', {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to load Firebase configuration from server.');
  }

  const config = await response.json() as RuntimeFirebaseConfig;
  if (!config.firebase_api_key || !config.firebase_auth_domain) {
    throw new Error(
      'Firebase is not configured. Set FIREBASE_API_KEY and FIREBASE_AUTH_DOMAIN in your environment.'
    );
  }

  // projectId and appId are useful Firebase metadata but are not required by
  // the Authentication SDK. Keep deployments with the minimal Auth config valid.
  return {
    apiKey: config.firebase_api_key,
    authDomain: config.firebase_auth_domain,
    ...(config.firebase_project_id ? { projectId: config.firebase_project_id } : {}),
    ...(config.firebase_app_id ? { appId: config.firebase_app_id } : {}),
  };
};

const initializeFirebaseAuth = async (): Promise<Auth> => {
  const options = await loadFirebaseOptions();
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(options);
  return getAuth(app);
};

export const getFirebaseAuth = (): Promise<Auth> => {
  if (!authPromise) authPromise = initializeFirebaseAuth();
  return authPromise;
};

const providerFor = (provider: ProviderKey): AuthProvider => {
  switch (provider) {
    case 'google': {
      const google = new GoogleAuthProvider();
      google.addScope('email');
      google.addScope('profile');
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

export const initiateProviderSignIn = async (provider: ProviderKey): Promise<void> => {
  const auth = await getFirebaseAuth();
  const originalUrl = window.location.href;

  // Firebase returns a redirect sign-in to the URL that initiated it. Move to
  // the public callback route first so it can exchange the resulting ID token
  // for the application's cookie-backed session.
  window.history.replaceState(window.history.state, '', '/auth/callback');
  try {
    await signInWithRedirect(auth, providerFor(provider));
  } catch (error) {
    window.history.replaceState(window.history.state, '', originalUrl);
    throw error;
  }
};

export const completeProviderSignIn = async (): Promise<string> => {
  const auth = await getFirebaseAuth();
  const credential = await getRedirectResult(auth);
  if (!credential) {
    throw new Error('No Firebase sign-in result was found. Please try signing in again.');
  }
  return credential.user.getIdToken();
};

export const signInWithGoogle = () => initiateProviderSignIn('google');
export const signInWithApple = () => initiateProviderSignIn('apple');
export const signInWithGitHub = () => initiateProviderSignIn('github');
export const signInWithMicrosoft = () => initiateProviderSignIn('microsoft');

export const firebaseSignOut = async (): Promise<void> => {
  if (!authPromise && !getApps().length) return;
  await signOut(await getFirebaseAuth());
};

// Test-only reset for the cached asynchronous singleton.
export const resetFirebaseAuthForTests = (): void => {
  authPromise = undefined;
};
