import * as React from "react";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";

import ErrorMessage from "ui/common/ErrorMessage";
import { useAuthState } from "ui/reducer/hooks";
import { useCapabilities } from "app/permissions";
import { PasswordStrength, PasswordStrengthProfile, validatePasswordStrength } from "components/Form/inputs/PasswordStrength";

interface Props {
  // The member whose password is being changed.
  // For self-service this is the logged-in member; for admin this is the selected member.
  memberId: string;
  memberEmail?: string;
  memberFirstname?: string;
  memberLastname?: string;
  memberCity?: string;
  memberAddress?: string;
}

type AdminMode = "set" | "reset";

const ChangePasswordForm: React.FC<Props> = ({ memberId, memberEmail, memberFirstname, memberLastname, memberCity, memberAddress }) => {
  const { currentUser: { id: currentUserId } } = useAuthState();
  const { canChangeOtherPasswords: isAdmin } = useCapabilities();
  const isOwnPassword = currentUserId === memberId;

  const [adminMode, setAdminMode] = React.useState<AdminMode>("reset");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState<string>("");

  const passwordProfile = React.useMemo<PasswordStrengthProfile>(() => ({
    firstname: memberFirstname,
    lastname: memberLastname,
    city: memberCity,
    address: memberAddress,
    email: memberEmail,
  }), [memberFirstname, memberLastname, memberCity, memberAddress, memberEmail]);

  const validate = (): string | null => {
    if (!password) return "Password cannot be blank.";
    const strengthError = validatePasswordStrength(password, passwordProfile);
    if (strengthError) return strengthError;
    if (password !== confirm) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    // Admin sending a reset link — no password fields needed
    if (isAdmin && !isOwnPassword && adminMode === "reset") {
      setIsRequesting(true);
      try {
        const res = await fetch(`/api/admin/members/${memberId}/send_password_reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": getCsrfToken() },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message || "Failed to send reset email.");
        } else {
          setSuccess(`Password reset email sent to ${memberEmail || "the member"}.`);
        }
      } catch (e) {
        setError("An unexpected error occurred.");
      } finally {
        setIsRequesting(false);
      }
      return;
    }

    // Direct password set (admin or self-service)
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsRequesting(true);
    try {
      const url = isAdmin && !isOwnPassword
        ? `/api/admin/members/${memberId}/update_password`
        : `/api/members/change_password`;
      const method = isAdmin && !isOwnPassword ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
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
    } catch (e) {
      setError("An unexpected error occurred.");
    } finally {
      setIsRequesting(false);
    }
  };

  const showPasswordFields = isOwnPassword || (isAdmin && adminMode === "set");

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h6" gutterBottom>
          {isOwnPassword ? "Change Password" : `Change Password for ${memberEmail || "Member"}`}
        </Typography>
      </Grid>

      {/* Admin-only: choose between sending a reset link or setting directly */}
      {isAdmin && !isOwnPassword && (
        <Grid size={{ xs: 12 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Password Reset Method</FormLabel>
            <RadioGroup
              row
              value={adminMode}
              onChange={(e) => { setAdminMode(e.target.value as AdminMode); setError(""); setSuccess(""); }}
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
      )}

      {/* Password fields — shown for self-service and admin "set" mode */}
      {showPasswordFields && (
        <>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="change-password-input"
              fullWidth
              label="New Password"
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="new-password"
              onChange={(e) => { setPassword(e.target.value); setError(""); setSuccess(""); }}
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
              id="change-password-confirm"
              fullWidth
              label="Confirm New Password"
              type={showPassword ? "text" : "password"}
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => { setConfirm(e.target.value); setError(""); setSuccess(""); }}
            />
          </Grid>

          {/* Strength meter */}
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

      {/* Reset link mode — just a confirmation description */}
      {isAdmin && !isOwnPassword && adminMode === "reset" && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="textSecondary">
            A password reset email will be sent to <strong>{memberEmail || "the member's email on file"}</strong>. 
            They will receive a link to set their own new password.
          </Typography>
        </Grid>
      )}

      {/* Feedback */}
      {error && (
        <Grid size={{ xs: 12 }}>
          <ErrorMessage id="change-password-error" error={error} />
        </Grid>
      )}
      {success && (
        <Grid size={{ xs: 12 }}>
          <Typography id="change-password-success" style={{ color: "#4caf50" }}>
            {success}
          </Typography>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Button
          id="change-password-submit"
          variant="contained"
          color="primary"
          disabled={isRequesting}
          onClick={handleSubmit}
        >
          {isRequesting
            ? "Saving..."
            : isAdmin && !isOwnPassword && adminMode === "reset"
            ? "Send Reset Email"
            : "Save Password"}
        </Button>
      </Grid>
    </Grid>
  );
};

// Pull the CSRF token from the cookie set by Rails
const getCsrfToken = (): string => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

export default ChangePasswordForm;
