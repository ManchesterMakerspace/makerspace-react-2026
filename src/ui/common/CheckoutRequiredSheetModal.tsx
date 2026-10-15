import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import { generateCheckoutRequiredSheet } from "api/toolCheckouts";
import type { CheckoutSheetResource } from "./CheckoutRequiredSheetButton";

const CheckoutRequiredSheetModal: React.FC<{
  kind: "shop" | "tool";
  resource: CheckoutSheetResource;
  onClose: () => void;
}> = ({ kind, resource, onClose }) => {
  const [attempt, setAttempt] = React.useState(0);
  const [copies, setCopies] = React.useState<1 | 2>(2);
  const [result, setResult] = React.useState<{ url: string; warning: boolean }>();
  const [error, setError] = React.useState("");
  const titleId = React.useId();

  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string;
    setResult(undefined);
    setError("");
    generateCheckoutRequiredSheet(kind, resource.id, copies).then(sheet => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([sheet.svg], { type: "image/svg+xml" }));
      setResult({ url: objectUrl, warning: sheet.missingChannel });
    }).catch((failure: Error) => {
      if (!cancelled) setError(failure.message || "Could not generate the sheet. Please try again.");
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, resource.id, attempt, copies]);

  return <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby={titleId}>
    <DialogTitle id={titleId}>Checkout Required Sheet — {resource.name}</DialogTitle>
    <DialogContent>
      <FormControl sx={{ mb: 2 }}>
        <FormLabel id={`${titleId}-copies`}>Signs per sheet</FormLabel>
        <RadioGroup row aria-labelledby={`${titleId}-copies`} value={copies}
          onChange={(_, value) => setCopies(Number(value) as 1 | 2)}>
          <FormControlLabel value={2} control={<Radio />} label="Two signs" />
          <FormControlLabel value={1} control={<Radio />} label="One sign" />
        </RadioGroup>
      </FormControl>
      {!result && !error && <Box role="status" sx={{ textAlign: "center", p: 3 }}>
        <CircularProgress aria-label="Generating sheet" />
        <Typography>Generating sheet…</Typography>
      </Box>}
      {error && <Alert severity="error">
        {error}
        <Button color="inherit" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
      </Alert>}
      {result?.warning && <Alert severity="warning" sx={{ mb: 2 }}>
        This shop has no Slack channel configured. The sheet has a blank footer.
      </Alert>}
      {result && <Box component="img" src={result.url} alt={`${copies === 1 ? 'One Checkout Required sign' : 'Two Checkout Required signs'} for ${resource.name}`}
        sx={{ display: "block", width: "100%", height: "auto", border: 1, borderColor: "divider" }} />}
      <Typography variant="body2" sx={{ mt: 2 }}>
        Print on US Letter, landscape, at 100% / actual size.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
      <Button onClick={onClose}>Close</Button>
      {result && !error && <Button variant="contained" component="a" href={result.url}
        download={`checkout-required-${kind}-${resource.id}.svg`}>Download SVG</Button>}
    </DialogActions>
  </Dialog>;
};

export default CheckoutRequiredSheetModal;
