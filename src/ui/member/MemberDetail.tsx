import * as React from "react";
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from "react-router-dom";
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
import { useCapabilities } from "app/permissions";
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
import MemberReservationsTab from "ui/reservations/MemberReservationsTab";
import MemberVolunteerTab from "ui/volunteer/MemberVolunteerTab";
import MemberCheckInActivity from "ui/member/MemberCheckInActivity";
import MemberEmailLogTab from "ui/member/MemberEmailLogTab";
import { EmailStatusIcon, SlackStatusIcon } from "ui/common/ContactStatusIcons";
import GoogleDriveInviteButton from 'ui/member/GoogleDriveInviteButton';
import SlackInviteButton from 'ui/member/SlackInviteButton';
import FirebaseUnlinkButton from "ui/auth/FirebaseUnlinkButton";


const getCsrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const Reset2FAButton: React.FC<{ memberId: string; onReset: () => void }> = ({ memberId, onReset }) => {
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg]         = React.useState('');

  const handleReset = async () => {
    if (!window.confirm('Reset this member\'s two-factor authentication? They will be signed out of all active sessions immediately.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/totp`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-XSRF-TOKEN': getCsrfToken() },
      });
      if (res.ok) {
        setMsg('2FA reset successfully.');
        onReset();
      } else {
        setMsg('Failed to reset 2FA.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ActionButton
        key="reset-2fa"
        id="member-detail-reset-2fa"
        color="secondary"
        variant="outlined"
        disabled={loading || !memberId}
        label="Reset 2FA"
        onClick={handleReset}
      />
      {msg && <span style={{ fontSize: '0.8rem', marginLeft: 8 }}>{msg}</span>}
    </>
  );
};

const MemberProfile: React.FC = () => {
  const { memberId, resource } = useParams();
  const navigate = useNavigate();
  const { currentUser: { id: currentUserId, isAdmin }, permissions } = useAuthState();
  const {
    canViewAllMembers,
    canEditMembers,
    canChangeOtherPasswords,
    canViewEmailStatus,
    canManageBilling,
    canManageShopFees,
    canManageCheckoutApprovers,
  } = useCapabilities();

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
  const canChargeMember = canManageShopFees && !isOwnProfile;

  const goToSettings = React.useCallback(() => {
    navigate(Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUserId));
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
  const isEarnedMember = !!earnedMembershipId && (isOwnProfile || canEditMembers);

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
          navigate(
            Routing.Documents
              .replace(Routing.PathPlaceholder.Resource, "rental")
              .replace(Routing.PathPlaceholder.ResourceId, missingAgreement.id)
          );
          break;
        }
      case Notification.WelcomeNeedContract:
        navigate(
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
      navigate(Routing.Members);
    }
  }, [memberError]);

  if (memberLoading && !member.id) {
    return <LoadingOverlay />;
  }

  const memberSubscription = getDetailsForMember(member);
  const memberDisplayName = `${member.firstname} ${member.lastname}`;
  const memberTitle = (member as any).slack?.url
    ? <a href={(member as any).slack.url}>{memberDisplayName}</a>
    : memberDisplayName;
  const showManualSlackDeactivationWarning =
    canViewAllMembers &&
    !isOwnProfile &&
    member.status === "revoked" &&
    !!(member as any).slackManualDeactivationRequired;

  return (
    <>
      {showManualSlackDeactivationWarning && (
        <div
          id="member-slack-manual-deactivation-warning"
          role="alert"
          style={{
            color: "#b00020",
            fontWeight: 700,
            border: "2px solid #b00020",
            borderRadius: 4,
            marginBottom: 16,
            padding: "12px 16px",
          }}
        >
          Slack was not deactivated automatically because SLACK_ADMIN_TOKEN is not configured.
          You must manually deactivate this member in Slack.
        </div>
      )}
      <DetailView
        title={memberTitle}
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
          ...canEditMembers ? [
            <EditMember member={member} key="edit-member" onEdit={refreshMember}/>,
            <RenewMember member={member} key="renew-member" onRenew={refreshMember}/>,
            <AccessCardForm memberId={memberId} key="card-form"/>,
            <AdminChangePasswordModal member={member} key="change-password"/>,
            <HouseholdModal member={member} key="household" onUpdate={refreshMember}/>,
            <GoogleDriveInviteButton member={member} key='google-drive-invite' />,
            <SlackInviteButton member={member} key='slack-invite' />,
            ...((member as any).totpEnabled ? [
              <Reset2FAButton key="reset-2fa" memberId={memberId} onReset={refreshMember} />
            ] : [])
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
                {canViewEmailStatus && (
                  <>
                    <EmailStatusIcon mailtrap={(member as any).mailtrap} />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <SlackStatusIcon slack={(member as any).slack} />
                      {(member as any).slack && (
                        <span style={{ fontSize: "0.8rem", color: "#555" }}>{(member as any).slack.name}</span>
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
              <Link to={`/members/${memberId}/checkin-activity`} style={{ textDecoration: "none", color: "inherit" }}>
                <MemberStatusLabel id="member-detail-status" member={member} />
              </Link>
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
                    {!isOwnProfile && canManageBilling && (
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
                {isAdmin && member.customerId && (
                  <a target="blank" href={`https://www.braintreegateway.com/merchants/vfx5f27bnwwjjyqx/customers/${member.customerId}`}>
                    View in Braintree
                  </a>
                )}
            </KeyValueItem>}
            {member.notes && <KeyValueItem label="Notes">
              <div id="member-detail-notes" className="preformatted">{member.notes}</div>
            </KeyValueItem>}
            {((member as any).groupName || canEditMembers) && (
              <KeyValueItem label="Household">
                {(member as any).householdRole === "primary" && (
                  <span id="member-detail-household-role">Primary Member</span>
                )}
                {(member as any).householdRole === "secondary" && (
                  <span id="member-detail-household-role">Secondary Member</span>
                )}
                {!(member as any).groupName && canEditMembers && (
                  <span id="member-detail-household-role" style={{ color: "grey" }}>None</span>
                )}
              </KeyValueItem>
            )}
            {isOwnProfile && <PreviewMemberContract />}
          </>
        )}
        activeResourceName={resource}
        resources={(isOwnProfile || canEditMembers) && [
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
          {
            name: "reservations",
            displayName: "Reservations",
            content: <MemberReservationsTab member={member} />
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
          ...(isOwnProfile || canManageCheckoutApprovers) ? [{
            name: "checkin-activity",
            displayName: "Check-In Activity",
            content: <MemberCheckInActivity />
          }] : [],
          ...canEditMembers ? [{
            name: "email-log",
            displayName: "Email Log",
            content: <MemberEmailLogTab memberId={memberId} />
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
