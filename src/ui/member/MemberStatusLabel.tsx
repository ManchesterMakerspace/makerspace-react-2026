import * as React from "react";
import { MemberStatus, MemberSummary } from "makerspace-ts-api-client";
import { Status } from "ui/constants";
import StatusLabel from "ui/common/StatusLabel";
import Tooltip from "@mui/material/Tooltip";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

export const memberStatusLabelMap = {
  [MemberStatus.ActiveMember]: "Active",
  [MemberStatus.Revoked]: "Revoked",
  [MemberStatus.NonMember]: "Non-Member",
  [MemberStatus.Inactive]: "Inactive"
};

type MinProps = Pick<MemberSummary, "status" | "expirationTime"> & {
  subscriptionId?: string;
  paidPendingStart?: boolean;
};
const MemberStatusLabel: React.FC<{ member: MinProps; id?: string }> = ({ member, id }) => {
  const inactive = ![MemberStatus.ActiveMember, MemberStatus.NonMember].includes(member.status as MemberStatus);
  const current = member.expirationTime > Date.now();

  let statusColor;
  if (!member.expirationTime) {
    statusColor = Status.Info;
  } else {
    statusColor = current && !inactive ? Status.Success : Status.Danger;
  }

  let label;
  if (inactive) {
    label = memberStatusLabelMap[member.status];
  } else {
    if (!member.expirationTime) {
      label = member.subscriptionId ? "Not started" : "N/A";
    } else {
      label = current ? "Active" : "Expired";
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <StatusLabel id={id} label={label} color={statusColor} />
      {member.paidPendingStart && (
        <Tooltip title="Membership paid, pending membership start">
          <AttachMoneyIcon
            fontSize="small"
            style={{ color: "#2e7d32", verticalAlign: "middle" }}
          />
        </Tooltip>
      )}
    </span>
  );
};

export default MemberStatusLabel;