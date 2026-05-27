import * as React from "react";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import InputAdornment from "@mui/material/InputAdornment";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

import { Member } from "makerspace-ts-api-client";
import { ActionButton } from "ui/common/ButtonRow";
import FormModal from "ui/common/FormModal";
import ErrorMessage from "ui/common/ErrorMessage";
import useModal from "ui/hooks/useModal";

interface Props {
  member: Member;
}

type AdminMode = "reset" | "set";

const scorePassword = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["#f44336", "#ff9800", "#ffeb3b", "#8bc34a", "#4caf50"];

const getCsrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const AdminChangePasswordModal: React.FC<Props> = ({ member = {} as Member }) => {
  const { isOpen, openModal, closeModal } = useModal();
  const [adminMode, setAdminMode] = React.useState<AdminMode>("reset");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState<string>("");

  const strength = scorePassword(password);

  const handleClose = React.useCallback(() => {
    setAdminMode("reset");
    setPassword("");
    setConfirm("");
    setError("");
    setSuccess("");
    closeModal();
  }, [closeModal]);

  const onSubmit = React.useCallback(async () => {
    setError("");
    setSuccess("");

    if (adminMode === "reset") {
      setIsRequesting(true);
      try {
        const res = await fetch(`/api/admin/members/${member.id}/send_password_reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": getCsrfToken() },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message || "Failed to send reset email.");
        } else {
          setSuccess(`Password reset email sent to ${member.email}.`);
        }
      } catch {
        setError("An unexpected error occurred.");
      } finally {
        setIsRequesting(false);
      }
      return;
    }

    // Direct set mode
    if (!password) { setError("Password cannot be blank."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (strength < 2) { setError("Password is too weak. Try mixing uppercase, numbers, or symbols."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setIsRequesting(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/update_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": getCsrfToken() },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message || "Failed to update password.");
      } else {
        setSuccess("Password updated successfully.");
        setPassword("");
        setConfirm("");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsRequesting(false);
    }
  }, [adminMode, member, password, confirm, strength]);

  return (
    <>
      <ActionButton
        id="admin-change-password"
        color="primary"
        variant="outlined"
        disabled={!member.id}
        label="Change Password"
        onClick={openModal}
      />
      {isOpen && (
        <FormModal
          id="admin-change-password-modal"
          isOpen={true}
          title={`Change Password — ${member.firstname} ${member.lastname}`}
          closeHandler={handleClose}
          onSubmit={onSubmit}
          submitText={adminMode === "reset" ? "Send Reset Email" : "Save Password"}
          loading={isRequesting}
          error={error}
        >
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Password Reset Method</FormLabel>
                <RadioGroup
                  row
                  value={adminMode}
                  onChange={(e) => {
                    setAdminMode(e.target.value as AdminMode);
                    setError("");
                    setSuccess("");
                  }}
                >
                  <FormControlLabel
                    value="reset"
                    control={<Radio color="primary" />}
                    label="Send reset link to member"
                  />
                  <FormControlLabel
                    value="set"
                    control={<Radio color="primary" />}
                    label="Set password directly"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {adminMode === "reset" && (
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  A password reset email will be sent to <strong>{member.email}</strong>. 
                  They will receive a link to set their own new password.
                </Typography>
              </Grid>
            )}

            {adminMode === "set" && (
              <>
                <Grid item xs={12}>
                  <Typography
                    variant="body2"
                    style={{ color: "#f57c00", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    ⚠ <strong>{member.firstname} {member.lastname}</strong> will be notified by email that their password has been changed.
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    id="admin-password-input"
                    fullWidth
                    label="New Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="new-password"
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <RemoveRedEye
                            style={{ cursor: "pointer" }}
                            onClick={() => setShowPassword(v => !v)}
                          />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    id="admin-password-confirm"
                    fullWidth
                    label="Confirm New Password"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    autoComplete="new-password"
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  />
                </Grid>
                {password.length > 0 && (
                  <Grid item xs={12}>
                    <LinearProgress
                      variant="determinate"
                      value={(strength / 4) * 100}
                      style={{ height: 8, borderRadius: 4, backgroundColor: "#e0e0e0" }}
                    />
                    <Typography
                      variant="caption"
                      style={{ color: strengthColor[strength], marginTop: 4, display: "block" }}
                    >
                      {strengthLabel[strength]}
                    </Typography>
                  </Grid>
                )}
              </>
            )}

            {success && (
              <Grid item xs={12}>
                <Typography id="admin-password-success" style={{ color: "#4caf50" }}>
                  {success}
                </Typography>
              </Grid>
            )}
          </Grid>
        </FormModal>
      )}
    </>
  );
};

export default AdminChangePasswordModal;
