import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, AlertTitle, Box, Button, CircularProgress, Link } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getPayNowSubscription, payNow, PayNowBlockedReason, PayNowSubscription } from "api/payNow";
import { Routing } from "app/constants";
import { useAuthState } from "ui/reducer/hooks";
import { numberAsCurrency } from "ui/utils/numberAsCurrency";

const PAST_DUE = "Past Due";

// Amber, not the portal's default blue: a payment that did not go through needs attention.
const amber = { backgroundColor: "#ed6c02", color: "#fff", "&:hover": { backgroundColor: "#c25a02" }, "&.Mui-disabled": { backgroundColor: "#f3c9a3", color: "#fff" } };

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? "" : when.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

interface Props {
  subscriptionId?: string | null;
  /** "banner" is the warning at the top of the home page; "inline" sits next to the subscription in settings. */
  variant: "banner" | "inline";
  /** Called after a payment went through, so the page can refresh the member's status. */
  onPaid?: () => void;
}

/**
 * Shows "Pay now" for a past-due Braintree subscription of the signed-in member, and nothing for any other subscription.
 * States: loading, ready, paying, paid, declined (with the bank's reason when known), and disabled for a hard decline (change the
 * payment method first), the hour between attempts, and the daily limit.
 */
const PayNowPanel: React.FC<Props> = ({ subscriptionId, variant, onPaid }) => {
  const { currentUser } = useAuthState();
  const [subscription, setSubscription] = React.useState<PayNowSubscription | null>(null);
  const [loading, setLoading] = React.useState(!!subscriptionId);
  const [paying, setPaying] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
  const [declined, setDeclined] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [blocked, setBlocked] = React.useState<{ reason: PayNowBlockedReason; nextAt: string | null } | null>(null);
  const [failureMessage, setFailureMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!subscriptionId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getPayNowSubscription({ id: subscriptionId }).then((result: any) => {
      if (cancelled) return;
      if (!result.error) {
        const next = result.data as PayNowSubscription;
        setSubscription(next);
        setFailureMessage(next.lastFailureMessage);
        setBlocked(next.payNowBlockedReason ? { reason: next.payNowBlockedReason, nextAt: next.nextPayNowAt } : null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [subscriptionId]);

  const press = async () => {
    if (!subscriptionId || paying) return;
    setPaying(true);
    setDeclined("");
    setNotice("");
    const result = await payNow(subscriptionId);
    setPaying(false);
    if (result.paid === true) {
      setPaid(true);
      onPaid && onPaid();
      return;
    }
    const refusal = result.refusal;
    if (refusal.error === "payment_declined") {
      setDeclined(refusal.message);
      setFailureMessage(refusal.failureMessage ?? null);
      setBlocked(refusal.payNowBlockedReason ? { reason: refusal.payNowBlockedReason, nextAt: refusal.nextPayNowAt ?? null } : null);
    } else if (refusal.error === "hard_decline" || refusal.error === "cooldown" || refusal.error === "daily_cap") {
      setBlocked({ reason: refusal.error, nextAt: refusal.nextPayNowAt ?? null });
      setNotice(refusal.message);
    } else {
      setNotice(refusal.message);
    }
  };

  const settingsPath = Routing.Settings.replace(Routing.PathPlaceholder.MemberId, currentUser.id);

  if (paid) {
    return <Alert severity="success" role="status" sx={{ mb: variant === "banner" ? 0 : 2 }}>
      Payment received, your access is restored.
    </Alert>;
  }
  if (loading) return null;
  if (!subscription || subscription.status !== PAST_DUE) return null;

  const amount = subscription.amount ? numberAsCurrency(subscription.amount) : "";
  const reason = failureMessage ? ` (${failureMessage})` : "";
  const disabledMessage = (() => {
    if (!blocked) return "";
    if (blocked.reason === "hard_decline") return "This card cannot be tried again. Update your payment method first, then pay.";
    if (blocked.reason === "cooldown") return `You can try again${blocked.nextAt ? ` after ${formatWhen(blocked.nextAt)}` : " in an hour"}.`;
    if (blocked.reason === "daily_cap") return "You have reached today's limit of 3 payment attempts. Try again tomorrow, or ask a board member for help.";
    return "Pay now is not available for this payment. Please contact a board member.";
  })();

  return <Alert
    severity="warning"
    icon={<WarningAmberIcon aria-hidden="true" />}
    role="alert"
    data-testid={`pay-now-${variant}`}
    sx={{ mb: variant === "banner" ? 0 : 2, alignItems: "center", "& .MuiAlert-message": { width: "100%" } }}
  >
    <AlertTitle>{variant === "banner" ? "Your payment is past due" : "Payment past due"}</AlertTitle>
    {variant === "banner"
      ? <Box component="p" sx={{ m: 0 }}>Your last payment{amount ? ` of ${amount}` : ""} didn't go through{reason}. Pay now to keep your access.</Box>
      : <Box component="p" sx={{ m: 0 }}>The last payment{amount ? ` of ${amount}` : ""} didn't go through{reason}.</Box>}
    {declined && <Box component="p" role="status" sx={{ mt: 1, mb: 0, fontWeight: "bold" }}>{declined}</Box>}
    {notice && !declined && <Box component="p" role="status" sx={{ mt: 1, mb: 0 }}>{notice}</Box>}
    {disabledMessage && <Box component="p" sx={{ mt: 1, mb: 0 }}>
      {disabledMessage}
      {blocked?.reason === "hard_decline" && (variant === "banner"
        ? <> <Link component={RouterLink as React.ElementType} to={settingsPath}>Update payment method</Link></>
        : " Use Change Payment Method below.")}
    </Box>}
    <Box sx={{ mt: 1.5 }}>
      <Button
        variant="contained"
        disableElevation
        sx={amber}
        disabled={paying || !!blocked}
        onClick={press}
        startIcon={paying ? <CircularProgress size={16} color="inherit" aria-hidden="true" /> : undefined}
      >
        {paying ? "Paying…" : "Pay now"}
      </Button>
    </Box>
  </Alert>;
};

export default PayNowPanel;
