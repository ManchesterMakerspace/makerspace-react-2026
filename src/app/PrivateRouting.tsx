import * as React from 'react';
import { Switch, Route, Redirect } from "react-router-dom";

import { Routing, Whitelists } from "app/constants";
import NotFound from "ui/common/NotFound";
import MembersList from "ui/member/MembersList";
import RentalsList from 'ui/rentals/RentalsList';
import EarnedMembershipsList from 'ui/earnedMemberships/EarnedMembershipsList';
import MemberDetail from 'ui/member/MemberDetail';
import MemberCheckInActivity from 'ui/member/MemberCheckInActivity';
import CheckoutPage from 'ui/checkout/CheckoutPage';
import BillingContainer from 'ui/billing/BillingContainer';
import SettingsContainer from 'ui/settings/SettingsContainer';
import Receipt from 'ui/checkout/Receipt';
import { Permission } from 'app/entities/permission';
import { CollectionOf } from 'app/interfaces';
import SendRegistrationComponent from 'ui/auth/SendRegistrationComponent';
import AgreementContainer from 'ui/documents/AgreementsContainer';
import UnsubscribeEmails from "ui/member/UnsubscribeEmails";
import { SignUpWorkflow } from 'pages/registration/SignUpWorkflow/SignUpWorkflow';
import AdminRentalsPage from 'ui/admin/rentals/AdminRentalsPage';
import ShopFeesPage from 'ui/shopFees/ShopFeesPage';
import ToolCheckoutsPage from 'ui/toolCheckouts/ToolCheckoutsPage';
import MemberPortalSettings from 'ui/admin/MemberPortalSettings';
import AdminVolunteerPage from 'ui/volunteer/AdminVolunteerPage';
import { useCapabilities } from 'app/permissions';
import { useAuthState } from 'ui/reducer/hooks';
import useReactRouter from 'use-react-router';

interface Props {
  currentUserId: string,
  permissions: CollectionOf<Permission>,
}

/**
 * LogUnauthorizedRouteAccess
 * React component that logs when an authenticated user attempts to access
 * a route that is not defined in the routing configuration or that they don't have permission to access.
 */
const LogUnauthorizedRouteAccess: React.FC = () => {
  const { location: { pathname } } = useReactRouter();
  const { currentUser: { id: userId } } = useAuthState();

  React.useEffect(() => {
    console.warn(
      `[Unauthorized Route Access] User ${userId} attempted to access unknown/unauthorized route: ${pathname}`
    );
  }, [pathname, userId]);

  return null;
};

const PrivateRouting: React.SFC<Props> = ({ currentUserId, permissions }) => {
  const caps = useCapabilities();
  const { totpEnrollmentRequired } = useAuthState();
  const billingEnabled = permissions[Whitelists.billing] || false;
  const earnedMembershipEnabled = caps.canManageEarnedMemberships && permissions[Whitelists.earnedMembership];

  // Hard gate — member must enroll in TOTP before accessing anything else
  if (totpEnrollmentRequired) {
    return (
      <Switch>
        <Route
          exact
          path={`${Routing.Settings}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`}
          component={SettingsContainer}
        />
        <Redirect to={`/members/${currentUserId}/settings/security`} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route exact path={Routing.Members} component={MembersList} />
      <Route exact path={`${Routing.Documents}`} component={AgreementContainer} />
      <Route exact path={Routing.SignUp} component={SignUpWorkflow}/>
      <Route exact path={`${Routing.Settings}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} component={SettingsContainer} />
      <Route exact path={Routing.CheckInActivity} component={MemberCheckInActivity} />
      <Route exact path={`${Routing.Profile}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} component={MemberDetail} />
      <Route exact path={Routing.Rentals} component={RentalsList} />
      {caps.canManageRentals && <Route exact path={Routing.AdminRentals} component={AdminRentalsPage} />}
      {caps.canManageShopFees && <Route exact path={Routing.ShopFees} component={ShopFeesPage} />}
      {caps.canManageCheckouts && <Route exact path={Routing.ToolCheckouts} component={ToolCheckoutsPage} />}
      {caps.canManageVolunteer && <Route exact path={Routing.Volunteer} component={AdminVolunteerPage} />}
      {caps.canViewPortalSettings && <Route exact path={Routing.SystemSettings} component={MemberPortalSettings} />}
      {billingEnabled && <Route exact path={`${Routing.Billing}/${Routing.PathPlaceholder.Resource}${Routing.PathPlaceholder.Optional}`} component={BillingContainer} />}
      {billingEnabled && <Route exact path={Routing.Receipt} component={Receipt}/>}
      {billingEnabled && <Route path={Routing.Checkout} component={CheckoutPage} />}
      <Route exact path={Routing.SendRegistration} component={SendRegistrationComponent}/>
      {earnedMembershipEnabled && <Route exact path={Routing.EarnedMemberships} component={EarnedMembershipsList}/>}
      <Route exact path={Routing.Unsubscribe} component={UnsubscribeEmails} />
      <Redirect to={`${Routing.Members}/${currentUserId}`} />
      <Route render={() => (
        <>
          <LogUnauthorizedRouteAccess />
          <NotFound />
        </>
      )} />
    </Switch>
  )
};

export default PrivateRouting;
