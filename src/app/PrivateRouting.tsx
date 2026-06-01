import * as React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { Routing, Whitelists } from 'app/constants';
import { Permission } from 'app/entities/permission';
import { CollectionOf } from 'app/interfaces';
import { useCapabilities } from 'app/permissions';
import { useAuthState } from 'ui/reducer/hooks';
import LoadingOverlay from 'ui/common/LoadingOverlay';

const MembersList = React.lazy(() => import('ui/member/MembersList'));
const RentalsList = React.lazy(() => import('ui/rentals/RentalsList'));
const EarnedMembershipsList = React.lazy(() => import('ui/earnedMemberships/EarnedMembershipsList'));
const MemberDetail = React.lazy(() => import('ui/member/MemberDetail'));
const CheckoutPage = React.lazy(() => import('ui/checkout/CheckoutPage'));
const BillingContainer = React.lazy(() => import('ui/billing/BillingContainer'));
const SettingsContainer = React.lazy(() => import('ui/settings/SettingsContainer'));
const Receipt = React.lazy(() => import('ui/checkout/Receipt'));
const SendRegistrationComponent = React.lazy(() => import('ui/auth/SendRegistrationComponent'));
const AgreementContainer = React.lazy(() => import('ui/documents/AgreementsContainer'));
const UnsubscribeEmails = React.lazy(() => import('ui/member/UnsubscribeEmails'));
const SignUpWorkflow = React.lazy(() =>
  import('pages/registration/SignUpWorkflow/SignUpWorkflow').then(module => ({ default: module.SignUpWorkflow }))
);
const AdminRentalsPage = React.lazy(() => import('ui/admin/rentals/AdminRentalsPage'));
const ShopFeesPage = React.lazy(() => import('ui/shopFees/ShopFeesPage'));
const ToolCheckoutsPage = React.lazy(() => import('ui/toolCheckouts/ToolCheckoutsPage'));
const MemberPortalSettings = React.lazy(() => import('ui/admin/MemberPortalSettings'));
const AdminVolunteerPage = React.lazy(() => import('ui/volunteer/AdminVolunteerPage'));

interface Props {
  currentUserId: string,
  permissions: CollectionOf<Permission>,
}

/**
 * Logs unauthorized route access and redirects authenticated user to their profile.
 */
const RedirectHome: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const { pathname } = useLocation();
  const { currentUser: { id: userId } } = useAuthState();

  React.useEffect(() => {
    console.warn(
      `[Unauthorized Route Access] User ${userId} attempted to access unknown/unauthorized route: ${pathname}`
    );
  }, [pathname, userId]);

  return <Navigate to={`${Routing.Members}/${currentUserId}`} replace />;
};

const PrivateRouting: React.FC<Props> = ({ currentUserId, permissions }) => {
  const caps = useCapabilities();
  const { totpEnrollmentRequired } = useAuthState();
  const billingEnabled = permissions[Whitelists.billing] || false;
  const earnedMembershipEnabled = caps.canManageEarnedMemberships && permissions[Whitelists.earnedMembership];

  if (totpEnrollmentRequired) {
    return (
      <React.Suspense fallback={<LoadingOverlay id="route-loading" />}>
        <Routes>
          <Route
            path={`${Routing.Settings}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`}
            element={<SettingsContainer />}
          />
          <Route path="*" element={<Navigate to={`/members/${currentUserId}/settings/security`} replace />} />
        </Routes>
      </React.Suspense>
    );
  }

  return (
    <React.Suspense fallback={<LoadingOverlay id="route-loading" />}>
      <Routes>
        <Route path={Routing.Members} element={<MembersList />} />
        <Route path={`${Routing.Documents}`} element={<AgreementContainer />} />
        <Route path={Routing.SignUp} element={<SignUpWorkflow />} />
        <Route path={`${Routing.Settings}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} element={<SettingsContainer />} />
        <Route path={`${Routing.Profile}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} element={<MemberDetail />} />
        <Route path={Routing.Rentals} element={<RentalsList />} />
        {caps.canManageRentals && <Route path={Routing.AdminRentals} element={<AdminRentalsPage />} />}
        {caps.canManageShopFees && <Route path={Routing.ShopFees} element={<ShopFeesPage />} />}
        {caps.canManageCheckouts && <Route path={Routing.ToolCheckouts} element={<ToolCheckoutsPage />} />}
        {caps.canManageVolunteer && <Route path={Routing.Volunteer} element={<AdminVolunteerPage />} />}
        {caps.canViewPortalSettings && <Route path={Routing.SystemSettings} element={<MemberPortalSettings />} />}
        {billingEnabled && <Route path={`${Routing.Billing}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} element={<BillingContainer />} />}
        {billingEnabled && <Route path={Routing.Receipt} element={<Receipt />} />}
        {billingEnabled && <Route path={Routing.Checkout} element={<CheckoutPage />} />}
        <Route path={Routing.SendRegistration} element={<SendRegistrationComponent />} />
        {earnedMembershipEnabled && <Route path={Routing.EarnedMemberships} element={<EarnedMembershipsList />} />}
        <Route path={Routing.Unsubscribe} element={<UnsubscribeEmails />} />
        <Route path="*" element={<RedirectHome currentUserId={currentUserId} />} />
      </Routes>
    </React.Suspense>
  );
};

export default PrivateRouting;
