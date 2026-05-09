import * as React from "react";
import { Link } from "react-router-dom";
import useReactRouter from "use-react-router";
import { Member, getMember, listRentals } from "makerspace-ts-api-client";

import { displayMemberExpiration, memberIsResourceManager } from "ui/member/utils";
import LoadingOverlay from "ui/common/LoadingOverlay";
import KeyValueItem from "ui/common/KeyValueItem";
import DetailView from "ui/common/DetailView";
import MemberStatusLabel from "ui/member/MemberStatusLabel";
import InvoicesList from "ui/invoice/InvoicesList";
import MemberRentalsTab from "ui/rentals/MemberRentalsTab";
import { ActionButton } from "ui/common/ButtonRow";
import { Whitelists, Routing } from "app/constants";
import { getDetailsForMember } from "./constants";
import AccessCardForm from "ui/accessCards/AccessCardForm";
import ReportList from "ui/reports/ReportList";
import TransactionsList from "ui/transactions/TransactionsList";
import useReadTransaction from "../hooks/useReadTransaction";
import { useAuthState } from "../reducer/hooks";
import EditMember from "./EditMember";
import RenewMember from "./RenewMember";
import NotificationModal, { Notification } from "./NotificationModal";
import AdminChangePasswordModal from "./AdminChangePasswordModal";
import HouseholdModal from "./HouseholdModal";
import PreviewMemberContract from "../documents/PreviewMemberContract";
import { SubRoutes } from "ui/settings/SettingsContainer";
import { SubscriptionFilter } from "../subscriptions/SubscriptionFilters";
import { useSearchQuery, useSetSearchQuery } from "hooks/useSearchQuery";
import ChargeButton from "ui/shopFees/ChargeButton";
import MemberCheckoutsTab from "ui/toolCheckouts/MemberCheckoutsTab";
import MemberVolunteerTab from "ui/volunteer/MemberVolunteerTab";
import { EmailStatusIcon, SlackStatusIcon } from "ui/common/ContactStatusIcons";
import GoogleDriveInviteButton from "ui/member/GoogleDriveInviteButton";
import FirebaseUnlinkButton from "ui/auth/FirebaseUnlinkButton";

