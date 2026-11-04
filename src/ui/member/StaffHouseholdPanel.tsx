import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

import { getStaffHousehold, StaffHousehold } from "api/household";
import useReadTransaction from "ui/hooks/useReadTransaction";

// What staff should do next for this household, in plain words.
export const householdNextStep = (household: StaffHousehold): string => {
  const primary = household.primaryMember;
  const secondaries = household.secondaryMembers || [];
  const invitations = household.invitations || [];

  if (!household.paymentAccepted) {
    return "The household payment is not accepted. Do not issue new fobs until it is paid or the board approves.";
  }
  if (primary && primary.fobIssued === false) {
    return `Issue a fob to ${primary.firstname} ${primary.lastname} once they are here with photo ID.`;
  }
  const needsFob = secondaries.find(member => member.fobIssued === false);
  if (needsFob) {
    return `Issue a fob to ${needsFob.firstname} ${needsFob.lastname}. They must be here in person with photo ID.`;
  }
  if (secondaries.length === 0 && invitations.length > 0) {
    return "Waiting for the second adult to accept the invitation emailed by the primary member.";
  }
  if (secondaries.length === 0) {
    return "No second adult yet. The primary member can invite them from their home page.";
  }
  return "Nothing to do: everyone in the household has joined and has a fob.";
};

const yesNo = (value?: boolean) => value === undefined ? "Unknown" : value ? "Yes" : "No";

export const StaffHouseholdPanelView: React.FC<{ household: StaffHousehold }> = ({ household }) => {
  const people = [
    ...(household.primaryMember ? [{ ...household.primaryMember, role: "Primary" }] : []),
    ...(household.secondaryMembers || []).map(member => ({ ...member, role: "Secondary" })),
  ];
  const invitations = household.invitations || [];

  return (
    <Box id="staff-household-panel" sx={{ mt: 1 }}>
      <Typography variant="body2">
        Covers up to {household.size} adults ({household.seatsUsed} of {household.size} used, counting open invitations).
      </Typography>
      {!household.paymentAccepted && (
        <Alert id="staff-household-unpaid" severity="warning" sx={{ my: 1 }}>
          Unpaid. The household payment was reversed or never accepted. Everyone in the household has the same paid time, and it ends when that runs out.
        </Alert>
      )}
      <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", my: 1, "& td, & th": { textAlign: "left", pr: 2, py: 0.5 } }}>
        <thead>
          <tr><th>Who</th><th>Role</th><th>Registered</th><th>Paid</th><th>Fob issued</th></tr>
        </thead>
        <tbody>
          {people.map(person => (
            <tr key={person.id}>
              <td>{person.firstname} {person.lastname}</td>
              <td>{person.role}</td>
              <td>Yes</td>
              <td>{household.paymentAccepted ? "Yes" : "No"}</td>
              <td>{yesNo(person.fobIssued)}</td>
            </tr>
          ))}
          {invitations.map(invitation => (
            <tr key={invitation.id}>
              <td>{invitation.email}</td>
              <td>Secondary</td>
              <td>{invitation.status === "expired" ? "Invitation expired" : "Invited, not joined"}</td>
              <td>No</td>
              <td>No</td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Typography id="staff-household-next-step" variant="body2"><strong>Next:</strong> {householdNextStep(household)}</Typography>
    </Box>
  );
};

const StaffHouseholdPanel: React.FC<{ memberId: string }> = ({ memberId }) => {
  const { data, isRequesting, error } = useReadTransaction(getStaffHousehold, { memberId }, !memberId, `staff-household-${memberId}`, true);
  if (isRequesting && !data) return <CircularProgress size={18} aria-label="Loading household" />;
  if (error || !data) return null;
  return <StaffHouseholdPanelView household={data} />;
};

export default StaffHouseholdPanel;
