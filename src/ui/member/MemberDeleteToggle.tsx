import * as React from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
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
// couldn't access their original account/email and signed up again. Removes the
// member from Slack and the Google Drive folders, sets their status to inactive,
// and frees the email for reuse, but never notifies the member. The backend
// refuses (422) if the member currently has an active, unexpired membership or a
// live subscription, or has an open invoice (unpaid, or a paid payment held for a
// fob); that message is surfaced here.
//
// If the backend could not remove the member from Slack or Drive it also answers
// 422, with manual_removal_required and the list of problems. The admin removes
// them by hand and ticks "I removed them manually" to finish; that confirmation
// is sent back and recorded in the audit log.
//
// This is NOT how you revoke a member's access. Revocation is done by
// changing their Status field on this page instead, which blocks their
// email from being reused for a new signup -- the opposite of what this
// does. This button is only for cleaning up a duplicate/abandoned account.
const MemberDeleteToggle: React.FC<Props> = (props) => {
  const { member, onUpdated } = props;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manualProblems, setManualProblems] = React.useState<string[] | null>(null);
  const [manualConfirmed, setManualConfirmed] = React.useState(false);

  const deleted = !!(member as Member & { mergedAt?: string }).mergedAt;

  const call = async (action: "soft_delete" | "restore", manualRemovalConfirmed = false) => {
    setLoading(true);
    setError(null);
    try {
      const query = manualRemovalConfirmed ? "?manual_removal_confirmed=true" : "";
      const res = await fetch(`/api/admin/members/${member.id}/${action}${query}`, {
        method: "POST",
        headers: { "X-XSRF-TOKEN": getCsrfToken() },
      });
      if (res.ok) {
        setManualProblems(null);
        setManualConfirmed(false);
        onUpdated?.();
      } else {
        const body = await res.json().catch(() => ({}));
        if (action === "soft_delete" && body?.manual_removal_required) {
          setManualProblems(Array.isArray(body.problems) ? body.problems : [body.message]);
          setManualConfirmed(false);
        } else {
          setError(body?.message || `Failed to ${action === "soft_delete" ? "delete" : "restore"} this account.`);
        }
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(
      `Delete ${member.firstname} ${member.lastname}'s account? This removes them from Slack and the Google Drive ` +
      "folders, sets their status to inactive, hides them from member lists/search and frees their email for reuse, " +
      "but keeps its history (invoices, audit log, etc.) intact. It can be restored later. The member will not be notified.\n\n" +
      "This is not how you revoke a member's access -- use the Status field for that instead, which also " +
      "blocks their email from being reused."
    )) return;
    call("soft_delete");
  };

  const handleRestore = () => {
    if (!window.confirm(`Restore ${member.firstname} ${member.lastname}'s account? They stay inactive until you reactivate them.`)) return;
    call("restore");
  };

  const closeManualDialog = () => {
    setManualProblems(null);
    setManualConfirmed(false);
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

      <Dialog open={!!manualProblems} onClose={closeManualDialog} aria-labelledby="manual-removal-title">
        <DialogTitle id="manual-removal-title">Remove them by hand first</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            {member.firstname} {member.lastname} could not be removed from everything automatically:
          </Typography>
          <ul id="manual-removal-problems">
            {(manualProblems || []).map(problem => <li key={problem}><Typography variant="body2">{problem}</Typography></li>)}
          </ul>
          <Typography variant="body2" gutterBottom>
            Remove them yourself in Slack and Google Drive, then confirm below to finish deleting the account. The account
            stays visible until you do.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                id="manual-removal-confirmed"
                color="primary"
                checked={manualConfirmed}
                onChange={e => setManualConfirmed(e.target.checked)}
              />
            }
            label="I removed them manually"
          />
        </DialogContent>
        <DialogActions>
          <Button id="manual-removal-cancel" onClick={closeManualDialog}>Cancel</Button>
          <Button
            id="manual-removal-delete"
            color="error"
            variant="contained"
            disabled={!manualConfirmed || loading}
            onClick={() => call("soft_delete", true)}
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>

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
