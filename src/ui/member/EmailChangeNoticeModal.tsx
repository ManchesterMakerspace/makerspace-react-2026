import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import Button from "@mui/material/Button";

interface EmailChangeNoticeModalProps {
  open: boolean;
  onClose: () => void;
}

// Shown after a member changes their own email address. As of the fix in
// PR #75, email changes no longer automatically trigger Slack/Google Drive
// invites (this was being abused to generate repeat invites by repeatedly
// changing email). That means a member who legitimately changes their email
// now needs a board member to manually re-invite them under the new
// address — this modal makes that follow-up step explicit rather than
// leaving it to be silently forgotten.
const EmailChangeNoticeModal: React.FC<EmailChangeNoticeModalProps> = ({ open, onClose }) => (
  <Dialog
    id="email-change-notice-modal"
    open={open}
    onClose={onClose}
    aria-labelledby="email-change-notice-title"
  >
    <DialogTitle id="email-change-notice-title">Email Updated</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Contact a board member to process a new Slack/Google Drive invite for your new email address.
      </DialogContentText>
      <DialogContentText style={{ marginTop: 12 }}>
        Your previous Slack account link has been permanently deactivated and will not reconnect
        automatically, even if you change your email back — a board member will need to send a fresh
        invite under the new address.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button
        id="email-change-notice-ok"
        onClick={onClose}
        color="primary"
        variant="contained"
        autoFocus
      >
        OK
      </Button>
    </DialogActions>
  </Dialog>
);

export default EmailChangeNoticeModal;
