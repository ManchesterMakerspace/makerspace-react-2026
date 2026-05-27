import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { sessionLoginUserAction } from 'ui/auth/actions';
import Header from 'ui/common/Header';
import Footer from 'ui/common/Footer';
import LoadingOverlay from 'ui/common/LoadingOverlay';
import { useAuthState } from 'ui/reducer/hooks';
import PrivateRouting from 'app/PrivateRouting';
import PublicRouting from 'app/PublicRouting';
import { Routing } from 'app/constants';
import { buildProfileRouting } from 'ui/member/utils';
import ErrorBoundary from 'ui/common/ErrorBoundary';
import { setupGlobalAuthInterceptor, setGlobalDispatch } from 'ui/common/globalAuthInterceptor';

const publicPaths = [Routing.Login, Routing.SignUp, Routing.PasswordReset];

const App: React.FC = () => {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const dispatch = useDispatch();

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

  React.useEffect(() => {
    if (initialPath !== Routing.PasswordReset) {
      dispatch(sessionLoginUserAction());
    }
  }, []);

  React.useEffect(() => {
    setLoginAttempted(true);
  }, []);

  React.useEffect(() => {
    if (totpEnrollmentRequired && currentUserId) {
      navigate(`/members/${currentUserId}/settings/security`);
    }
  }, [totpEnrollmentRequired, currentUserId]);

  React.useEffect(() => {
    if (!error && !isRequesting && !authSettled) {
      loginAttempted && setAttemptingLogin(false);
      if (currentUserId) {
        if (
          initialPath &&
          initialPath !== Routing.Root &&
          !publicPaths.some(path => initialPath.startsWith(path))
        ) {
          navigate(initialPath + initialSearch + initialHash);
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
        {attemptingLogin
          ? <LoadingOverlay id="body" />
          : (currentUserId
              ? <PrivateRouting permissions={permissions} currentUserId={currentUserId} />
              : <PublicRouting />)
        }
        <Footer />
      </div>
    </ErrorBoundary>
  );
};

export default App;
