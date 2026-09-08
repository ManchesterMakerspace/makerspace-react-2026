import * as React from "react";
import Typography from "@mui/material/Typography";
import QRCode from "qrcode";

import FormModal from "ui/common/FormModal";
import { Routing } from "app/constants";

interface Props {
  // The spot's human-readable number, or null when the modal is closed.
  spotNumber: string | null;
  onClose: () => void;
}

// Renders a QR code (via a <canvas>, so it can be copied/downloaded as a real
// image) for a rental spot's public deep link -- meant to be printed as a
// sticker on the bin/tote/shelf itself.
const RentalSpotQrCodeModal: React.FC<Props> = ({ spotNumber, onClose }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState("");

  const url = spotNumber
    ? `${window.location.origin}${Routing.RentalSpotDeepLink.replace(Routing.PathPlaceholder.SpotId, spotNumber)}`
    : "";

  React.useEffect(() => {
    setCopied(false);
    setError("");
  }, [spotNumber]);

  // A useEffect keyed on [spotNumber, url] can run before MUI's Dialog has
  // actually mounted the canvas into the DOM (its Modal/transition wrapper
  // mounts children a tick after `open` flips), silently drawing nothing.
  // A callback ref fires exactly when the node attaches -- and since it's
  // wrapped in useCallback keyed on `url`, React re-invokes it (detach then
  // reattach) whenever the spot changes too, so redraws stay correct.
  const setCanvasRef = React.useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (!node || !url) return;

    QRCode.toCanvas(node, url, { width: 240, margin: 2 }, err => {
      if (err) setError("Could not generate the QR code.");
    });
  }, [url]);

  const copyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async blob => {
      if (!blob) {
        setError("Could not generate the image.");
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Copying images isn't supported in this browser -- use \"Download PNG\" instead.");
      }
    });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !spotNumber) return;

    const link = document.createElement("a");
    link.download = `rental-spot-${spotNumber}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <FormModal
      id="rental-spot-qr-code"
      isOpen={!!spotNumber}
      title={spotNumber ? `QR Code — ${spotNumber}` : "QR Code"}
      closeHandler={onClose}
      cancelText="Close"
      onSubmit={copyImage}
      submitText={copied ? "Copied!" : "Copy Image"}
      error={error}
    >
      <div style={{ textAlign: "center" }}>
        <canvas ref={setCanvasRef} />
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 8, wordBreak: "break-all" }}>
          {url}
        </Typography>
        <Typography variant="caption" color="textSecondary" component="div" style={{ marginTop: 8 }}>
          Copy the image to paste it into a label/sticker program, or{" "}
          <a href="#" onClick={e => { e.preventDefault(); downloadImage(); }}>download it as a PNG</a>.
        </Typography>
      </div>
    </FormModal>
  );
};

export default RentalSpotQrCodeModal;
