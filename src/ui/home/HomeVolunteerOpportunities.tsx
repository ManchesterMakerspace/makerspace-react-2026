import * as React from "react";
import { Alert, Box, Button, List, ListItem, Paper, Stack, Typography } from "@mui/material";
import { isApiErrorResponse } from "makerspace-ts-api-client";
import { HomeVolunteerOpportunity } from "api/home";
import { claimVolunteerTask, checkinVolunteerEvent } from "api/volunteer";
import { timeToDate } from "ui/utils/timeToDate";

interface Props {
  opportunities: HomeVolunteerOpportunity[];
  onClaim: (opportunity: HomeVolunteerOpportunity) => void;
}

const HomeVolunteerOpportunities: React.FC<Props> = ({ opportunities, onClaim }) => {
  const submitting = React.useRef(false);
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState("");
  const claim = async (opportunity: HomeVolunteerOpportunity) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(`${opportunity.kind}-${opportunity.id}`);
    setError("");
    try {
      const response = opportunity.kind === "task"
        ? await claimVolunteerTask({ id: opportunity.id })
        : await checkinVolunteerEvent({ id: opportunity.id });
      if (isApiErrorResponse(response)) {
        setError(response.error.message || "Unable to claim this opportunity. Please try again.");
      } else {
        onClaim(opportunity);
      }
    } catch {
      setError("Unable to claim this opportunity. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(undefined);
    }
  };

  return <Paper component="section" aria-labelledby="home-volunteer-title" sx={{ p: { xs: 2, sm: 3 } }}>
    <Typography id="home-volunteer-title" component="h2" variant="h5" gutterBottom>Available Volunteer Opportunities</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <List disablePadding>
      {opportunities.map(opportunity => {
        const key = `${opportunity.kind}-${opportunity.id}`;
        const label = opportunity.kind === "task" ? "Claim Task" : "Join Event";
        return <ListItem key={key} disableGutters divider sx={{ py: 2, display: "block" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h3" variant="h6">{opportunity.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {opportunity.kind === "task" ? "Task" : "Event"} · {opportunity.creditValue} volunteer {opportunity.creditValue === 1 ? "credit" : "credits"}
                {opportunity.shopName && ` · ${opportunity.shopName}`}
                {opportunity.eventDate && ` · ${timeToDate(opportunity.eventDate)}`}
              </Typography>
              {opportunity.description && <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{opportunity.description}</Typography>}
            </Box>
            <Button variant="outlined" disabled={!!busy} onClick={() => claim(opportunity)}
              aria-label={`${label}: ${opportunity.title}`} aria-busy={busy === key}
              sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}>
              {busy === key ? "Submitting…" : label}
            </Button>
          </Stack>
        </ListItem>;
      })}
    </List>
  </Paper>;
};

export default HomeVolunteerOpportunities;
