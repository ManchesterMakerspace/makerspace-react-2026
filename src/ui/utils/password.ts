import isString from "lodash-es/isString";

const repeatingSequenceRegex = /(.)\1{3,}/;

export const scorePassword = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (!isString(value)) return `${value}`;
  return value.trim().toLowerCase();
};

export const validatePassword = (
  password: string,
  compareValues: Array<unknown> = []
): string | undefined => {
  if (!password) return "Password cannot be blank.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (scorePassword(password) < 2) {
    return "Password is too weak. Try mixing uppercase, numbers, or symbols.";
  }

  const normalizedPassword = normalizeValue(password);
  const guessableMatch = compareValues.some((value) => normalizeValue(value) === normalizedPassword);
  if (guessableMatch) {
    return "Password is guessable.";
  }

  if (repeatingSequenceRegex.test(password.toLowerCase())) {
    return "Password is guessable.";
  }

  return undefined;
};
