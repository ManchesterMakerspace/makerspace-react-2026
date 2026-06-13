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

const PublicRouting: React.FC<{}> = () => {
  return (
    <Routes>
      <Route path={`${Routing.PasswordReset}/:token`} element={<PasswordReset />} />
      <Route path={Routing.Login} element={<LoginPage />} />
      <Route path={Routing.SignUp} element={<SignUpWorkflow />} />
      <Route path={Routing.Root} element={<LandingPage />} />
      <Route path={Routing.Unsubscribe} element={<UnsubscribeEmails />} />
      <Route path={Routing.RentalSpotDeepLink} element={<RentalSpotPublicInfo />} />
      <Route path='/auth/callback' element={<FirebaseCallback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default PublicRouting;
