import * as React from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, CircularProgress, Paper, Typography } from "@mui/material";
import { WorkshopTool } from "app/entities/workshop";
import { clearCheckoutDestination } from "ui/auth/checkoutDestination";
import RequestCheckoutModal from "./RequestCheckoutModal";

const CheckoutRequestPage: React.FC = () => {
  const { id } = useParams();
  const [context, setContext] = React.useState<{ tool: WorkshopTool; eligible: boolean; reason?: string }>();
  const [error, setError] = React.useState("");
  const [show, setShow] = React.useState(true);
  const [created, setCreated] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    clearCheckoutDestination();
    fetch(`/api/tools/${encodeURIComponent(id || "")}/coreq.html`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? "Not Found" : "Unable to load checkout request. Please sign in and try again.");
        return response.json();
      }).then(value => { if (!cancelled) setContext(value); })
      .catch(reason => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [id]);
  return <Paper sx={{ p: { xs: 2, sm: 3 }, mx: "auto", my: 3, maxWidth: 900, overflowWrap: "anywhere" }}>
    <Typography variant="h4" component="h1" gutterBottom>Request checkout</Typography>
    {error ? <Alert severity="error">{error}</Alert> : !context ? <CircularProgress aria-label="Loading tool" /> : <>
      <Typography variant="h5" component="h2">{context.tool.name}</Typography>
      <Typography>{context.tool.description}</Typography>
      {created ? <Alert severity="success">Checkout request submitted.</Alert> : !context.eligible ?
        <Alert severity="info">{context.reason}</Alert> : <>
          <Button variant="contained" onClick={() => setShow(true)}>Request checkout</Button>
          <RequestCheckoutModal tool={show ? context.tool : null} onClose={() => setShow(false)}
            onCreated={() => { setShow(false); setCreated(true); }} />
        </>}
    </>}
  </Paper>;
};
export default CheckoutRequestPage;
