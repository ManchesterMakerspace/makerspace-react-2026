import * as React from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import QRCode from "qrcode";
import FormModal from "ui/common/FormModal";

interface Props {
  id: string;
  isOpen: boolean;
  title: string;
  url: string;
  filename: string;
  onClose: () => void;
  loading?: boolean;
  error?: string;
  notice?: string;
}

// Canvas gives both rental and tool labels a real PNG for download/clipboard.
const QrCodeModal: React.FC<Props> = ({ id, isOpen, title, url, filename, onClose, loading, error, notice }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [png, setPng] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [imageError, setImageError] = React.useState("");

  // A callback ref runs after the dialog transition actually mounts the canvas.
  const setCanvasRef = React.useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (!canvas) return;
    setPng("");
    setCopied(false);
    setImageError("");
    QRCode.toCanvas(canvas, url, { width: 240, margin: 2 }, err => {
      if (err) setImageError("Could not generate the QR code.");
      else setPng(canvas.toDataURL("image/png"));
    });
  }, [url]);

  const copyImage = () => {
    canvasRef.current?.toBlob(async blob => {
      if (!blob) {
        setImageError("Could not generate the image.");
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopied(true);
        setImageError("");
      } catch {
        setImageError('Copying images is not supported in this browser. Use "Download PNG" instead.');
      }
    }, "image/png");
  };

  return <FormModal id={id} isOpen={isOpen} title={title} closeHandler={onClose}
    cancelText="Close" onSubmit={png && !loading && !error ? copyImage : undefined}
    submitText={copied ? "Copied!" : "Copy Image"}>
    <div style={{ textAlign: "center" }}>
      {loading ? <CircularProgress aria-label="Loading QR code" /> : error ? null : url && <>
        <canvas ref={setCanvasRef} role="img" aria-label={title} style={{ maxWidth: "100%", height: "auto" }} />
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1, overflowWrap: "anywhere" }}>
          <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        </Typography>
        <Typography variant="caption" color="textSecondary" component="div" sx={{ mt: 1 }}>
          Copy the image to paste it into a label/sticker program, or{" "}
          {png && <a href={png} download={filename}>download it as a PNG</a>}.
        </Typography>
      </>}
      {notice && <Alert severity="warning" sx={{ mt: 1 }}>{notice}</Alert>}
      {(error || imageError) && <Alert severity="error" sx={{ mt: 1 }}>{error || imageError}</Alert>}
    </div>
  </FormModal>;
};
export default QrCodeModal;
