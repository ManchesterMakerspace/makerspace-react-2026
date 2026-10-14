import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormLabel from "@mui/material/FormLabel";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import FormModal from "ui/common/FormModal";
import { createShortLink } from "api/shortcodes";
import {
  LABEL_DPI, LABEL_PRESETS, LabelPresetId, drawLabel, labelFilename, labelPngBlob, loadFonts, loadLogo,
} from "./rentalLabel";

// A printable label: logo, spot number, QR code and the short link, as a black-and-white PNG at the label's real
// size and 300 dpi. Open the downloaded file in any viewer and print it to the printer holding that label size.
const RentalSpotLabelModal: React.FC<{ spot: { id: string; number: string; active?: boolean } | null; onClose: () => void }> = ({ spot, onClose }) => {
  const [presetId, setPresetId] = React.useState<LabelPresetId>("4x6");
  const [shortUrl, setShortUrl] = React.useState("");
  const [error, setError] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const blobRef = React.useRef<Blob | null>(null);
  const preset = LABEL_PRESETS.find(p => p.id === presetId)!;

  React.useEffect(() => {
    if (!spot) return;
    let cancelled = false;
    setShortUrl(""); setError("");
    // The server only creates (and later resolves) short links for active spots, so a label for an inactive spot
    // would print a code that never opens the spot. Say so instead of showing a generic failure.
    if (spot.active === false) {
      setError("This spot is inactive, so it has no short link and a printed label would not open it. Mark the spot active, then make the label.");
      return;
    }
    createShortLink(`/rentals/spots/${spot.id}`)
      .then(link => { if (!cancelled) setShortUrl(link.short_url); })
      .catch(() => { if (!cancelled) setError("Could not get the short link for this spot, so the label can't be made. Please try again; short links also cannot be made for deleted spots or on a localhost address."); });
    return () => { cancelled = true; };
  }, [spot?.id, spot?.active]);

  React.useEffect(() => {
    if (!spot || !shortUrl) return;
    let cancelled = false;
    let objectUrl = "";
    setFileUrl(""); setCopied(false);
    (async () => {
      const [logo] = await Promise.all([loadLogo(), loadFonts()]);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      try {
        drawLabel(canvas, preset, { number: spot.number, shortUrl }, logo);
        const blob = await labelPngBlob(canvas);
        if (cancelled) return;
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Could not draw the label.");
      }
    })();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [spot?.id, shortUrl, presetId]);

  const copyImage = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true); setError("");
    } catch {
      setError('Copying images is not supported in this browser. Use "Download PNG" instead.');
    }
  };

  if (!spot) return null;
  return <FormModal id="rental-spot-label" isOpen title={`Label — ${spot.number}`} closeHandler={onClose}
    cancelText="Close" onSubmit={fileUrl && !error ? copyImage : undefined} submitText={copied ? "Copied!" : "Copy Image"}>
    <div style={{ textAlign: "center" }}>
      <div style={{ textAlign: "left", marginBottom: 12 }}>
        <FormLabel style={{ fontSize: 12 }}>Label size</FormLabel>
        <Select native fullWidth value={presetId} onChange={e => setPresetId((e.target as HTMLSelectElement).value as LabelPresetId)}>
          {LABEL_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      {!shortUrl && !error && <CircularProgress aria-label="Loading short link" />}
      {shortUrl && <>
        <canvas ref={canvasRef} role="img" aria-label={`Label for ${spot.number}`}
          style={{ maxWidth: "100%", maxHeight: "55vh", height: "auto", border: "1px solid #ccc" }} />
        <div style={{ marginTop: 12 }}>
          {fileUrl
            ? <Button variant="outlined" component="a" href={fileUrl} download={labelFilename(spot.number, preset)}>Download PNG</Button>
            : <Button variant="outlined" disabled>Preparing…</Button>}
        </div>
        <Typography variant="caption" color="textSecondary" component="div" sx={{ mt: 1 }}>
          {preset.widthIn}&Prime; &times; {preset.heightIn}&Prime; at {LABEL_DPI} dpi. Open the file and print it to the printer that holds
          this label size, choosing that paper size in the print dialog. Print at 100% / actual size.
        </Typography>
      </>}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </div>
  </FormModal>;
};
export default RentalSpotLabelModal;
