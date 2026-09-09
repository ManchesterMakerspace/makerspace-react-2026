import * as React from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import BlockIcon from "@mui/icons-material/Block";
import { Member } from "makerspace-ts-api-client";
import { MemberProvisioning } from "ui/member/ProvisioningStatus";

interface Props {
  member: Member;
  onUpdated?: () => void;
}

// Admin-settable on/off toggle for Service::MemberProvisioning's automatic
// Google Drive retry -- distinct from the "Drive" button, which forces an
// actual provisioning attempt. This only flips the flag, no API call to
// Google, so it works even for a member who has never been attempted yet.
const GoogleDriveProvisioningBlockToggle: React.FC<Props> = (props) => {
  const { member, onUpdated } = props;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const getCsrfToken = (): string => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const provisioning = (member as Member & { provisioning?: MemberProvisioning }).provisioning;
  const blocked = provisioning?.googleDrive.status === "permanently_failed";

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": getCsrfToken(),
        },
        body: JSON.stringify({ googleDriveProvisioningBlocked: !blocked }),
      });
      if (res.ok) {
        onUpdated?.();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || "Failed to update Google Drive provisioning block.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={blocked
        ? "Google Drive provisioning is manually blocked for this member — click to allow automatic retries again"
        : "Stop automatic Google Drive provisioning attempts for this member without deleting existing access"
      }>
        <span>
          <Button
            id="google-drive-provisioning-block-toggle"
            variant="outlined"
            color={blocked ? "warning" : "inherit"}
            disabled={loading}
            onClick={handleToggle}
            style={{ marginRight: ".25em" }}
            startIcon={loading ? <CircularProgress size={16} /> : <BlockIcon />}
          >
            {blocked ? "Unblock Drive" : "Block Drive"}
          </Button>
        </span>
      </Tooltip>

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        message={error}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
};

export default GoogleDriveProvisioningBlockToggle;
