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
  };
  googleDrive: {
    status: GoogleDriveProvisioningStatus;
    resourcesAccessConfirmedAt?: string | null;
    transferAccessConfirmedAt?: string | null;
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
  if (status.startsWith('manual_') || status === 'failed' || status === 'not_invited' || status === 'blocked') {
    return <ErrorIcon fontSize='small' color='error' style={{ verticalAlign: 'middle' }} />;
  }
  if (status === 'invite_pending' || status === 'guest' || status === 'pending_activation' || status === 'partial') {
    return <HourglassTopIcon fontSize='small' color='warning' style={{ verticalAlign: 'middle' }} />;
  }
  return <InfoOutlined fontSize='small' color='disabled' style={{ verticalAlign: 'middle' }} />;
};

const formatTimestamp = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : undefined;

export const SlackProvisioningIcon: React.FC<{
  provisioning?: MemberProvisioning;
  fallbackLinkedName?: string;
}> = (props) => {
  const { provisioning, fallbackLinkedName } = props;
  if (!provisioning) {
    return (
      <Tooltip title={fallbackLinkedName ? `Slack linked: ${fallbackLinkedName}` : 'No Slack account linked'}>
        {fallbackLinkedName
          ? <CheckCircleIcon fontSize='small' style={{ color: '#4caf50', verticalAlign: 'middle' }} />
          : <ErrorIcon fontSize='small' style={{ color: '#ff9800', verticalAlign: 'middle' }} />
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
  const label = `${SLACK_LABELS[status]}${timestamp ? ` (${timestamp})` : ''}`;
  return <Tooltip title={label}>{statusIcon(status)}</Tooltip>;
};

export const DriveProvisioningIcon: React.FC<{ provisioning: MemberProvisioning }> = ({ provisioning }) => {
  const status = provisioning.googleDrive.status;
  return <Tooltip title={DRIVE_LABELS[status]}>{statusIcon(status)}</Tooltip>;
};

export const ProvisioningStatusChip: React.FC<{
  kind: 'slack' | 'drive';
  provisioning: MemberProvisioning;
}> = ({ kind, provisioning }) => {
  const status = kind === 'slack'
    ? provisioning.slack.status
    : provisioning.googleDrive.status;
  const label = kind === 'slack' ? SLACK_LABELS[status as SlackProvisioningStatus] : DRIVE_LABELS[status as GoogleDriveProvisioningStatus];
  const color = status === 'full_member' || status === 'complete'
    ? 'success'
    : status.startsWith('manual_') || status === 'failed' || status === 'blocked'
      ? 'error'
      : 'warning';

  return (
    <Tooltip title={label}>
      <Chip size='small' color={color} label={label} />
    </Tooltip>
  );
};
