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
        if (
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
  }, [isRequesting]);

  return (
    <ErrorBoundary>
      <div className="root">
        <Header />
        {attemptingLogin ?
          <LoadingOverlay id="body" />
          : (currentUserId
              ? <PrivateRouting
                  permissions={permissions}
                  currentUserId={currentUserId}
                />
              : <PublicRouting />)
        }
      <Footer />
      </div>
    </ErrorBoundary>

  )
}

export default App;
