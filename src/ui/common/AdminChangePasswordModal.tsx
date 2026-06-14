import * as React from "react";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
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
import useModal from "ui/hooks/useModal";
import { PasswordStrength, PasswordStrengthProfile, validatePasswordStrength } from "components/Form/inputs/PasswordStrength";
import { apiErrorMessage } from "ui/common/apiErrors";

interface Props {
  member: Member;
}

type AdminMode = "reset" | "set";

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

  const passwordProfile = React.useMemo<PasswordStrengthProfile>(() => ({
    firstname: member.firstname,
    lastname: member.lastname,
    city: member.address?.city,
    address: member.address?.street,
    email: member.email,
  }), [member]);

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
          setError(apiErrorMessage(body, "Failed to send reset email."));
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
    const strengthError = validatePasswordStrength(password, passwordProfile);
    if (strengthError) { setError(strengthError); return; }
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
        setError(apiErrorMessage(body, "Failed to update password."));
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
  }, [adminMode, member, password, confirm, passwordProfile]);

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
            <Grid size={{ xs: 12 }}>
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
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="textSecondary">
                  A password reset email will be sent to <strong>{member.email}</strong>. 
                  They will receive a link to set their own new password.
                </Typography>
              </Grid>
            )}

            {adminMode === "set" && (
              <>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="textSecondary">
                    The member will receive an email notifying them that their password has been changed. If you do not want them notified, use the <strong>Send reset link</strong> option instead.
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="admin-password-input"
                    fullWidth
                    label="New Password"
                    helperText="Min 8 characters — include uppercase, a number, and a symbol"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="new-password"
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <RemoveRedEye
                              style={{ cursor: "pointer" }}
                              onClick={() => setShowPassword(v => !v)}
                            />
                          </InputAdornment>
                        )
                      }
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
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
                <Grid size={{ xs: 12 }}>
                  <PasswordStrength
                    password={password}
                    profile={passwordProfile}
                    progressStyle={{ height: 8, borderRadius: 4 }}
                    useTypography
                  />
                </Grid>
              </>
            )}

            {success && (
              <Grid size={{ xs: 12 }}>
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
