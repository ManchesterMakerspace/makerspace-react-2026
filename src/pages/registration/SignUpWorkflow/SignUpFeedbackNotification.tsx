import * as React from "react";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import {
  FeedbackSeverity,
  useDisplayedFeedback,
} from "components/Feedback/DisplayedFeedback";

export const SIGNUP_FEEDBACK_AUTO_DISMISS_MS = 10_000;

export const SignUpFeedbackNotification: React.FC = () => {
  const { messages } = useDisplayedFeedback();
  const signature = React.useMemo(
    () => messages.map(({ severity, message }) => `${severity}:${message}`).join("|"),
    [messages]
  );
  const dismissedSignature = React.useRef("");
  const [open, setOpen] = React.useState(false);

  const dismiss = React.useCallback(() => {
    dismissedSignature.current = signature;
    setOpen(false);
  }, [signature]);

  React.useEffect(() => {
    if (!signature) {
      dismissedSignature.current = "";
      setOpen(false);
    } else if (signature !== dismissedSignature.current) {
      setOpen(true);
    }
  }, [signature]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(dismiss, SIGNUP_FEEDBACK_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [open, signature, dismiss]);

  if (!open || !messages.length) {
    return null;
  }

  return (
    <div
      className="signup-feedback-backdrop"
      data-testid="signup-feedback-backdrop"
      onClick={dismiss}
    >
      <section
        aria-labelledby="signup-feedback-title"
        aria-modal="true"
        className="signup-feedback-notification"
        data-testid="signup-feedback-notification"
        onClick={event => event.stopPropagation()}
        role="alertdialog"
      >
        <div className="signup-feedback-header">
          <Typography id="signup-feedback-title" variant="h6">
            Please review
          </Typography>
          <IconButton
            aria-label="Close signup messages"
            onClick={dismiss}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <ul className="signup-feedback-list">
          {messages.map(({ severity, message }) => (
            <li
              className={`signup-feedback-item signup-feedback-item-${severity}`}
              key={`${severity}:${message}`}
            >
              {severity === FeedbackSeverity.Error ? (
                <ErrorIcon color="error" fontSize="small" />
              ) : (
                <WarningAmberIcon color="warning" fontSize="small" />
              )}
              <Typography variant="body2">{message}</Typography>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
