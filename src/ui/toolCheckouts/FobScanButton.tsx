import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NfcIcon from "@mui/icons-material/Nfc";
import { isApiErrorResponse } from "makerspace-ts-api-client";

import { FobMemberPreview } from "app/entities/toolCheckout";
import { lookupToolCheckoutCard } from "api/toolCheckouts";
import { nfcCapabilities, scanNfc } from "../../nfc/scanner";

interface Props {
  // The tool or group the member is being checked out on; the server decides whether the
  // approver may do that, and whether the member is eligible.
  toolId?: string;
  toolGroupId?: string;
  disabled?: boolean;
  // Shown under the button while it is disabled (for example, until a tool is chosen).
  disabledHint?: string;
  onMember: (preview: FobMemberPreview) => void;
}

// "Scan member's fob": reads the tapped fob with the phone's NFC reader and asks the server who it
// belongs to. It selects a member for the checkout; nothing is created here.
const FobScanButton: React.FC<Props> = ({ toolId, toolGroupId, disabled, disabledHint, onMember }) => {
  const [supported, setSupported] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [looking, setLooking] = React.useState(false);
  const [error, setError] = React.useState("");
  const stop = React.useRef<(() => void) | null>(null);

  const cancel = React.useCallback(() => {
    stop.current?.();
    stop.current = null;
    setScanning(false);
  }, []);

  React.useEffect(() => {
    void nfcCapabilities().then(value => setSupported(!!value.supported)).catch(() => setSupported(false));
    return () => { stop.current?.(); };
  }, []);

  // Choosing a different tool or group invalidates a scan in progress.
  React.useEffect(() => { cancel(); }, [toolId, toolGroupId, cancel]);

  if (!supported) return null;

  const start = () => {
    cancel();
    setError("");
    setScanning(true);
    stop.current = scanNfc("inspect", result => {
      cancel();
      if (!result.uid) {
        setError("That fob has no readable ID. Try the Android app, or search for the member.");
        return;
      }
      setLooking(true);
      void lookupToolCheckoutCard({ toolId, toolGroupId, uid: result.uid }).then(response => {
        if (isApiErrorResponse(response)) setError(response.error.message || "Could not look up that fob.");
        else onMember(response.data);
      }).finally(() => setLooking(false));
    }, scanError => {
      cancel();
      setError(scanError.message);
    });
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {scanning || looking ? (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <NfcIcon color="primary" />
          <Typography variant="body2">
            {looking ? "Looking up the member…" : "Hold the member's fob against the back of the phone."}
          </Typography>
          {scanning && <Button size="small" onClick={cancel}>Cancel</Button>}
        </div>
      ) : (
        <>
          <Button variant="outlined" startIcon={<NfcIcon />} disabled={disabled} onClick={start}>
            Scan member&apos;s fob
          </Button>
          {disabled && disabledHint &&
            <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 4 }}>{disabledHint}</Typography>}
        </>
      )}
    </>
  );
};

export default FobScanButton;
