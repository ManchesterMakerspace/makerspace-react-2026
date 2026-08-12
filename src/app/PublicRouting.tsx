import * as React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { Routing } from 'app/constants';
import LandingPage from 'pages/registration/LandingPage';
import { SignUpWorkflow } from 'pages/registration/SignUpWorkflow/SignUpWorkflow';
import PasswordReset from 'ui/auth/PasswordReset';
import LoginPage from 'ui/auth/LoginPage';
import UnsubscribeEmails from 'ui/member/UnsubscribeEmails';
import FirebaseCallback from 'ui/auth/FirebaseCallback';
import RentalSpotPublicInfo from 'ui/rentalSpots/RentalSpotPublicInfo';
import MaintenancePage from 'ui/common/MaintenancePage';
import { getSignupStatus } from 'api/signupStatus';
import { AppLoading } from 'components/AppLoading/AppLoading';

/**
 * Gates the public (unauthenticated) /signup route behind the
 * "Lock Out New Signups" flag. Only used here — PrivateRouting's /signup
 * route is untouched so members who already created an account can still
 * finish picking a plan while maintenance mode is on.
 */
const PublicSignUpRoute: React.FC<{}> = () => {
  const [locked, setLocked] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getSignupStatus().then(status => {
      if (!cancelled) setLocked(status.locked);
    });
    return () => { cancelled = true; };
  }, []);

  if (locked === null) return <AppLoading isLoading={true} />;
  return locked ? <MaintenancePage /> : <SignUpWorkflow />;
};

const PublicRouting: React.FC<{}> = () => {
  return (
    <Routes>
      <Route path={`${Routing.PasswordReset}/:token`} element={<PasswordReset />} />
      <Route path={Routing.Login} element={<LoginPage />} />
      <Route path={Routing.SignUp} element={<PublicSignUpRoute />} />
      <Route path={Routing.Root} element={<LandingPage />} />
      <Route path={Routing.Unsubscribe} element={<UnsubscribeEmails />} />
      <Route path={Routing.RentalSpotDeepLink} element={<RentalSpotPublicInfo />} />
      <Route path='/auth/callback' element={<FirebaseCallback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default PublicRouting;
