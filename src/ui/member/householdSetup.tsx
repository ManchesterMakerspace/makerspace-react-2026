import * as React from "react";
import Alert from "@mui/material/Alert";
import { ToastStatus, useToastContext } from "components/Toast/Toast";

// Rails flags a member (admin/board profile data only) who is billed on a household
// plan but has no household yet: `householdSetupNeeded`. It never looks at the old
// Group records, so legacy partner groups cannot trigger it.
export const needsHouseholdSetup = (member?: unknown): boolean =>
  !!(member as { householdSetupNeeded?: boolean } | undefined)?.householdSetupNeeded;

export const HOUSEHOLD_SETUP_TOAST_MESSAGE =
  "Household membership: create the household and add the second adult. Open Manage Household on this profile.";

export const HouseholdSetupBanner: React.FC<{ member?: unknown }> = ({ member }) => {
  if (!needsHouseholdSetup(member)) return null;
  return (
    <Alert id="member-household-setup-banner" severity="warning" role="status" sx={{ marginBottom: 2 }}>
      <strong>Household setup needed.</strong> This member is on a household membership plan but has no
      household yet. Choose <strong>Create Household</strong>, then <strong>Manage Household</strong> and
      <strong> Add Secondary Member</strong> for the second adult. The second adult needs an account with
      the same street address and postal code, and should not also have their own subscription.
    </Alert>
  );
};

// Shown after staff register a key fob or renew a membership, the two onboarding steps.
export const useHouseholdSetupToast = () => {
  const toast = useToastContext();
  return React.useCallback((member?: unknown) => {
    if (needsHouseholdSetup(member)) {
      toast.create({ message: HOUSEHOLD_SETUP_TOAST_MESSAGE, status: ToastStatus.Warning });
    }
  }, [toast]);
};
