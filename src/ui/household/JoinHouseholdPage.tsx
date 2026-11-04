import * as React from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";

import {
  acceptHouseholdInvitation, getHouseholdInvitationPublic, HouseholdInvitationPublic, HouseholdInvitationPreview,
  previewHouseholdInvitation,
} from "api/household";
import { Routing } from "app/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { useAuthState } from "ui/reducer/hooks";
import { buildProfileRouting } from "ui/member/utils";
import { COME_IN_MESSAGE } from "./HouseholdCard";

const useToken = () => new URLSearchParams(useLocation().search).get("token") || "";

export const joinLink = (token: string) => `${Routing.HouseholdJoin}?token=${encodeURIComponent(token)}`;

const Page: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <Stack component="main" spacing={2} sx={{ maxWidth: 640, mx: "auto", my: 4, px: 2 }}>
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography component="h1" variant="h5" sx={{ mb: 2 }}>{title}</Typography>
      {children}
    </Paper>
  </Stack>
);

const invitationProblem = (info: HouseholdInvitationPublic): string | null => {
  if (info.status === "expired") return "This invitation has expired. Ask the person who invited you to send a new one.";
  if (info.status === "revoked") return "This invitation was cancelled.";
  if (info.status === "accepted") return "This invitation was already used.";
  return null;
};

// Before signing in: who invited you, then sign in or create a free account.
export const JoinHouseholdPublic: React.FC = () => {
  const token = useToken();
  const navigate = useNavigate();
  const { data, isRequesting, error } = useReadTransaction(getHouseholdInvitationPublic, { token }, !token, `household-invitation-${token}`, true);

  if (!token) return <Page title="Household invitation"><Alert severity="error">This invitation link is not valid.</Alert></Page>;
  if (isRequesting && !data) return <Page title="Household invitation"><CircularProgress aria-label="Loading invitation" /></Page>;
  if (error || !data) {
    return <Page title="Household invitation"><Alert severity="error">This invitation link is not valid or has expired.</Alert></Page>;
  }

  const problem = invitationProblem(data);
  const redirect = encodeURIComponent(joinLink(token));
  const signUp = `${Routing.SignUp}?householdInvite=${encodeURIComponent(token)}&email=${encodeURIComponent(data.invited_email)}`;
  return <Page title={`${data.inviter_name || "A member"} invited you to a household membership`}>
    {problem ? <Alert severity="warning">{problem}</Alert> : <>
      <Typography sx={{ mb: 2 }}>
        Joining is <strong>free</strong>: your membership is covered by the household's and follows the same dates.
        You will need the invited email address, <strong>{data.invited_email}</strong>.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>{COME_IN_MESSAGE}</Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button id="household-join-signup" variant="contained" onClick={() => navigate(signUp)}>Create an account</Button>
        <Button id="household-join-login" variant="outlined" onClick={() => navigate(`${Routing.Login}?redirect=${redirect}`)}>I already have an account</Button>
      </Stack>
    </>}
  </Page>;
};

export const JoinHouseholdView: React.FC<{
  preview: HouseholdInvitationPreview;
  onJoin: () => void;
  joining: boolean;
  error?: string;
  profileUrl: string;
}> = ({ preview, onJoin, joining, error, profileUrl }) => {
  const blocked = !!preview.blocked_reason;
  const canJoin = preview.status === "pending" && preview.address_matches && preview.payment_accepted && !blocked;
  return <Page title={`Join ${preview.primary_name ? `${preview.primary_name}'s` : "the"} household`}>
    {preview.status === "expired" && <Alert severity="warning" sx={{ mb: 2 }}>This invitation has expired. Ask them to send a new one.</Alert>}
    {["revoked", "accepted"].includes(preview.status) && <Alert severity="warning" sx={{ mb: 2 }}>
      {preview.status === "revoked" ? "This invitation was cancelled." : "This invitation was already used."}
    </Alert>}
    {blocked && <Alert severity="warning" sx={{ mb: 2 }}>{preview.blocked_reason}</Alert>}
    {!preview.payment_accepted && !blocked && <Alert severity="warning" sx={{ mb: 2 }}>
      The household payment has not been accepted yet, so you cannot join yet. Ask {preview.primary_name || "them"} to check their payment.
    </Alert>}
    <Typography sx={{ mb: 1 }}>The address on your account must match the household's.</Typography>
    <Box component="dl" sx={{ m: 0, mb: 2 }}>
      <Typography component="dt" variant="caption" color="textSecondary">Household address</Typography>
      <Typography component="dd" sx={{ m: 0, mb: 1 }}>{preview.household_address || "Not available"}</Typography>
      <Typography component="dt" variant="caption" color="textSecondary">Your address</Typography>
      <Typography component="dd" sx={{ m: 0 }}>{preview.your_address}</Typography>
    </Box>
    {!preview.address_matches && <Alert severity="warning" sx={{ mb: 2 }}>
      These do not match. <RouterLink to={profileUrl}>Update the address on your profile</RouterLink>, then come back and press Join.
      The street number, street name and postal code must match.
    </Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Alert severity="info" sx={{ mb: 2 }}>{COME_IN_MESSAGE}</Alert>
    <Button id="household-join-button" variant="contained" disabled={!canJoin || joining} onClick={onJoin}>
      {joining ? <CircularProgress size={18} /> : "Join household"}
    </Button>
  </Page>;
};

// Signed in as the invited person: see the address to match, then join.
const JoinHouseholdPage: React.FC = () => {
  const token = useToken();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const { data, isRequesting, error } = useReadTransaction(previewHouseholdInvitation, { token }, !token, `household-preview-${token}`, true);
  const [joined, setJoined] = React.useState(false);
  const join = useWriteTransaction(acceptHouseholdInvitation, () => setJoined(true));

  if (!token) return <Page title="Household invitation"><Alert severity="error">This invitation link is not valid.</Alert></Page>;
  if (isRequesting && !data) return <Page title="Household invitation"><CircularProgress aria-label="Loading invitation" /></Page>;
  if (joined) {
    return <Page title="You joined the household">
      <Alert severity="success" sx={{ mb: 2 }}>You are now part of the household. Your membership follows theirs, at no charge to you.</Alert>
      <Alert severity="info" sx={{ mb: 2 }}>{COME_IN_MESSAGE}</Alert>
      <Button variant="contained" onClick={() => navigate(Routing.Home)}>Go to my home page</Button>
    </Page>;
  }
  if (error || !data) {
    return <Page title="Household invitation">
      <Alert severity="error">{error || "This invitation link is not valid."}</Alert>
      <Typography sx={{ mt: 2 }}>
        Signed in as someone else? Log out from the menu at the top, then open the link in your email again.
      </Typography>
    </Page>;
  }
  return <JoinHouseholdView
    preview={data}
    onJoin={() => join.call({ token })}
    joining={join.isRequesting}
    error={join.error}
    profileUrl={buildProfileRouting(currentUser?.id)}
  />;
};

export default JoinHouseholdPage;
