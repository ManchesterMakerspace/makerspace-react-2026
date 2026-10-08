import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import NfcIcon from "@mui/icons-material/Nfc";

import { isApiErrorResponse } from "makerspace-ts-api-client";

import { FobMemberPreview } from "app/entities/toolCheckout";
import { adminCreateToolCheckout, lookupToolCheckoutCard } from "api/toolCheckouts";
import { nfcCapabilities, scanNfc } from "../../nfc/scanner";
import MemberSearchInput from "ui/common/MemberSearchInput";
import useWriteTransaction from "ui/hooks/useWriteTransaction";
import { SelectOption } from "ui/common/AsyncSelect";

interface Props {
  tool: { id: string; name: string };
  onClose: () => void;
  // Called after a checkout was recorded, so the page can refresh.
  onDone: () => void;
}

type Step = "choose" | "scanning" | "confirm" | "done";

// A member to confirm: from a fob tap (with the server's eligibility verdict) or from search
// (eligibility is checked by the server when the checkout is created).
interface Candidate {
  memberId: string;
  name: string;
  via: "fob" | "search";
  preview?: FobMemberPreview;
}

const expiryText = (expirationTime?: number | null) =>
  expirationTime ? new Date(Number(expirationTime)).toLocaleDateString() : undefined;

const CheckoutMemberDialog: React.FC<Props> = ({ tool, onClose, onDone }) => {
  const [step, setStep] = React.useState<Step>("choose");
  const [candidate, setCandidate] = React.useState<Candidate | null>(null);
  const [nfcSupported, setNfcSupported] = React.useState(false);
  const [scanError, setScanError] = React.useState("");
  const stopScan = React.useRef<(() => void) | null>(null);

  const { call: lookup, isRequesting: looking, reset: resetLookup } = useWriteTransaction(lookupToolCheckoutCard);
  const { call: checkOut, isRequesting: checkingOut, error: checkoutError, reset: resetCheckout } =
    useWriteTransaction(adminCreateToolCheckout);

  React.useEffect(() => {
    void nfcCapabilities().then(value => setNfcSupported(!!value.supported)).catch(() => setNfcSupported(false));
    return () => { stopScan.current?.(); };
  }, []);

  const cancelScan = React.useCallback(() => {
    stopScan.current?.();
    stopScan.current = null;
  }, []);

  const startScan = () => {
    cancelScan();
    setScanError("");
    resetLookup();
    setStep("scanning");
    stopScan.current = scanNfc("inspect", result => {
      cancelScan();
      if (!result.uid) {
        setScanError("That fob has no readable ID. Try the Android app, or search for the member.");
        setStep("choose");
        return;
      }
      void lookup({ toolId: tool.id, uid: result.uid }).then(response => {
        if (isApiErrorResponse(response)) {
          setScanError(response.error.message || "Could not look up that fob.");
          setStep("choose");
        } else {
          const preview = response.data;
          setCandidate({ memberId: preview.memberId, name: preview.name, via: "fob", preview });
          setStep("confirm");
        }
      });
    }, error => {
      cancelScan();
      setScanError(error.message);
      setStep("choose");
    });
  };

  const onSearchSelect = (selection: SelectOption) => {
    if (!selection) return;
    cancelScan();
    setScanError("");
    setCandidate({ memberId: selection.value, name: selection.label, via: "search" });
    setStep("confirm");
  };

  const back = () => {
    resetCheckout();
    setCandidate(null);
    setStep("choose");
  };

  const confirm = async () => {
    if (!candidate) return;
    const response = await checkOut({
      body: { memberId: candidate.memberId, toolId: tool.id, ...(candidate.via === "fob" && { source: "fob" as const }) }
    });
    if (!isApiErrorResponse(response)) setStep("done");
  };

  const close = () => { cancelScan(); onClose(); };
  const done = () => { cancelScan(); onDone(); };
  const blocked = candidate?.preview ? !candidate.preview.eligible : false;

  return (
    <Dialog open onClose={step === "done" ? done : close} fullWidth maxWidth="xs" aria-labelledby="checkout-member-title">
      <DialogTitle id="checkout-member-title">Check out a member on {tool.name}</DialogTitle>
      <DialogContent>
        {step === "choose" && (
          <>
            {scanError && <Alert severity="error" sx={{ mb: 2 }}>{scanError}</Alert>}
            {nfcSupported && (
              <Button fullWidth variant="contained" startIcon={<NfcIcon />} onClick={startScan} sx={{ mb: 2 }}>
                Scan member&apos;s fob
              </Button>
            )}
            <Typography variant="body2" sx={{ mb: 1 }}>
              {nfcSupported ? "Or search for the member by name or email" : "Search for the member by name or email"}
            </Typography>
            <MemberSearchInput
              fullyActiveUnexpired
              name="fob-checkout-member-search"
              placeholder="Search by name or email"
              onChange={onSearchSelect}
            />
          </>
        )}

        {step === "scanning" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            {looking ? <CircularProgress aria-label="Looking up fob" /> : <NfcIcon color="primary" sx={{ fontSize: 56 }} />}
            <Typography variant="body1" sx={{ mt: 1 }}>
              {looking ? "Looking up the member…" : "Hold the member's fob against the back of the phone."}
            </Typography>
          </div>
        )}

        {step === "confirm" && candidate && (
          <>
            <Typography variant="h6">{candidate.name}</Typography>
            {candidate.preview && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "4px 0 12px" }}>
                <Chip size="small" label={candidate.preview.status} />
                {expiryText(candidate.preview.expirationTime) &&
                  <Typography variant="body2" color="textSecondary">
                    Membership through {expiryText(candidate.preview.expirationTime)}
                  </Typography>}
              </div>
            )}
            {blocked && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {candidate.preview?.error || "This member cannot be checked out on this tool."}
                {candidate.preview?.unmetPrerequisites?.length ? ` Missing: ${candidate.preview.unmetPrerequisites.join(", ")}.` : ""}
              </Alert>
            )}
            {!blocked && (
              <Typography variant="body2">
                Check {candidate.name} out on <strong>{tool.name}</strong>? Make sure this is the person in front of you.
              </Typography>
            )}
            {checkoutError && <Alert severity="error" sx={{ mt: 1 }}>{checkoutError}</Alert>}
          </>
        )}

        {step === "done" && candidate && (
          <Alert severity="success">{candidate.name} is checked out on {tool.name}.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        {step === "choose" && <Button onClick={close}>Cancel</Button>}
        {step === "scanning" && <Button onClick={() => { cancelScan(); setStep("choose"); }}>Cancel</Button>}
        {step === "confirm" && (
          <>
            <Button onClick={back} disabled={checkingOut}>Back</Button>
            <Button variant="contained" onClick={confirm} disabled={blocked || checkingOut}>
              {checkingOut ? "Checking out…" : "Check Out"}
            </Button>
          </>
        )}
        {step === "done" && <Button variant="contained" onClick={done}>Done</Button>}
      </DialogActions>
    </Dialog>
  );
};

export default CheckoutMemberDialog;
