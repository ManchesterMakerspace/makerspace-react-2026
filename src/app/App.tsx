// @ts-nocheck
import { checkoutDestination } from "ui/auth/checkoutDestination";
import { platform, NATIVE_PENDING_PATH, safePendingPath, navigatePortal } from 'app/platform';
import * as React from 'react';
import { useNavigate, useLocation} from 'react-router-dom';
import { useDispatch } from "react-redux";

import { sessionLoginUserAction } from "ui/auth/actions";
import Header from "ui/common/Header";
import Footer from "ui/common/Footer";
import LoadingOverlay from 'ui/common/LoadingOverlay';
import { useAuthState } from "ui/reducer/hooks";
import PrivateRouting from 'app/PrivateRouting';
import PublicRouting from 'app/PublicRouting';
import { Routing } from 'app/constants';
import { buildProfileRouting } from 'ui/member/utils';
import ErrorBoundary from 'ui/common/ErrorBoundary';
import { setupGlobalAuthInterceptor, setGlobalDispatch } from 'ui/common/globalAuthInterceptor';

const publicPaths = [Routing.Login, Routing.SignUp, Routing.PasswordReset];

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search, hash } = location;
  const checkoutReturn = checkoutDestination();
  const dispatch = useDispatch();
  const [refreshKey, setRefreshKey] = React.useState(0);
  React.useEffect(() => {
    if (!platform.native) return;
    const go = (event: CustomEvent<string>) => navigate(event.detail);
    const refresh = () => { dispatch(sessionLoginUserAction()); setRefreshKey(key => key + 1); };
    window.addEventListener('mms:navigate', go as EventListener);
    window.addEventListener('mms:refresh', refresh);
    return () => {
      window.removeEventListener('mms:navigate', go as EventListener);
      window.removeEventListener('mms:refresh', refresh);
    };
  }, [navigate, dispatch]);

  // Register global 401 interceptor once on mount
  React.useEffect(() => {
    setupGlobalAuthInterceptor(dispatch);
    setGlobalDispatch(dispatch);
  }, []);
  const { currentUser, currentUser: { id: currentUserId }, permissions, isRequesting, error, totpEnrollmentRequired } = useAuthState();
  const [attemptingLogin, setAttemptingLogin] = React.useState(true);
  const [loginAttempted, setLoginAttempted] = React.useState<boolean>();
  const [authSettled, setAuthSettled] = React.useState<boolean>();
  React.useEffect(() => { if (platform.native && !currentUserId) setAuthSettled(false); }, [currentUserId]);
  const { current: initialPath } = React.useRef(pathname);
  const { current: initialSearch } = React.useRef(search);
  const { current: initialHash } = React.useRef(hash);

  // Persist ?redirect= across LoginForm's own post-login navigate to
  // Routing.Members, which fires (and clears the query string) before this
  // effect below runs.
  const redirectParamRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const redirect = new URLSearchParams(search).get('redirect');
    if (redirect) {
      redirectParamRef.current = redirect;
    }
  }, [search]);

  // Attempt login on mount except when going to password reset
  React.useEffect(() => {
    if (initialPath !== Routing.PasswordReset) {
      dispatch(sessionLoginUserAction());
    }
  }, []);

  React.useEffect(() => {
    setLoginAttempted(true);
  }, []);

  // Redirect to security settings immediately if TOTP enrollment is required
  React.useEffect(() => {
    if (totpEnrollmentRequired && currentUserId) {
      navigate(`/members/${currentUserId}/settings/security`);
    }
  }, [totpEnrollmentRequired, currentUserId]);

  // Redirect after login if they were navigation elsewhere
  React.useEffect(() => {
    if (!error && !isRequesting && !authSettled) {
      loginAttempted && setAttemptingLogin(false);
      if (currentUserId) {
        if (totpEnrollmentRequired) return;
        const pending = platform.native && safePendingPath(sessionStorage.getItem(NATIVE_PENDING_PATH));
        if (pending) {
          sessionStorage.removeItem(NATIVE_PENDING_PATH);
          navigate(pending); setAuthSettled(true); return;
        }
        if (checkoutReturn && pathname !== checkoutReturn) {
          navigatePortal(checkoutReturn);
          return;
        }
        // Explicit redirect target (e.g. /login?redirect=/rentals/spots/abc123)
        // takes priority — captured via redirectParamRef while /login was
        // still active, since LoginForm's own pushLocation(Routing.Members)
        // clears the query string before this effect runs.
        const redirectParam = redirectParamRef.current;

        if (redirectParam) {
          redirectParamRef.current = null;
          navigate(decodeURIComponent(redirectParam));
        } else if (
            initialPath &&
            initialPath !== Routing.Root && // Don't nav to initial if initial is root
            !publicPaths.some(path => initialPath.startsWith(path)) // or initial is a public path
          ) {
          navigate(initialPath + initialSearch + initialHash);

          // Don't redirect after a user signs up
        } else if (!pathname.startsWith(Routing.SignUp)) {
          navigate(buildProfileRouting(currentUserId));      
        }
        setAuthSettled(true);
      }
    }
  }, [isRequesting, currentUserId, totpEnrollmentRequired]);

  return (
    <ErrorBoundary>
      <div className="root">
        <Header />
        {platform.renderShell?.()}
        <div key={refreshKey} style={{ padding: "0 12px" }}>
          {attemptingLogin ?
            <LoadingOverlay id="body" />
            : (currentUserId
                ? <PrivateRouting
                    permissions={permissions}
                    currentUserId={currentUserId}
                  />
                : <PublicRouting />)
          }
        </div>
      <Footer />
      </div>
    </ErrorBoundary>

  )
}

export default App;