const MemberProfile: React.FC = () => {
  const { match: { params: { memberId, resource } }, history } = useReactRouter<{ memberId: string, resource: string }>();
  const { currentUser: { id: currentUserId, isAdmin, isBoardMember, isResourceManager }, permissions } = useAuthState();
  const isAdminOrBoard = isAdmin || !!isBoardMember;

  const {
    isNewMember
  } = useSearchQuery({
    isNewMember: "newMember"
  });

  // State for tracking initial render to address bug displaying notifications
  const [initRender, setInitRender] = React.useState(true);
  React.useEffect(() => setInitRender(false), []);

  const isOwnProfile = currentUserId === memberId;
  const billingEnabled = !!permissions[Whitelists.billing];
  const canChargeMember = (isAdminOrBoard || isResourceManager) && !isOwnProfile;

  const goToSettings = React.useCallback(() => {
    history.push(Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUserId));
  }, [currentUserId]);

  const {
    isRequesting: memberLoading,
    refresh: refreshMember,
    error: memberError,
    data: member = {} as Member
  } = useReadTransaction(getMember, { id: memberId });

  const [notification, setNotification] = React.useState<Notification>();
  React.useEffect(() => {
    if (!initRender && isOwnProfile && !memberLoading && member.id) {
      if (isNewMember || !member.memberContractOnFile) {
        setNotification(member.memberContractOnFile ? Notification.Welcome : Notification.WelcomeNeedContract);
      } else if (!(member.address && member.address.street)) {
        setNotification(Notification.IdentifcationDetails);
      }
    }
  }, [initRender, isOwnProfile, memberLoading]);

  const { data: rentals = [], isRequesting: rentalsLoading } = useReadTransaction(listRentals, {}, undefined, "listRentals");

  React.useEffect(() => {
    const missingAgreement = rentals.find(rental => !rental.contractOnFile && !["agreement_denied", "cancelled", "denied", "pending"].includes((rental as any).status));
    if (!initRender && isOwnProfile && !rentalsLoading && missingAgreement && !notification) {
      setNotification(Notification.SignRental)
    }
  }, [initRender, isOwnProfile, rentals]);

  const { customerId, earnedMembershipId } = member;
  const isEarnedMember = !!earnedMembershipId && (isOwnProfile || isAdmin);

  const setSearchQuery = useSetSearchQuery();
  const closeNotification = React.useCallback(() => {
    setSearchQuery({ newMember: "" });
    setNotification(undefined);
    refreshMember();
  }, [refreshMember, setNotification]);

  const goToAgreements = React.useCallback(() => {
    switch (notification) {
      case Notification.SignRental:
        const missingAgreement = rentals.find(rental => !rental.contractOnFile && !["agreement_denied", "cancelled", "denied", "pending"].includes((rental as any).status));
        if (missingAgreement) {
          history.push(
            Routing.Documents
              .replace(Routing.PathPlaceholder.Resource, "rental")
              .replace(Routing.PathPlaceholder.ResourceId, missingAgreement.id)
          );
          break;
        }
      case Notification.WelcomeNeedContract:
        history.push(
          Routing.Documents
            .replace(Routing.PathPlaceholder.Resource, "membership")
            .replace(Routing.PathPlaceholder.ResourceId, "")
        );
        break;
      case Notification.Welcome:
        closeNotification();
        break;
      case Notification.IdentifcationDetails:
        goToSettings();
        break;
    }
  }, [history, rentals, notification, goToSettings, closeNotification]);

  React.useEffect(() => {
    if (memberError && !member.id) {
      history.push(Routing.Members);
    }
  }, [memberError]);

  if (memberLoading && !member.id) {
    return <LoadingOverlay />;
  }

  const memberSubscription = getDetailsForMember(member);

  return (
    <>
      <DetailView
        title={`${member.firstname} ${member.lastname}`}
        basePath={`/members/${memberId}`}
        actionButtons={[
          ...isOwnProfile ? [
            <ActionButton
              key="open-settings"
              id="member-detail-open-settings"
              color="primary"
              variant="outlined"
              disabled={memberLoading}
              label="Account Settings"
              onClick={goToSettings}
            />] : [],
          ...isAdminOrBoard ? [
            <EditMember member={member} key="edit-member" onEdit={refreshMember}/>,
            <RenewMember member={member} key="renew-member" onRenew={refreshMember}/>,
            <AccessCardForm memberId={memberId} key="card-form"/>,
            <AdminChangePasswordModal member={member} key="change-password"/>,
            <HouseholdModal member={member} key="household" onUpdate={refreshMember}/>,
            <GoogleDriveInviteButton member={member} key="google-drive-invite" />
          ] : [],
          // Send Charge button — admin and RM, not on own profile
          ...canChargeMember && member.id ? [
            <ChargeButton member={member} key="charge-member" />
          ] : [],
        ]}
        information={(
          <>
            <KeyValueItem label="Email">
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {member.email ? <a id="member-detail-email" href={`mailto:${member.email}`}>{member.email}</a> : "N/A"}
                {(isAdminOrBoard || isResourceManager) && (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#555' }}>Email status:</span>
                      <EmailStatusIcon mailtrap={(member as any).mailtrap} />
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#555' }}>Slack status:</span>
                      <SlackStatusIcon slack={(member as any).slack} />
                      {(member as any).slack && (
                        <span style={{ fontSize: '0.8rem', color: '#555' }}>{(member as any).slack.name}</span>
                      )}
                    </span>
                  </>
                )}
              </span>
            </KeyValueItem>
            <KeyValueItem  label="Membership Expiration">
              <span id="member-detail-expiration">{displayMemberExpiration(member)}</span>
            </KeyValueItem>
            <KeyValueItem label="Membership Status">
              <MemberStatusLabel id="member-detail-status" member={member} />
            </KeyValueItem>
            {billingEnabled && <KeyValueItem label="Membership Type">
              <span id="member-detail-type" style={{ marginRight: "1em" }}>{memberSubscription.type}</span>
                {member.subscriptionId && (
                  <span style={{ display: "inline-block", marginRight: "1em" }}>
                    {isOwnProfile && (
                      <Link to={`${Routing.Settings.replace(Routing.PathPlaceholder.MemberId, member.id)}/${SubRoutes.Subscriptions}`}>
                        Manage Subscription
                      </Link>
                    )}
                    {!isOwnProfile && isAdminOrBoard && (
                        <Link to={
                          `${
                            Routing.Billing}/${
                              SubRoutes.Subscriptions}?q=${
                                encodeURIComponent(`${member.subscriptionId}`)
                              }&${SubscriptionFilter.Status}=all`
                        }>
                          Manage Subscription
                        </Link>
                    )}
                  </span>
                )}
                {isAdminOrBoard && member.customerId && (
                  <a target="blank" href={`https://www.braintreegateway.com/merchants/vfx5f27bnwwjjyqx/customers/${member.customerId}`}>
                    View in Braintree
                  </a>
                )}
            </KeyValueItem>}
            {member.notes && <KeyValueItem label="Notes">
              <div id="member-detail-notes" className="preformatted">{member.notes}</div>
            </KeyValueItem>}
            {((member as any).groupName || isAdminOrBoard) && (
              <KeyValueItem label="Household">
                {(member as any).householdRole === "primary" && (
                  <span id="member-detail-household-role">Primary Member</span>
                )}
                {(member as any).householdRole === "secondary" && (
                  <span id="member-detail-household-role">Secondary Member</span>
                )}
                {!(member as any).groupName && isAdminOrBoard && (
                  <span id="member-detail-household-role" style={{ color: "grey" }}>None</span>
                )}
              </KeyValueItem>
            )}
            {isOwnProfile && <PreviewMemberContract />}
          </>
        )}
        activeResourceName={resource}
        resources={(isOwnProfile || isAdminOrBoard) && [
          ...isEarnedMember ?
          [{
            name: "membership",
            content: <ReportList earnedMembershipId={earnedMembershipId}/>
          }] : [],
          ...billingEnabled ?
          [{
            name: "dues",
            content: <InvoicesList />
          }] : [],
          {
            name: "rentals",
            content: <MemberRentalsTab member={member} onUpdate={refreshMember} />
          },
          {
            name: "checkouts",
            displayName: "Checkouts",
            content: <MemberCheckoutsTab member={member} />
          },
          ...billingEnabled && !!customerId ? [{
            name: "transactions",
            displayName: "Payment History",
            content: <TransactionsList member={member} />
          }] : [],
          ...isOwnProfile ? [{
            name: "volunteer",
            displayName: "Volunteer",
            content: <MemberVolunteerTab member={member} />
          }] : [],
        ]}
      />
      {notification && <NotificationModal
        notification={notification}
        onSubmit={goToAgreements}
        onClose={closeNotification}
      />}
    </>
  )
};

export default MemberProfile;
