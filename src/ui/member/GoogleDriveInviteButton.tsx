import * as React from "react";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Snackbar from "@material-ui/core/Snackbar";
import { Member } from "makerspace-ts-api-client";

// Google "G" logo SVG — official brand colors
const GoogleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

interface Props {
  member: Member;
}

const GoogleDriveInviteButton: React.FC<Props> = ({ member }) => {
  const [loading,  setLoading]  = React.useState(false);
  const [success,  setSuccess]  = React.useState(false);
  const [error,    setError]    = React.useState<string | null>(null);

  const handleInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/invite_google_drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || "Failed to send Drive invite.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title={`Re-send Google Drive invite to ${member.email}`}>
        <span>
          <Button
            key="google-drive-invite"
            variant="outlined"
            disabled={loading}
            onClick={handleInvite}
            style={{ marginRight: ".25em" }}
            startIcon={loading
              ? <CircularProgress size={16} />
              : <GoogleIcon />
            }
          >
            Drive
          </Button>
        </span>
      </Tooltip>

      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        message={`Google Drive invite sent to ${member.email}`}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

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

export default GoogleDriveInviteButton;
