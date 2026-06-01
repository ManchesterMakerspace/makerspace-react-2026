import * as React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { Routing } from 'app/constants';
import LoadingOverlay from 'ui/common/LoadingOverlay';

const LandingPage = React.lazy(() => import('pages/registration/LandingPage'));
const SignUpWorkflow = React.lazy(() =>
  import('pages/registration/SignUpWorkflow/SignUpWorkflow').then(module => ({ default: module.SignUpWorkflow }))
);
const PasswordReset = React.lazy(() => import('ui/auth/PasswordReset'));
const LoginPage = React.lazy(() => import('ui/auth/LoginPage'));
const UnsubscribeEmails = React.lazy(() => import('ui/member/UnsubscribeEmails'));
const FirebaseCallback = React.lazy(() => import('ui/auth/FirebaseCallback'));

const PublicRouting: React.FC<{}> = () => {
  return (
    <React.Suspense fallback={<LoadingOverlay id="route-loading" />}>
      <Routes>
        <Route path={`${Routing.PasswordReset}/:token`} element={<PasswordReset />} />
        <Route path={Routing.Login} element={<LoginPage />} />
        <Route path={Routing.SignUp} element={<SignUpWorkflow />} />
        <Route path={Routing.Root} element={<LandingPage />} />
        <Route path={Routing.Unsubscribe} element={<UnsubscribeEmails />} />
        <Route path='/auth/callback' element={<FirebaseCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
};

export default PublicRouting;
