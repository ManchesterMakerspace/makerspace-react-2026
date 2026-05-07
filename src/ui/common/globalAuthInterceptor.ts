/**
 * globalAuthInterceptor.ts
 *
 * Registers a global axios response interceptor that handles 401 responses
 * from ANY axios instance by dispatching logout and redirecting to login.
 *
 * Call setupGlobalAuthInterceptor(store, history) once on app boot.
 */
import axios from 'axios';
import { Store } from 'redux';
import { History } from 'history';
import { AuthAction } from 'ui/reducer';
import { TransactionAction } from 'ui/reducer';
import { Routing } from 'app/constants';

let interceptorRegistered = false;

export const setupGlobalAuthInterceptor = (store: Store, history: History): void => {
  if (interceptorRegistered) return;
  interceptorRegistered = true;

  axios.interceptors.response.use(
    response => response,
    error => {
      if (error?.response?.status === 401) {
        // Clear all Redux state
        store.dispatch({ type: TransactionAction.Reset });
        store.dispatch({ type: AuthAction.LogoutSuccess });

        // Redirect to login — preserve the current path so we can redirect back after login
        const currentPath = window.location.pathname;
        const isPublicPath = [Routing.Login, Routing.SignUp, Routing.PasswordReset]
          .some(p => currentPath.startsWith(p));

        if (!isPublicPath) {
          history.replace(Routing.Login);
        }
      }
      return Promise.reject(error);
    }
  );
};

/**
 * handle401IfNeeded
 *
 * Used by useReadTransaction and useWriteTransaction to handle 401 responses
 * from the makerspace-ts-api-client (which returns error objects rather than throwing).
 * Returns true if a 401 was detected and handled (caller should bail out).
 */
export const handle401IfNeeded = (response: any): boolean => {
  const status = response?.response?.status;
  if (status === 401) {
    const store = getStore();
    store.dispatch({ type: TransactionAction.Reset });
    store.dispatch({ type: AuthAction.LogoutSuccess });

    const currentPath = window.location.pathname;
    const isPublicPath = [Routing.Login, Routing.SignUp, Routing.PasswordReset]
      .some(p => currentPath.startsWith(p));

    if (!isPublicPath) {
      window.location.href = Routing.Login;
    }
    return true;
  }
  return false;
};
