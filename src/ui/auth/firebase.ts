/**
 * Firebase Authentication using the modular Firebase SDK.
 *
 * Firebase configuration is loaded from Rails at runtime so it is not baked
 * into the JavaScript bundle. After Firebase completes a provider redirect,
 * its ID token is exchanged by Rails for the application's cookie-backed
 * session.
 */

import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  AuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  UserCredential,
  getAuth,
  getRedirectResult,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';

export type ProviderKey = 'google' | 'apple' | 'github' | 'microsoft';

interface FirebaseConfig {
  apiKey: string;
  projectId: string;
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseInitialization: Promise<Auth> | null = null;

const fetchConfig = async (): Promise<FirebaseConfig> => {
  const response = await fetch('/api/config', {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to load Firebase configuration from server.');
  }

  const data = await response.json();

  if (!data.firebase_api_key) {
    throw new Error('Firebase is not configured. Set FIREBASE_API_KEY in your environment.');
  }

  return {
    apiKey: data.firebase_api_key,
    projectId: data.firebase_project_id,
  };
};

const initializeFirebaseAuth = async (): Promise<Auth> => {
  if (firebaseAuth) return firebaseAuth;

  if (!firebaseInitialization) {
    firebaseInitialization = fetchConfig().then((config) => {
      firebaseApp = initializeApp(config);
      firebaseAuth = getAuth(firebaseApp);
      return firebaseAuth;
    });
  }

  return firebaseInitialization;
};

const providerFactories: Record<ProviderKey, () => AuthProvider> = {
  google: () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return provider;
  },
  github: () => {
    const provider = new GithubAuthProvider();
    provider.addScope('user:email');
    return provider;
  },
  apple: () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return provider;
  },
  microsoft: () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.addScope('email');
    provider.addScope('profile');
    return provider;
  },
};

export const initiateProviderSignIn = async (provider: ProviderKey): Promise<void> => {
  const auth = await initializeFirebaseAuth();
  await signInWithRedirect(auth, providerFactories[provider]());
};

/** Complete the provider redirect and return its Firebase ID token. */
export const completeProviderSignIn = async (): Promise<string> => {
  const auth = await initializeFirebaseAuth();
  const credential: UserCredential | null = await getRedirectResult(auth);

  if (!credential) {
    throw new Error('No Firebase sign-in result was returned. Please try signing in again.');
  }

  return credential.user.getIdToken();
};

export const signInWithGoogle = (): Promise<void> => initiateProviderSignIn('google');
export const signInWithApple = (): Promise<void> => initiateProviderSignIn('apple');
export const signInWithGitHub = (): Promise<void> => initiateProviderSignIn('github');
export const signInWithMicrosoft = (): Promise<void> => initiateProviderSignIn('microsoft');

export const firebaseSignOut = async (): Promise<void> => {
  const auth = await initializeFirebaseAuth();
  await signOut(auth);
};
