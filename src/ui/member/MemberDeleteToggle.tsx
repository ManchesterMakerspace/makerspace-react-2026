import * as React from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import { Member } from "makerspace-ts-api-client";

interface Props {
  member: Member;
  onUpdated?: () => void;
}

const getCsrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

// Soft-deletes ("ghosts") a duplicate/abandoned account -- for a member who
// couldn't access their original account/email and signed up again. Revokes
// access and frees the email for reuse, but never notifies the member. The
// backend refuses (422) if the member currently has an active, unexpired
// membership or a live subscription; that message is surfaced here.
//
// This is NOT how you revoke a member's access. Revocation is done by
// changing their Status field on this page instead, which blocks their
// email from being reused for a new signup -- the opposite of what this
// does. This button is only for cleaning up a duplicate/abandoned account.
const MemberDeleteToggle: React.FC<Props> = (props) => {
  const { member, onUpdated } = props;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const deleted = !!(member as Member & { mergedAt?: string }).mergedAt;

  const call = async (action: "soft_delete" | "restore") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/${action}`, {
        method: "POST",
        headers: { "X-XSRF-TOKEN": getCsrfToken() },
      });
      if (res.ok) {
        onUpdated?.();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || `Failed to ${action === "soft_delete" ? "delete" : "restore"} this account.`);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(
      `Delete ${member.firstname} ${member.lastname}'s account? This hides it from member lists/search and ` +
      "frees their email for reuse, but keeps its history (invoices, audit log, etc.) intact. It can be " +
      "restored later. The member will not be notified.\n\n" +
      "This is not how you revoke a member's access -- use the Status field for that instead, which also " +
      "blocks their email from being reused."
    )) return;
    call("soft_delete");
  };

  const handleRestore = () => {
    if (!window.confirm(`Restore ${member.firstname} ${member.lastname}'s account?`)) return;
    call("restore");
  };

  return (
    <>
      <Tooltip title={deleted
        ? "Un-delete this account so it appears in member lists/search again"
        : "Mark this account as deleted -- for a duplicate/abandoned signup, not for revoking a real member's access (use Status for that)"
      }>
        <span>
          <Button
            id="member-detail-delete-toggle"
            variant="outlined"
            color={deleted ? "primary" : "error"}
            disabled={loading}
            onClick={deleted ? handleRestore : handleDelete}
            style={{ marginRight: ".25em" }}
            startIcon={loading ? <CircularProgress size={16} /> : (deleted ? <RestoreIcon /> : <DeleteIcon />)}
          >
            {deleted ? "Restore Account" : "Delete Account"}
          </Button>
        </span>
      </Tooltip>

      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={() => setError(null)}
        message={error}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
};

export default MemberDeleteToggle;
