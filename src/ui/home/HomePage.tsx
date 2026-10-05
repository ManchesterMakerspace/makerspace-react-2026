import * as React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Link, List, ListItem, Paper, Stack, Typography } from "@mui/material";
import { getHome, HomeMember } from "api/home";
import { Routing } from "app/constants";
import useReadTransaction from "ui/hooks/useReadTransaction";
import { useAuthState } from "ui/reducer/hooks";
import { timeToDate } from "ui/utils/timeToDate";
import HomeInvoices from "./HomeInvoices";
import HomeVolunteerOpportunities from "./HomeVolunteerOpportunities";
import { VOLUNTEER_CREDIT_TIMING_MESSAGE, VOLUNTEER_REVIEW_MESSAGE } from "ui/volunteer/volunteerMessages";

export const membershipCoverage = (member: HomeMember): string => {
  const householdRole = member.household?.role || member.householdRole;
  if (householdRole) return `Household membership (${householdRole} member)`;
  if (member.subscription || member.subscriptionId) return "Individual subscription";
  if (member.earnedMembershipActive) return "Earned membership";
  if (member.expirationTime || member.paidPendingStart) return "Prepaid membership";
  return "No membership";
};

const statuses: Record<string, string> = {
  activeMember: "Active", pending: "Pending", nonMember: "Non-member",
  inactive: "Inactive", suspended: "Suspended", revoked: "Revoked",
};

export const MembershipSummary: React.FC<{ member: HomeMember }> = ({ member }) => {
  const expiration = member.expirationTime ? timeToDate(member.expirationTime)
    : member.paidPendingStart ? "Awaiting activation" : "Not set";
  const expired = !!member.expirationTime && member.expirationTime <= Date.now();
  return <Typography component="p" sx={{ mb: 2 }}>
    Membership: {membershipCoverage(member)}. Status: {statuses[member.status] || member.status}.
    {" "}{expired ? "Expired" : "Expiration"}: {expiration}.
  </Typography>;
};

const HomePage: React.FC = () => {
  const { currentUser } = useAuthState();
  const { search } = useLocation();
  const welcome = new URLSearchParams(search).get("newMember") === "true";
  const [volunteerNotice, setVolunteerNotice] = React.useState("");
  const { data, isRequesting, error, refresh } = useReadTransaction(getHome, {}, false, "member-home", true, true);

  return <Stack component="main" spacing={3} sx={{ maxWidth: 1000, mx: "auto", my: 3, overflowWrap: "anywhere" }}>
    <Paper component="section" aria-labelledby="home-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="home-title" component="h1" variant={welcome ? "h3" : "h4"}
        sx={{ mb: 2, color: welcome ? "secondary.main" : "text.primary", fontSize: welcome ? { xs: "2.5rem", sm: "3rem" } : undefined }}>
        {welcome ? "Welcome!" : "Your membership"}
      </Typography>
      {welcome && <Typography component="p" sx={{ mb: 2 }}>
        Thank you for joining the Makerspace, you will receive several email messages with your onboarding documents and an invitation to our Google Drive and Slack workspace. Next step as a new member is to complete your in-person orientation and receive your access card.
      </Typography>}
      {isRequesting ? <CircularProgress aria-label="Loading member home" /> : error ?
        <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Retry</Button>}>{error}</Alert>
        : data && <>
          {!welcome && <MembershipSummary member={data.member} />}
          {!data.slack.accepted ? <Typography component="p">
            Please accept your Slack Invite (check your email), to communicate with the team and your fellow members
          </Typography> : data.slack.newMembersChannelUrl ?
            <Link variant="body1" href={data.slack.newMembersChannelUrl} target="_blank" rel="noopener noreferrer">Get started with Slack</Link>
            : <Typography color="text.secondary">Slack channel link is temporarily unavailable.</Typography>}
        </>}
      <Box sx={{ mt: 2 }}>
        <Link component={RouterLink as React.ElementType} variant="body1"
          to={Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUser.id)}>Account Settings</Link>
      </Box>
    </Paper>
    {volunteerNotice && <Alert severity="success" role="status" onClose={() => setVolunteerNotice("")}>
      <Typography>{volunteerNotice}</Typography>
      <Typography sx={{ mt: 1 }}>{VOLUNTEER_CREDIT_TIMING_MESSAGE}</Typography>
      <Typography sx={{ mt: 1 }}>{VOLUNTEER_REVIEW_MESSAGE}</Typography>
    </Alert>}
    {!isRequesting && !error && data?.member.status === "activeMember" && !!data.availableVolunteerOpportunities?.length &&
      <HomeVolunteerOpportunities opportunities={data.availableVolunteerOpportunities} onClaimStart={() => setVolunteerNotice("")} onClaim={opportunity => {
        setVolunteerNotice(opportunity.kind === "task"
          ? `Task claimed: ${opportunity.title}. When you finish the work, mark it complete in your profile's Volunteer tab.`
          : `Joined event: ${opportunity.title}. Event credits are issued after staff closes the event.`);
        refresh();
      }} />}
    <Paper component="section" aria-labelledby="home-checkouts-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="home-checkouts-title" component="h2" variant="h5" gutterBottom>Available safety checkouts</Typography>
      {isRequesting ? <Typography role="status">Loading safety checkouts…</Typography>
        : error ? <Typography>Safety checkouts could not be loaded. Use Retry above to try again.</Typography>
        : data && (data.availableCheckouts.length ? <List disablePadding>
          {data.availableCheckouts.map(tool => <ListItem key={tool.id} disableGutters divider sx={{ py: 2, display: "block" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h3" variant="h6">{tool.name}</Typography>
                <Typography variant="body2" color="text.secondary">{tool.shopName}</Typography>
                {tool.requestorAnnotation && <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>Annotation for requestors</Typography>
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>{tool.requestorAnnotation}</Typography>
                </Box>}
              </Box>
              <Button component={RouterLink as React.ElementType} to={`/tools/${encodeURIComponent(tool.id)}/request-checkout`}
                variant="outlined" sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
                aria-label={`Request Safety Checkout for ${tool.name}`}>
                Request Safety Checkout
              </Button>
            </Stack>
          </ListItem>)}
        </List> : <Typography>No safety checkouts are currently available</Typography>)}
    </Paper>
    <HomeInvoices />
  </Stack>;
};

export default HomePage;
