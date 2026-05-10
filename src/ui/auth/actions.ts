import { ThunkAction, ThunkDispatch } from "redux-thunk";
import { AnyAction } from "redux";

import { AuthState, AuthForm, SignUpForm, AuthMember } from "ui/auth/interfaces";
import { Action as AuthAction } from "ui/auth/constants";
import { TransactionAction } from "ui/reducer";
import { memberIsAdmin, memberIsBoardMember, memberIsResourceManager } from "ui/member/utils";
import {
  signIn,
  listMembersPermissions,
  Member,
  signOut,
  registerMember,
  isApiErrorResponse,
  ApiErrorResponse,
  ApiDataResponse
} from "makerspace-ts-api-client";
import { firebaseSignOut } from "ui/auth/firebase";
import { CartAction } from "../checkout/cart";

const handleAuthWithPermissions = async (
  response: ApiErrorResponse | ApiDataResponse<Member>,
  dispatch: ThunkDispatch<{}, {}, AnyAction>,
  ignoreError: boolean = false
) => {
  if (isApiErrorResponse(response)) {
    dispatch({
      type: AuthAction.AuthUserFailure,
      error: ignoreError ? undefined : response.error.message
    });
  } else {
    const member = response.data;
    const permissionsResponse = await listMembersPermissions({ id: member.id });

    if (isApiErrorResponse(permissionsResponse)) {
      dispatch({
        type: AuthAction.AuthUserFailure,
        error: permissionsResponse.error.message
      });
    } else {
      const permissions = permissionsResponse.data;

      dispatch({
        type: AuthAction.AuthUserSuccess,
        data: {
          member,
          permissions
        }
      });
    }
  }
}

export const loginUserAction = (
  loginForm?: AuthForm
): ThunkAction<Promise<void>, {}, {}, AnyAction>  => async (dispatch) => {
  dispatch({ type: AuthAction.StartAuthRequest });

  if (!loginForm) {
    // Session restore — use raw fetch so we can detect totp_enrollment_required
    const res = await fetch('/api/members/sign_in', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': (() => {
          const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
          return match ? decodeURIComponent(match[1]) : '';
        })(),
      },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const member = await res.json();
      if (member.totp_enrollment_required) {
        const permissionsResponse = await listMembersPermissions({ id: member.id });
        if (isApiErrorResponse(permissionsResponse)) {
          dispatch({ type: AuthAction.AuthUserFailure, error: undefined });
        } else {
          dispatch({
            type: AuthAction.AuthUserSuccess,
            data: { member, permissions: permissionsResponse.data }
          });
          dispatch({ type: AuthAction.TotpEnrollmentRequired });
        }
      } else {
        await handleAuthWithPermissions(
          { data: member, response: res } as any,
          dispatch,
          true
        );
      }
    } else {
      // Not signed in — silently fail (expected on fresh load)
      dispatch({ type: AuthAction.AuthUserFailure, error: undefined });
    }
    return;
  }

  // Use raw fetch so we can inspect 202 totp_required responses
  const res = await fetch('/api/members/sign_in', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': (() => {
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
      })(),
    },
    body: JSON.stringify({ member: loginForm }),
  });

  if (res.status === 202) {
    // TOTP code required — stay on login page, show code entry
    dispatch({ type: AuthAction.TotpRequired });
    return;
  }

  if (res.ok) {
    const member = await res.json();
    if (member.totp_enrollment_required) {
      const permissionsResponse = await listMembersPermissions({ id: member.id });
      if (isApiErrorResponse(permissionsResponse)) {
        dispatch({ type: AuthAction.AuthUserFailure, error: permissionsResponse.error.message });
      } else {
        dispatch({
          type: AuthAction.AuthUserSuccess,
          data: { member, permissions: permissionsResponse.data }
        });
        dispatch({ type: AuthAction.TotpEnrollmentRequired });
      }
    } else {
      await handleAuthWithPermissions(
        { data: member, response: res } as any,
        dispatch
      );
    }
  } else {
    const body = await res.json().catch(() => ({}));
    dispatch({ type: AuthAction.AuthUserFailure, error: body?.error?.message || 'Invalid email or password.' });
  }
}

