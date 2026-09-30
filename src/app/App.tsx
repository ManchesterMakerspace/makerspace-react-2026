// @ts-nocheck
import { checkoutDestination } from "ui/auth/checkoutDestination";
import { clearLoginDestination, defaultLoginDestination, loginDestination, rememberLoginDestination } from "ui/auth/loginDestination";
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
import ErrorBoundary from 'ui/common/ErrorBoundary';
import { setupGlobalAuthInterceptor, setGlobalDispatch } from 'ui/common/globalAuthInterceptor';

const publicPaths = [Routing.Login, Routing.SignUp, Routing.PasswordReset, '/auth/callback'];

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search, hash } = location;
  const checkoutReturn = checkoutDestination();
  const loginReturn = loginDestination();
  const dispatch = useDispatch();

  // Register global 401 interceptor once on mount
  React.useEffect(() => {
    setupGlobalAuthInterceptor(dispatch);
    setGlobalDispatch(dispatch);
  }, []);
  const { currentUser, currentUser: { id: currentUserId }, permissions, isRequesting, error, totpEnrollmentRequired } = useAuthState();
  const [attemptingLogin, setAttemptingLogin] = React.useState(true);
  const [loginAttempted, setLoginAttempted] = React.useState<boolean>();
  const [authSettled, setAuthSettled] = React.useState<boolean>();
  const { current: initialPath } = React.useRef(pathname);
  const { current: initialSearch } = React.useRef(search);
  const { current: initialHash } = React.useRef(hash);
  const initialDestinationRef = React.useRef(initialPath !== Routing.Root &&
    !publicPaths.some(path => initialPath.startsWith(path))
    ? initialPath + initialSearch + initialHash : null);

  // Attempt login on mount except when going to password reset
  React.useEffect(() => {
    if (initialPath !== Routing.PasswordReset) {
      dispatch(sessionLoginUserAction());
    }
  }, []);

  React.useEffect(() => {
    setLoginAttempted(true);
  }, []);

  // One owner for session, password, provider and TOTP post-login navigation.
  React.useEffect(() => {
    if (error || isRequesting || !loginAttempted) return;
    setAttemptingLogin(false);
    if (!currentUserId) {
      setAuthSettled(false);
      return;
    }
    if (totpEnrollmentRequired) {
      if (!loginReturn) rememberLoginDestination(initialDestinationRef.current);
      initialDestinationRef.current = null;
      setAuthSettled(true);
      navigate(`/members/${currentUserId}/settings/security`, { replace: true });
      return;
    }
    // The callback finishes its login handoff; signup owns its completion route.
    if (pathname === '/auth/callback') return;
    if (pathname.startsWith(Routing.SignUp)) {
      initialDestinationRef.current = null;
      setAuthSettled(true);
      return;
    }
    if (authSettled && pathname !== Routing.Login && pathname !== Routing.Root) return;
    if (checkoutReturn) {
      window.location.assign(checkoutReturn);
      return;
    }
    const destination = loginReturn || initialDestinationRef.current || defaultLoginDestination(currentUser);
    initialDestinationRef.current = null;
    clearLoginDestination();
    setAuthSettled(true);
    navigate(destination, { replace: true });
  }, [error, isRequesting, loginAttempted, currentUserId, totpEnrollmentRequired, authSettled, pathname, search]);

  return (
    <ErrorBoundary>
      <div className="root">
        <Header />
        <div style={{ padding: "0 12px" }}>
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
