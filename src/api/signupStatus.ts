export interface SignupStatus {
  locked: boolean;
}

/**
 * Checks whether new-member signup is currently locked for maintenance.
 * Public, unauthenticated endpoint — safe to call from the landing/signup
 * routes before a visitor has an account.
 * Fails "open" (locked: false) on network error so a transient failure
 * doesn't block signups outright; the backend still enforces the lockout
 * on submission regardless of what this check reports.
 */
export const getSignupStatus = async (): Promise<SignupStatus> => {
  try {
    const response = await fetch('/api/signup_status', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      return { locked: false };
    }
    return await response.json() as SignupStatus;
  } catch {
    return { locked: false };
  }
};