export const sessionLoginUserAction = (): ThunkAction<Promise<void>, {}, {}, AnyAction> => async (dispatch) => {
  // Delegate to loginUserAction (no form = session restore path) so that
  // totp_enrollment_required is handled consistently everywhere.
  await dispatch(loginUserAction());
}

export const refreshUserAction = sessionLoginUserAction;

export const logoutUserAction = (
): ThunkAction<Promise<void>, {}, {}, AnyAction> => async (dispatch) => {
  dispatch({ type: AuthAction.StartAuthRequest });
  await signOut();
  await firebaseSignOut().catch(() => {}); // Sign out of Firebase too (no-op if not signed in)
  dispatch({ type: TransactionAction.Reset });
  dispatch({ type: CartAction.EmptyCart });
  dispatch({ type: AuthAction.LogoutSuccess });
}

export const firebaseLoginAction = (
  idToken: string
): ThunkAction<Promise<void>, {}, {}, AnyAction> => async (dispatch) => {
  dispatch({ type: AuthAction.StartAuthRequest });

  const response = await fetch('/api/auth/firebase_login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': (() => {
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
      })(),
    },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (response.ok) {
    const member = await response.json();
    await handleAuthWithPermissions(
      { data: member, response } as any,
      dispatch
    );
  } else {
    const body = await response.json().catch(() => ({}));
    dispatch({
      type: AuthAction.AuthUserFailure,
      error: body?.message || 'Firebase login failed. Please try again.',
    });
  }
};

export const totpLoginSuccessAction = (
  member: any
): ThunkAction<Promise<void>, {}, {}, AnyAction> => async (dispatch) => {
  // Member is already authenticated server-side via totp_sessions.
  // Just fetch permissions and dispatch AuthUserSuccess directly.
  const permissionsResponse = await listMembersPermissions({ id: member.id });
  if (isApiErrorResponse(permissionsResponse)) {
    dispatch({ type: AuthAction.AuthUserFailure, error: permissionsResponse.error.message });
  } else {
    dispatch({
      type: AuthAction.AuthUserSuccess,
      data: { member, permissions: permissionsResponse.data }
    });
  }
};

export const submitSignUpAction = (
  signUpForm: SignUpForm
): ThunkAction<Promise<void>, {}, {}, AnyAction> => async (dispatch) => {
  dispatch({ type: AuthAction.StartAuthRequest });

  const response = await registerMember({ body: signUpForm });
  await handleAuthWithPermissions(response, dispatch);
}

const defaultState: AuthState = {
  totpRequired: false,
  totpEnrollmentRequired: false,
  currentUser: {
    id: undefined,
    firstname: undefined,
    lastname: undefined,
    email: undefined,
    expirationTime: undefined,
    isAdmin: false,
    isBoardMember: false,
    isResourceManager: false,
  } as AuthMember,
  permissions: {},
  isRequesting: false,
  error: ""
}

export const authReducer = (state: AuthState = defaultState, action: AnyAction) => {
  switch (action.type) {
    case AuthAction.StartAuthRequest:
      return {
        ...state,
        isRequesting: true
      };
    case AuthAction.AuthUserSuccess:
      const { data: {
        member,
        permissions
      } } = action;
      return {
        ...state,
        currentUser: {
          ...member,
          isAdmin: memberIsAdmin(member),
          isBoardMember: memberIsBoardMember(member),
          isResourceManager: memberIsResourceManager(member),
          totpEnabled: !!(member as any).totp_enabled,
        },
        permissions,
        isRequesting: false,
        totpRequired: false,
        totpEnrollmentRequired: false,
        error: ""
      };
    case AuthAction.AuthUserFailure:
      const { error } = action;
      return {
        ...state,
        isRequesting: false,
        error
      }
    case AuthAction.TotpRequired:
      return {
        ...state,
        isRequesting: false,
        totpRequired: true,
        error: ''
      };
    case AuthAction.ClearTotpRequired:
      return {
        ...state,
        isRequesting: false,
        totpRequired: false,
        error: ''
      };
    case AuthAction.TotpEnrollmentRequired:
      return {
        ...state,
        totpEnrollmentRequired: true,
      };
    case AuthAction.LogoutSuccess:
      return {
        ...defaultState
      }
    default:
      return state;
  }
}
