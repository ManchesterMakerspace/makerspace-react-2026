import * as React from 'react';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';

export type SlackProvisioningStatus =
  | 'unknown'
  | 'blocked'
  | 'not_invited'
  | 'invite_confirmed'
  | 'invite_pending'
  | 'guest'
  | 'manual_invite_required'
  | 'manual_promotion_required'
  | 'full_member';

export type GoogleDriveProvisioningStatus =
  | 'unknown'
  | 'blocked'
  | 'permanently_failed'
  | 'pending_activation'
  | 'not_provisioned'
  | 'partial'
  | 'failed'
  | 'complete';

export interface MemberProvisioning {
  activationEligible: boolean;
  email: string;
  slack: {
    status: SlackProvisioningStatus;
    inviteConfirmedAt?: string | null;
    inviteSource?: 'api' | 'slack_user_record' | null;
    inviteMode?: 'full_member' | 'single_channel_guest' | null;
    joinedAt?: string | null;
    fullMemberAt?: string | null;
    manualActionRequired?: 'invite' | 'promotion' | null;
    lastError?: string | null;
    lastAttemptAt?: string | null;
  };
  googleDrive: {
    status: GoogleDriveProvisioningStatus;
    resourcesAccessConfirmedAt?: string | null;
    transferAccessConfirmedAt?: string | null;
    provisioningBlockedAt?: string | null;
    provisioningBlockedReason?: string | null;
  };
}

export interface ProvisioningMember {
  provisioning?: MemberProvisioning;
}

const SLACK_LABELS: Record<SlackProvisioningStatus, string> = {
  unknown: 'Slack invitation status has not been reconciled',
  blocked: 'Slack provisioning is blocked by member status',
  not_invited: 'No Slack invitation has been confirmed for this email',
  invite_confirmed: 'A Slack invitation is confirmed; acceptance has not been verified',
  invite_pending: 'Slack invitation sent; waiting for the member to accept',
  guest: 'Slack invitation accepted as a guest; waiting for membership activation',
  manual_invite_required: 'Manual Slack invitation required',
  manual_promotion_required: 'Manual Slack promotion to full member required',
  full_member: 'Full Slack membership confirmed',
};

const DRIVE_LABELS: Record<GoogleDriveProvisioningStatus, string> = {
  unknown: 'Google Drive access has not been reconciled',
  blocked: 'Google Drive provisioning is blocked by member status',
  permanently_failed: 'Google Drive provisioning is blocked and will not retry automatically',
  pending_activation: 'Waiting for a future expiration and usable fob',
  not_provisioned: 'Member is activated but Google Drive access is not confirmed',
  partial: 'Only one of the two Google Drive permissions is confirmed',
  failed: 'The latest Google Drive provisioning attempt failed',
  complete: 'Both Google Drive permissions are confirmed',
};

const statusIcon = (status: string) => {
  if (status === 'full_member' || status === 'complete') {
    return <CheckCircleIcon fontSize='small' color='success' style={{ verticalAlign: 'middle' }} />;
  }
  if (
    status.startsWith('manual_') || status === 'failed' || status === 'not_invited' ||
    status === 'blocked' || status === 'permanently_failed'
  ) {
    return <ErrorIcon fontSize='small' color='error' style={{ verticalAlign: 'middle' }} />;
  }
  if (status === 'invite_pending' || status === 'guest' || status === 'pending_activation' || status === 'partial') {
    return <HourglassTopIcon fontSize='small' color='warning' style={{ verticalAlign: 'middle' }} />;
  }
  return <InfoOutlined fontSize='small' color='disabled' style={{ verticalAlign: 'middle' }} />;
};

const formatTimestamp = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : undefined;

// Why a Slack indicator is red, in plain words, from the error the server stored.
// An unrecognized error is shown as it came from Slack.
export const slackReason = (slack: MemberProvisioning['slack']): string | undefined => {
  if (!slack.status.startsWith('manual_') || !slack.lastError) return undefined;
  const error = slack.lastError;
  if (/email changed/i.test(error)) {
    return 'Their email was changed. Use the Slack button on their profile to re-invite them: it deactivates their old Slack account and invites the new address.';
  }
  if (/inviter_email_not_verified/.test(error)) {
    return 'Slack rejected the invite: the Slack account that sends invites has not verified its email address in Slack.';
  }
  if (/not allowed for revoked, inactive, non-member, or expired/i.test(error)) {
    return 'Not eligible for Slack: membership is expired, inactive or revoked.';
  }
  return error;
};

const slackLabel = (slack: MemberProvisioning['slack'], timestamp?: string) => {
  const reason = slackReason(slack);
  return `${SLACK_LABELS[slack.status]}${timestamp ? ` (${timestamp})` : ''}${reason ? `. ${reason}` : ''}`;
};

export const SlackProvisioningIcon: React.FC<{
  provisioning?: MemberProvisioning;
  fallbackLinkedName?: string;
}> = (props) => {
  const { provisioning, fallbackLinkedName } = props;
  if (!provisioning) {
    return (
      <Tooltip title={fallbackLinkedName ? `Slack linked: ${fallbackLinkedName}` : 'No Slack account linked'}>
        {fallbackLinkedName
          ? <CheckCircleIcon fontSize='small' color='success' sx={{ verticalAlign: 'middle' }} />
          : <ErrorIcon fontSize='small' color='warning' sx={{ verticalAlign: 'middle' }} />
        }
      </Tooltip>
    );
  }

  const status = provisioning.slack.status;
  const timestamp = formatTimestamp(
    provisioning.slack.fullMemberAt ||
    provisioning.slack.joinedAt ||
    provisioning.slack.inviteConfirmedAt
  );
  return <Tooltip title={slackLabel(provisioning.slack, timestamp)}>{statusIcon(status)}</Tooltip>;
};

const driveLabel = (googleDrive: MemberProvisioning['googleDrive']) => {
  const label = DRIVE_LABELS[googleDrive.status];
  return googleDrive.status === 'permanently_failed' && googleDrive.provisioningBlockedReason
    ? `${label}: ${googleDrive.provisioningBlockedReason}`
    : label;
};

export const DriveProvisioningIcon: React.FC<{ provisioning: MemberProvisioning }> = ({ provisioning }) => {
  const status = provisioning.googleDrive.status;
  return <Tooltip title={driveLabel(provisioning.googleDrive)}>{statusIcon(status)}</Tooltip>;
};

export const ProvisioningStatusChip: React.FC<{
  kind: 'slack' | 'drive';
  provisioning: MemberProvisioning;
}> = ({ kind, provisioning }) => {
  const status = kind === 'slack'
    ? provisioning.slack.status
    : provisioning.googleDrive.status;
  const label = kind === 'slack' ? SLACK_LABELS[status as SlackProvisioningStatus] : driveLabel(provisioning.googleDrive);
  const tooltip = kind === 'slack' ? slackLabel(provisioning.slack) : label;
  const color = status === 'full_member' || status === 'complete'
    ? 'success'
    : status.startsWith('manual_') || status === 'failed' || status === 'blocked' || status === 'permanently_failed'
      ? 'error'
      : 'warning';

  return (
    <Tooltip title={tooltip}>
      <Chip size='small' color={color} label={label} />
    </Tooltip>
  );
};
