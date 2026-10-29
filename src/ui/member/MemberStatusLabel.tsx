import * as React from "react";
import { MemberStatus, MemberSummary } from "makerspace-ts-api-client";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";

export const memberStatusLabelMap = {
  [MemberStatus.ActiveMember]: "Active",
  [MemberStatus.Revoked]: "Revoked",
  [MemberStatus.NonMember]: "Non-Member",
  [MemberStatus.Inactive]: "Inactive"
};

type MinProps = Pick<MemberSummary, "status" | "expirationTime"> & {
  subscriptionId?: string;
  paidPendingStart?: boolean;
  // False when no fob has ever been issued. Absent from an older server, and from
  // payloads that do not carry it, in which case only a pending member counts as
  // having no fob.
  fobIssued?: boolean;
};
// Statuses the server accepts that the dropdown above does not offer (the first fob
// promotes a pending member, and suspension is rare), so they are labeled here only.
const PENDING = "pending";
const SUSPENDED = "suspended";
const FOB_NOT_ISSUED = "Fob not issued";

const MemberStatusLabel: React.FC<{ member: MinProps; id?: string }> = ({ member, id }) => {
  // A pending member has signed up but has no fob yet (the first fob makes them Active).
  // They are labeled like an active member, by their term. Whatever the stored status,
  // a member whose term is running with no fob ever issued gets "Fob not issued" added.
  const pending = member.status === PENDING;
  const suspended = member.status === SUSPENDED;
  const inactive = !pending && ![MemberStatus.ActiveMember, MemberStatus.NonMember].includes(member.status as MemberStatus);
  const current = member.expirationTime > Date.now();
  const noFob = member.fobIssued === undefined ? pending : !member.fobIssued;
  const fobMissingOnTerm = !inactive && noFob && !!member.expirationTime;

  let statusColor;
  if (suspended) {
    statusColor = Status.Danger;
  } else if (!member.expirationTime) {
    statusColor = Status.Info;
  } else if (fobMissingOnTerm && current) {
    statusColor = Status.Warn;
  } else {
    statusColor = current && !inactive ? Status.Success : Status.Danger;
  }

  let label;
  if (suspended) {
    label = "Suspended";
  } else if (inactive) {
    label = memberStatusLabelMap[member.status];
  } else {
    if (!member.expirationTime) {
      label = member.subscriptionId ? "Not started" : "N/A";
    } else {
      label = current ? "Active" : "Expired";
    }
    if (fobMissingOnTerm) {
      label = `${label} · ${FOB_NOT_ISSUED}`;
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <StatusLabel id={id} label={label} color={statusColor} />
      {member.paidPendingStart && (
        <Tooltip title="Membership paid -- pending fob registration to start the membership term">
          <Chip
            size="small"
            color="warning"
            label="Paid — Not Started"
            style={{ marginLeft: 8 }}
          />
        </Tooltip>
      )}
    </span>
  );
};

export default MemberStatusLabel;