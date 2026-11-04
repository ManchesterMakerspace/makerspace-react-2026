import * as React from "react";
import {
  Alert, Box, Button, CircularProgress, List, ListItem, ListItemText, Paper, Step, StepLabel, Stepper, TextField, Typography,
} from "@mui/material";

import {
  getHousehold, HouseholdState, inviteToHousehold, resendHouseholdInvitation, revokeHouseholdInvitation,
} from "api/household";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { timeToDate } from "ui/utils/timeToDate";

export const COME_IN_MESSAGE =
  "Each adult has to come to the makerspace in person and bring a photo ID that shows their name and address. " +
  "A fob cannot be issued to someone who is not there.";

export const UNPAID_MESSAGE =
  "The household payment is not currently accepted, so this household membership is not paid. " +
  "Access ends when the paid time runs out, and it comes back by itself when a payment goes through.";

const formatDate = (value?: string | null) => value ? timeToDate(new Date(value).getTime()) : "";

// 0 Pay, 1 Invite, 2 They join, 3 Come in together, 4 Done
export const householdStep = (state: HouseholdState): number => {
  const household = state.household;
  const paid = household ? household.payment_accepted : state.can_invite;
  if (!paid) return 0;
  const hasMembers = !!household && household.members.length > 0;
  const hasInvitations = !!household && (household.invitations || []).length > 0;
  if (!hasMembers && !hasInvitations) return 1;
  if (!hasMembers) return 2;
  const everyoneHasAFob = !!household && !!household.primary?.fob_issued && household.members.every(member => member.fob_issued);
  return everyoneHasAFob ? 4 : 3;
};

export const HouseholdCardView: React.FC<{
  state: HouseholdState;
  email: string;
  onEmail: (value: string) => void;
  onInvite: () => void;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  busy: boolean;
  error?: string;
}> = ({ state, email, onEmail, onInvite, onResend, onRevoke, busy, error }) => {
  const household = state.household;
  const isPrimary = state.role === "primary" || (!state.role && state.household_plan);
  const isSecondary = state.role === "secondary";
  const unpaid = !!household && !household.payment_accepted;
  const invitations = household?.invitations || [];

  if (isSecondary && household) {
    return <Paper component="section" aria-labelledby="household-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="household-title" component="h2" variant="h6" sx={{ mb: 1 }}>Your household</Typography>
      <Typography sx={{ mb: 2 }}>
        You are part of <strong>{household.display_name}</strong>. Your membership follows theirs, at no charge to you.
      </Typography>
      {unpaid && <Alert severity="warning" sx={{ mb: 2 }}>{UNPAID_MESSAGE}</Alert>}
      {!unpaid && !household.members.find(member => member.fob_issued) && <Alert severity="info">{COME_IN_MESSAGE}</Alert>}
    </Paper>;
  }

  if (!isPrimary && state.invited_to_a_household) {
    return <Paper component="section" aria-labelledby="household-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="household-title" component="h2" variant="h6" sx={{ mb: 1 }}>Household invitation</Typography>
      <Typography>
        You have been invited to join a household membership. Open the link in the invitation email to join. {COME_IN_MESSAGE}
      </Typography>
    </Paper>;
  }

  if (!isPrimary) return null;

  const step = householdStep(state);
  const size = household?.size ?? state.plan_size ?? 2;
  const used = household?.seats_used ?? 1;

  return <Paper component="section" aria-labelledby="household-title" sx={{ p: { xs: 2, sm: 3 } }}>
    <Typography id="household-title" component="h2" variant="h6" sx={{ mb: 1 }}>Your household</Typography>
    <Typography sx={{ mb: 2 }}>
      Your plan covers up to <strong>{size} adults</strong> ({used} of {size} used). {size > 1 ? "Invite the other adult here and they join for free." : ""}
    </Typography>

    <Stepper activeStep={step} orientation="vertical" sx={{ mb: 2 }}>
      {["Pay for the household plan", "Invite your second adult", "They register and join", "Come in together with photo ID"].map(label =>
        <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
    </Stepper>

    {unpaid && <Alert severity="warning" sx={{ mb: 2 }}>{UNPAID_MESSAGE}</Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    {state.can_invite ? <Box component="form" onSubmit={(event: React.FormEvent) => { event.preventDefault(); onInvite(); }} sx={{ mb: 2 }}>
      <TextField
        label="Second adult's email" type="email" size="small" fullWidth required value={email}
        onChange={event => onEmail(event.target.value)} disabled={busy}
        helperText="They must sign in with exactly this email to join. The address on their account must match yours."
      />
      <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={busy || !email.trim()}>
        {busy ? <CircularProgress size={18} /> : "Send invitation"}
      </Button>
    </Box> : state.invite_blocked_reason ? <Alert severity="info" sx={{ mb: 2 }}>{state.invite_blocked_reason}</Alert> : null}

    {invitations.length > 0 && <>
      <Typography variant="subtitle2">Open invitations</Typography>
      <List dense>
        {invitations.map(invitation => <ListItem key={invitation.id} disableGutters
          secondaryAction={<>
            <Button size="small" disabled={busy || unpaid} onClick={() => onResend(invitation.id)}>Resend</Button>
            <Button size="small" color="error" disabled={busy} onClick={() => onRevoke(invitation.id)}>Cancel</Button>
          </>}>
          <ListItemText
            primary={invitation.email}
            secondary={invitation.status === "expired" ? `Expired ${formatDate(invitation.expires_at)}. Resend to send a new link.`
              : `Waiting for them to join. The link works until ${formatDate(invitation.expires_at)}.`}
          />
        </ListItem>)}
      </List>
    </>}

    {household && household.members.length > 0 && <>
      <Typography variant="subtitle2">In your household</Typography>
      <List dense>
        {household.members.map(member => <ListItem key={member.id} disableGutters>
          <ListItemText primary={member.name} secondary={member.fob_issued ? "Has a fob" : "Needs a fob: come in with photo ID"} />
        </ListItem>)}
      </List>
    </>}

    <Alert severity="info" sx={{ mt: 1 }}>{COME_IN_MESSAGE}</Alert>
  </Paper>;
};

const HouseholdCard: React.FC = () => {
  const { data, isRequesting, error, refresh } = useReadTransaction(getHousehold, {}, false, "member-household", true, true);
  const [email, setEmail] = React.useState("");
  const [actionError, setActionError] = React.useState("");

  const done = React.useCallback(() => { setActionError(""); refresh(); }, [refresh]);
  const invite = useWriteTransaction(inviteToHousehold, () => { setEmail(""); done(); });
  const resend = useWriteTransaction(resendHouseholdInvitation, done);
  const revoke = useWriteTransaction(revokeHouseholdInvitation, done);
  const busy = invite.isRequesting || resend.isRequesting || revoke.isRequesting;

  React.useEffect(() => { setActionError(invite.error || resend.error || revoke.error || ""); }, [invite.error, resend.error, revoke.error]);

  if (isRequesting && !data) return <CircularProgress aria-label="Loading household" size={24} />;
  if (error && !data) return null;
  if (!data) return null;

  return <HouseholdCardView
    state={data}
    email={email}
    onEmail={setEmail}
    onInvite={() => invite.call({ email: email.trim() })}
    onResend={id => resend.call({ id })}
    onRevoke={id => revoke.call({ id })}
    busy={busy}
    error={actionError}
  />;
};

export default HouseholdCard;
