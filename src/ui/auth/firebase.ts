/**
 * firebase.ts
 *
 * Firebase Authentication using the REST API only — no SDK required.
 * Avoids Node/TypeScript version incompatibilities with the Firebase npm package.
 *
 * Flow:
 *  1. fetchConfig() loads the public Firebase web configuration from Rails
 *     GET /api/config at runtime — values are never baked into the JS bundle.
 *  2. Call initiateProviderSignIn to redirect to OAuth provider
 *  3. Provider redirects back to /auth/callback
 *  4. Call completeProviderSignIn to exchange for a Firebase ID token
 *  5. POST the ID token to Rails /api/auth/firebase_login
 */

const BASE = 'https://identitytoolkit.googleapis.com/v1';

const PROVIDERS: Record<string, string> = {
  google:    'google.com',
  apple:     'apple.com',
  github:    'github.com',
  microsoft: 'microsoft.com',
};

// OAuth scopes to request per provider.
// 'profile' is required to include name fields in the Firebase ID token.
// Without this, Google only returns email — name is absent from the JWT.
const OAUTH_SCOPES: Partial<Record<ProviderKey, string>> = {
  google:    'email profile',
  apple:     'email name',
  microsoft: 'email profile',
};

export type ProviderKey = 'google' | 'apple' | 'github' | 'microsoft';

// Runtime config cache — fetched once from /api/config
interface FirebaseConfig {
  apiKey:     string;
  authDomain: string;
  projectId:  string;
  appId:      string;
}

interface ConfigResponse {
  firebase_api_key?: unknown;
  firebase_auth_domain?: unknown;
  firebase_project_id?: unknown;
  firebase_app_id?: unknown;
}

let _config: FirebaseConfig | null = null;

const fetchConfig = async (): Promise<FirebaseConfig> => {
  if (_config) return _config;

  const response = await fetch('/api/config', {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to load Firebase configuration from server.');
  }

  const data: ConfigResponse = await response.json();

  const requiredValues = [
    data.firebase_api_key,
    data.firebase_auth_domain,
    data.firebase_project_id,
    data.firebase_app_id,
  ];

  if (requiredValues.some(value => typeof value !== 'string' || value.trim() === '')) {
    throw new Error('Firebase public web configuration is incomplete.');
  }

  _config = {
    apiKey:     data.firebase_api_key as string,
    authDomain: data.firebase_auth_domain as string,
    projectId:  data.firebase_project_id as string,
    appId:      data.firebase_app_id as string,
  };

  return _config;
};

/**
 * Redirect the browser to the provider OAuth page.
 * Stores sessionId so completeProviderSignIn can finish the flow.
 */
export const initiateProviderSignIn = async (provider: ProviderKey): Promise<void> => {
  const { apiKey } = await fetchConfig();

  const continueUri = `${window.location.origin}/auth/callback`;
  const providerId  = PROVIDERS[provider];

  const response = await fetch(
    `${BASE}/accounts:createAuthUri?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        continueUri,
        ...(OAUTH_SCOPES[provider] ? { oauthScope: OAUTH_SCOPES[provider] } : {}),
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err && err.error && err.error.message) || 'Failed to initiate sign in');
  }

  const data = await response.json();
  sessionStorage.setItem('firebase_session_id', data.sessionId);
  sessionStorage.setItem('firebase_provider',   provider);
  window.location.href = data.authUri;
};

/**
 * Complete the OAuth flow after provider redirect.
 * Call from the /auth/callback route component.
 * Returns a Firebase ID token.
 */
export const completeProviderSignIn = async (): Promise<string> => {
  const { apiKey } = await fetchConfig();

  const requestUri = window.location.href;
  const sessionId  = sessionStorage.getItem('firebase_session_id');

  if (!sessionId) {
    throw new Error('No Firebase session found. Please try signing in again.');
  }

  sessionStorage.removeItem('firebase_session_id');
  sessionStorage.removeItem('firebase_provider');

  const response = await fetch(
    `${BASE}/accounts:signInWithIdp?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri,
        sessionId,
        returnIdpCredential: true,
        returnSecureToken:   true,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err && err.error && err.error.message) || 'Sign in failed');
  }

  const data = await response.json();
  return data.idToken;
};

// Convenience wrappers
export const signInWithGoogle    = () => initiateProviderSignIn('google');
export const signInWithApple     = () => initiateProviderSignIn('apple');
export const signInWithGitHub    = () => initiateProviderSignIn('github');
export const signInWithMicrosoft = () => initiateProviderSignIn('microsoft');

export const firebaseSignOut = async (): Promise<void> => {
  sessionStorage.removeItem('firebase_session_id');
  sessionStorage.removeItem('firebase_provider');
};
