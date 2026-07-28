import * as React from "react";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { ReservationApprovalDetail } from "app/entities/reservation";

interface ApprovalDetailsProps {
  details?: ReservationApprovalDetail[];
  compact?: boolean;
}

const ApprovalDetails: React.FC<ApprovalDetailsProps> = (props) => {
  const details: ReservationApprovalDetail[] = props.details || [];
  const compact = props.compact || false;
  if (!details.length) return null;
  const content = (
    <>
      {!compact && <strong>Approval required because:</strong>}
      {details.map((detail, index) => (
        <Typography key={`${detail.code}-${detail.blackoutId || index}`} variant="body2">
          {compact ? "" : "• "}{detail.message}
        </Typography>
      ))}
    </>
  );
  return compact
    ? <div style={{ marginTop: 4 }}>{content}</div>
    : <Alert severity="warning" style={{ marginTop: 6 }}>{content}</Alert>;
};

export default ApprovalDetails;
