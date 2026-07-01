import * as React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { Routing, Whitelists } from 'app/constants';
import MembersList from 'ui/member/MembersList';
import RentalsList from 'ui/rentals/RentalsList';
import EarnedMembershipsList from 'ui/earnedMemberships/EarnedMembershipsList';
import MemberDetail from 'ui/member/MemberDetail';
import CheckoutPage from 'ui/checkout/CheckoutPage';
import BillingContainer from 'ui/billing/BillingContainer';
import SettingsContainer from 'ui/settings/SettingsContainer';
import Receipt from 'ui/checkout/Receipt';
import { Permission } from 'app/entities/permission';
import { CollectionOf } from 'app/interfaces';
import SendRegistrationComponent from 'ui/auth/SendRegistrationComponent';
import AgreementContainer from 'ui/documents/AgreementsContainer';
import UnsubscribeEmails from 'ui/member/UnsubscribeEmails';
import { SignUpWorkflow } from 'pages/registration/SignUpWorkflow/SignUpWorkflow';
import AdminRentalsPage from 'ui/admin/rentals/AdminRentalsPage';
import ShopFeesPage from 'ui/shopFees/ShopFeesPage';
import ToolCheckoutsPage from 'ui/toolCheckouts/ToolCheckoutsPage';
import MemberPortalSettings from 'ui/admin/MemberPortalSettings';
import AdminVolunteerPage from 'ui/volunteer/AdminVolunteerPage';
import AdminAnalyticsPage from 'ui/admin/AdminAnalyticsPage';
import AuditLogPage from 'ui/auditLog/AuditLogPage';
import RentalSpotDeepLink from 'ui/rentalSpots/RentalSpotDeepLink';
import { useCapabilities } from 'app/permissions';
import { useAuthState } from 'ui/reducer/hooks';

interface Props {
  currentUserId: string;
  permissions: CollectionOf<Permission>;
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
      <Routes>
        <Route
          path={`${Routing.Settings}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`}
          element={<SettingsContainer />}
        />
        <Route path='*' element={<Navigate to={`/members/${currentUserId}/settings/security`} replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path={Routing.Members} element={<MembersList />} />
      <Route path={`${Routing.Documents}`} element={<AgreementContainer />} />
      <Route path={Routing.SignUp} element={<SignUpWorkflow />} />
      <Route path={`${Routing.Settings}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} element={<SettingsContainer />} />
      <Route path={`${Routing.Profile}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} element={<MemberDetail />} />
      <Route path={Routing.RentalSpotDeepLink} element={<RentalSpotDeepLink />} />
      <Route path={Routing.Rentals} element={<RentalsList />} />
      {caps.canManageRentals     && <Route path={Routing.AdminRentals}    element={<AdminRentalsPage />} />}
      {caps.canManageShopFees    && <Route path={Routing.ShopFees}         element={<ShopFeesPage />} />}
      <Route path={Routing.ToolCheckouts} element={<ToolCheckoutsPage />} />
      {caps.canManageVolunteer   && <Route path={Routing.Volunteer}        element={<AdminVolunteerPage />} />}
      {caps.canViewAnalytics      && <Route path={Routing.Analytics}       element={<AdminAnalyticsPage />} />}
      {caps.canViewPortalSettings && <Route path={Routing.SystemSettings}  element={<MemberPortalSettings />} />}
      {caps.canViewAuditLog      && <Route path={Routing.AuditLog}         element={<AuditLogPage />} />}
      {billingEnabled && <Route path={`${Routing.Billing}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} element={<BillingContainer />} />}
      {billingEnabled && <Route path={Routing.Receipt} element={<Receipt />} />}
      {billingEnabled && <Route path={Routing.Checkout} element={<CheckoutPage />} />}
      <Route path={Routing.SendRegistration} element={<SendRegistrationComponent />} />
      {earnedMembershipEnabled && <Route path={Routing.EarnedMemberships} element={<EarnedMembershipsList />} />}
      <Route path={Routing.Unsubscribe} element={<UnsubscribeEmails />} />
      <Route path='*' element={<RedirectHome currentUserId={currentUserId} />} />
    </Routes>
  );
};

export default PrivateRouting;
