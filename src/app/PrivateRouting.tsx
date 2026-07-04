import * as React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { Routing, Whitelists } from 'app/constants';
import MembersList from 'ui/member/MembersList';
import MemberDetail from 'ui/member/MemberDetail';
import CheckoutPage from 'ui/checkout/CheckoutPage';
import SettingsContainer from 'ui/settings/SettingsContainer';
import Receipt from 'ui/checkout/Receipt';
import { Permission } from 'app/entities/permission';
import { CollectionOf } from 'app/interfaces';
import SendRegistrationComponent from 'ui/auth/SendRegistrationComponent';
import AgreementContainer from 'ui/documents/AgreementsContainer';
import UnsubscribeEmails from 'ui/member/UnsubscribeEmails';
import { SignUpWorkflow } from 'pages/registration/SignUpWorkflow/SignUpWorkflow';

import RentalSpotDeepLink from 'ui/rentalSpots/RentalSpotDeepLink';
import { useCapabilities } from 'app/permissions';
import { useAuthState } from 'ui/reducer/hooks';
import LoadingOverlay from 'ui/common/LoadingOverlay';

const lazyRoute = <T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) => React.lazy(factory);

const RentalsList = lazyRoute(() => import(/* webpackChunkName: "member-rentals", webpackPrefetch: true */ 'ui/rentals/RentalsList'));
const EarnedMembershipsList = lazyRoute(() => import(/* webpackChunkName: "earned-memberships", webpackPrefetch: true */ 'ui/earnedMemberships/EarnedMembershipsList'));
const BillingContainer = lazyRoute(() => import(/* webpackChunkName: "billing", webpackPrefetch: true */ 'ui/billing/BillingContainer'));
const AdminRentalsPage = lazyRoute(() => import(/* webpackChunkName: "admin-rentals", webpackPrefetch: true */ 'ui/admin/rentals/AdminRentalsPage'));
const ShopFeesPage = lazyRoute(() => import(/* webpackChunkName: "admin-shop-fees", webpackPrefetch: true */ 'ui/shopFees/ShopFeesPage'));
const ToolCheckoutsPage = lazyRoute(() => import(/* webpackChunkName: "admin-tool-checkouts", webpackPrefetch: true */ 'ui/toolCheckouts/ToolCheckoutsPage'));
const MemberPortalSettings = lazyRoute(() => import(/* webpackChunkName: "admin-portal-settings", webpackPrefetch: true */ 'ui/admin/MemberPortalSettings'));
const AdminVolunteerPage = lazyRoute(() => import(/* webpackChunkName: "admin-volunteer", webpackPrefetch: true */ 'ui/volunteer/AdminVolunteerPage'));
const AdminAnalyticsPage = lazyRoute(() => import(/* webpackChunkName: "admin-analytics", webpackPrefetch: true */ 'ui/admin/AdminAnalyticsPage'));
const AuditLogPage = lazyRoute(() => import(/* webpackChunkName: "admin-audit-log", webpackPrefetch: true */ 'ui/auditLog/AuditLogPage'));

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
    <React.Suspense fallback={<LoadingOverlay id="body" />}>
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
    </React.Suspense>
  );
};

export default PrivateRouting;
