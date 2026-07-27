/**
 * globalAuthInterceptor.ts
 *
 * Registers a global axios response interceptor that handles 401 responses.
 * Call setupGlobalAuthInterceptor(dispatch) once on app boot from App.tsx.
 */
import axios, { AxiosInstance } from 'axios';
import { Routing } from 'app/constants';

const RESET_TRANSACTIONS = 'reset';
const LOGOUT_SUCCESS = 'AUTH/LOGOUT';

let axiosInterceptorRegistered = false;
let fetchInterceptorRegistered = false;
let globalDispatch: Function | null = null;

const FIREBASE_CALLBACK_PATH = '/auth/callback';
const publicPaths = [Routing.Login, Routing.SignUp, Routing.PasswordReset, FIREBASE_CALLBACK_PATH];

// A 401 is an expected, locally handled result while establishing a session.
// Treating it as an expired session interrupts OAuth callbacks (App's session
// restore runs at the same time) and hides useful login errors from the form.
const sessionEstablishmentPaths = [
  '/api/members/sign_in',
  '/api/auth/firebase_login',
];

export const shouldRedirectToLogin = (pathname: string): boolean =>
  pathname !== Routing.Root
  && !publicPaths.some(path => pathname.startsWith(path));

const isApiRequest = (input: RequestInfo | URL): boolean => {
  if (typeof window === 'undefined') return false;

  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const url = new URL(rawUrl, window.location.origin);

  return url.origin === window.location.origin && url.pathname.startsWith('/api/');
};

const isSessionEstablishmentRequest = (input: RequestInfo | URL | undefined): boolean => {
  if (!input || typeof window === 'undefined') return false;

  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const url = new URL(rawUrl, window.location.origin);

  return url.origin === window.location.origin
    && sessionEstablishmentPaths.includes(url.pathname);
};

const shouldSuppressSessionEstablishment401 = (
  input: RequestInfo | URL | undefined
): boolean => {
  if (!isSessionEstablishmentRequest(input)) return false;

  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input!.url;
  const requestPath = new URL(rawUrl, window.location.origin).pathname;

  // Firebase login reports its failure to the callback. Session restoration is
  // only an expected 401 on a public page; on a protected deep link the global
  // handler must still send the visitor to the login screen.
  return requestPath === '/api/auth/firebase_login'
    || !shouldRedirectToLogin(window.location.pathname);
};

const handle401 = (dispatch: Function | null = globalDispatch) => {
  if (dispatch) {
    dispatch({ type: RESET_TRANSACTIONS });
    dispatch({ type: LOGOUT_SUCCESS });
  }

  const currentPath = window.location.pathname;

  if (shouldRedirectToLogin(currentPath)) {
    window.location.href = Routing.Login;
  }
};

const interceptAxiosError = (error: any) => {
  if (
    error?.response?.status === 401
    && !shouldSuppressSessionEstablishment401(error?.config?.url)
  ) {
    handle401();
  }
  return Promise.reject(error);
};

export const attachGlobalAuthInterceptor = <T extends AxiosInstance>(api: T): T => {
  api.interceptors.response.use(
    response => response,
    interceptAxiosError
  );
  return api;
};

export const setupGlobalAuthInterceptor = (dispatch: Function): void => {
  globalDispatch = dispatch;

  if (!axiosInterceptorRegistered) {
    axiosInterceptorRegistered = true;
    attachGlobalAuthInterceptor(axios);
  }

  if (!fetchInterceptorRegistered && typeof window.fetch === 'function') {
    fetchInterceptorRegistered = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const response = await originalFetch(...args);
      if (
        response.status === 401
        && isApiRequest(args[0])
        && !shouldSuppressSessionEstablishment401(args[0])
      ) {
        handle401();
      }
      return response;
    };
  }
};

/**
 * handle401IfNeeded
 * Used by useReadTransaction and useWriteTransaction for api-client responses
 * that return error objects rather than throwing.
 * Returns true if a 401 was detected and handled.
 */
export const setGlobalDispatch = (dispatch: Function): void => {
  globalDispatch = dispatch;
};

export const handle401IfNeeded = (response: any): boolean => {
  const status = response?.response?.status ?? response?.status;
  if (status === 401) {
    handle401();
    return true;
  }
  return false;
};
