import * as React from "react";

import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export interface PasswordStrengthProfile {
  firstname?: string;
  lastname?: string;
  city?: string;
  address?: string;
  email?: string;
}

export interface PasswordValidationResult {
  score: number;
  label: string;
  color: string;
  isGuessable: boolean;
  error?: string;
}

interface Props {
  password: string;
  profile?: PasswordStrengthProfile;
  progressStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  useTypography?: boolean;
}

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
// Theme color paths, weakest to strongest -- the same reds, oranges and greens as every other status.
const strengthColor = ["error.main", "warning.main", "warning.light", "success.light", "success.main"];

const normalize = (value?: string): string => (value || "").trim().toLowerCase();

const emailLocalPart = (email?: string): string => normalize(email).split("@")[0] || "";

const profileValues = (profile?: PasswordStrengthProfile): string[] => {
  if (!profile) return [];

  return [
    profile.firstname,
    profile.lastname,
    profile.city,
    profile.address,
    profile.email,
    emailLocalPart(profile.email),
  ]
    .map(normalize)
    .filter(Boolean);
};

export const isGuessablePassword = (password: string, profile?: PasswordStrengthProfile): boolean => {
  const normalizedPassword = normalize(password);
  if (!normalizedPassword) return false;

  const normalizedEmail = normalize(profile?.email);
  if (normalizedEmail && normalizedPassword.includes(normalizedEmail)) return true;

  return profileValues(profile).some(value => (
    normalizedPassword === value || value.includes(normalizedPassword)
  ));
};

export const scorePassword = (password: string, profile?: PasswordStrengthProfile): number => {
  if (!password) return 0;
  if (isGuessablePassword(password, profile)) return 1;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
};

export const validatePasswordStrength = (password: string, profile?: PasswordStrengthProfile): string | undefined => {
  if (!password) return "Password cannot be blank.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (isGuessablePassword(password, profile)) return "Guessable";
  if (scorePassword(password, profile) < 2) return "Password is too weak. Try mixing uppercase, numbers, or symbols.";
  return undefined;
};

export const getPasswordStrength = (password: string, profile?: PasswordStrengthProfile): PasswordValidationResult => {
  const isGuessable = isGuessablePassword(password, profile);
  const score = scorePassword(password, profile);

  return {
    score,
    label: isGuessable ? "Guessable" : strengthLabel[score],
    color: isGuessable ? strengthColor[1] : strengthColor[score],
    isGuessable,
    error: validatePasswordStrength(password, profile),
  };
};

export const PasswordStrength: React.FC<Props> = ({
  password,
  profile,
  progressStyle,
  labelStyle,
  useTypography = false,
}) => {
  if (!password) return null;

  const strength = getPasswordStrength(password, profile);
  const labelSx = { color: strength.color, mt: 0.5, display: "block", fontSize: "0.75rem" } as const;

  return (
    <>
      <LinearProgress
        variant="determinate"
        value={(strength.score / 4) * 100}
        sx={{ mt: 1, backgroundColor: "grey.300" }}
        style={progressStyle}
      />
      {useTypography ? (
        <Typography variant="caption" sx={labelSx} style={labelStyle}>
          {strength.label}
        </Typography>
      ) : (
        <Box component="span" sx={labelSx} style={labelStyle}>{strength.label}</Box>
      )}
    </>
  );
};
