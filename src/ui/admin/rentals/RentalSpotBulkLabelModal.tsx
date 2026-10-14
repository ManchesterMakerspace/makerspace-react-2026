import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormLabel from "@mui/material/FormLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import FormModal from "ui/common/FormModal";
import { createShortLink } from "api/shortcodes";
import {
  LABEL_DPI, LABEL_PRESETS, LabelPresetId, drawLabel, loadFonts, loadLogo,
} from "./rentalLabel";
import { PdfLabelPage, browserDeflate, buildPdf, packBilevel, pdfFilename } from "./labelPdf";

export const MAX_BULK_LABELS = 200;
const LINK_CONCURRENCY = 4;

interface BulkSpot { id: string; number: string; active?: boolean; }

const byNumber = (a: BulkSpot, b: BulkSpot) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
const nextFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// Labels for several rental spots in one PDF: one page per label, each page exactly the label's size. Open the PDF,
// choose the printer and that label paper size, and print at 100% to print every label in one job.
const RentalSpotBulkLabelModal: React.FC<{ spots: BulkSpot[]; onClose: () => void }> = ({ spots, onClose }) => {
  const [presetId, setPresetId] = React.useState<LabelPresetId>("4x6");
  const [progress, setProgress] = React.useState({ done: 0, total: 0, step: "" });
  const [error, setError] = React.useState("");
  const [pdfUrl, setPdfUrl] = React.useState("");
  const [made, setMade] = React.useState(0);
  const linksRef = React.useRef<Record<string, string>>({}); // short links already fetched, kept when the size changes
  const previewRef = React.useRef<HTMLCanvasElement | null>(null);
  const logoRef = React.useRef<HTMLImageElement | null>(null);
  const preset = LABEL_PRESETS.find(p => p.id === presetId)!;

  const sorted = React.useMemo(() => [...spots].sort(byNumber), [spots]);
  const skipped = sorted.filter(spot => spot.active === false);
  const eligible = sorted.filter(spot => spot.active !== false);
  const tooMany = eligible.length > MAX_BULK_LABELS;

  React.useEffect(() => {
    if (tooMany || eligible.length === 0) return;
    let cancelled = false;
    let objectUrl = "";
    setError(""); setPdfUrl(""); setMade(0);
    setProgress({ done: 0, total: eligible.length, step: "Getting short links" });

    (async () => {
      // 1. Short links, a few at a time. Each is permanent and the same every time for a given spot.
      const missing = eligible.filter(spot => !linksRef.current[spot.id]);
      const failed: string[] = [];
      let cursor = 0;
      let completed = eligible.length - missing.length;
      const worker = async () => {
        while (!cancelled) {
          const spot = missing[cursor++];
          if (!spot) return;
          try {
            linksRef.current[spot.id] = (await createShortLink(`/rentals/spots/${spot.id}`)).short_url;
          } catch { failed.push(spot.number); }
          completed += 1;
          if (!cancelled) setProgress(p => ({ ...p, done: completed }));
        }
      };
      await Promise.all(Array.from({ length: Math.min(LINK_CONCURRENCY, missing.length) }, worker));
      if (cancelled) return;
      if (failed.length) {
        setError(`Could not get a short link for ${failed.length} spot${failed.length === 1 ? "" : "s"}: ${failed.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ")}. ` +
          "No PDF was made, so nothing is missing from it silently. Try again; short links also cannot be made for deleted spots or on a localhost address.");
        return;
      }

      // 2. Draw each label and pack it as a 1-bit page.
      setProgress({ done: 0, total: eligible.length, step: "Drawing labels" });
      const [logo] = await Promise.all([loadLogo(), loadFonts()]);
      logoRef.current = logo;
      const canvas = document.createElement("canvas");
      const pages: PdfLabelPage[] = [];
      try {
        for (let i = 0; i < eligible.length; i++) {
          if (cancelled) return;
          drawLabel(canvas, preset, { number: eligible[i].number, shortUrl: linksRef.current[eligible[i].id] }, logo);
          const image = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
          pages.push({
            widthIn: preset.widthIn, heightIn: preset.heightIn, imageWidth: canvas.width, imageHeight: canvas.height,
            bits: packBilevel(image.data, canvas.width, canvas.height),
          });
          setProgress({ done: i + 1, total: eligible.length, step: "Drawing labels" });
          await nextFrame(); // let the progress bar repaint between labels
        }

        // 3. The PDF.
        setProgress({ done: eligible.length, total: eligible.length, step: "Building the PDF" });
        const bytes = await buildPdf(pages, browserDeflate);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setPdfUrl(objectUrl);
        setMade(pages.length);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Could not make the PDF.");
      }
    })();

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, sorted.map(spot => spot.id).join(",")]);

  // The preview canvas only exists once the PDF is ready, so draw the first label into it then.
  React.useEffect(() => {
    if (!pdfUrl || !previewRef.current || !eligible[0]) return;
    drawLabel(previewRef.current, preset, { number: eligible[0].number, shortUrl: linksRef.current[eligible[0].id] }, logoRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  const working = !pdfUrl && !error && !tooMany && eligible.length > 0;

  return <FormModal id="rental-spot-bulk-labels" isOpen title={`Labels — ${spots.length} spots`} closeHandler={onClose} cancelText="Close">
    <div style={{ textAlign: "center" }}>
      <div style={{ textAlign: "left", marginBottom: 12 }}>
        <FormLabel style={{ fontSize: 12 }}>Label size</FormLabel>
        <Select native fullWidth value={presetId} onChange={e => setPresetId((e.target as HTMLSelectElement).value as LabelPresetId)}>
          {LABEL_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      {tooMany && <Alert severity="warning">
        That is {eligible.length} labels. Please select {MAX_BULK_LABELS} or fewer at a time.
      </Alert>}
      {!tooMany && eligible.length === 0 && <Alert severity="warning">None of the selected spots can have a label, because they are all inactive.</Alert>}

      {working && <div role="status" style={{ textAlign: "left" }}>
        <Typography variant="body2">{progress.step}… {progress.done} of {progress.total}</Typography>
        <LinearProgress variant="determinate" value={progress.total ? (progress.done / progress.total) * 100 : 0} sx={{ mt: 1 }} />
      </div>}

      {pdfUrl && <>
        <Typography variant="body1" sx={{ mb: 1 }}>
          {made} label{made === 1 ? "" : "s"} ready ({preset.widthIn}&Prime; &times; {preset.heightIn}&Prime;), one per page.
        </Typography>
        <canvas ref={previewRef} role="img" aria-label={`Preview of the first label, ${eligible[0]?.number}`}
          style={{ maxWidth: "100%", maxHeight: "40vh", height: "auto", border: "1px solid #ccc" }} />
        <div style={{ marginTop: 12 }}>
          <Button variant="contained" component="a" href={pdfUrl} download={pdfFilename(preset.id, made)}>Download PDF</Button>
        </div>
        <Typography variant="caption" color="textSecondary" component="div" sx={{ mt: 1 }}>
          Open the PDF and print it to the printer that holds this label size, choosing that paper size and printing at 100% /
          actual size. Every page is one label, at {LABEL_DPI} dpi, in number order.
        </Typography>
      </>}

      {skipped.length > 0 && <Alert severity="info" sx={{ mt: 1, textAlign: "left" }}>
        Skipped {skipped.length} inactive spot{skipped.length === 1 ? "" : "s"}, which cannot have a short link: {skipped.map(s => s.number).join(", ")}.
        Mark {skipped.length === 1 ? "it" : "them"} active to make {skipped.length === 1 ? "a label" : "labels"}.
      </Alert>}
      {error && <Alert severity="error" sx={{ mt: 1, textAlign: "left" }}>{error}</Alert>}
    </div>
  </FormModal>;
};
export default RentalSpotBulkLabelModal;
