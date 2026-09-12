import * as React from "react";
import { createShortLink } from "api/shortcodes";
import QrCodeModal from "./QrCodeModal";

const ShortLinkQrCodeModal: React.FC<{ id: string; title: string; target: string; fallbackUrl: string | (() => Promise<string>); filename: string; onClose: () => void }> = props => {
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setUrl(""); setNotice(""); setError("");
    createShortLink(props.target).then(link => { if (!cancelled) setUrl(link.short_url); })
      .catch(async () => {
        try {
          const fallback = typeof props.fallbackUrl === "function" ? await props.fallbackUrl() : props.fallbackUrl;
          if (!cancelled) {
            setUrl(fallback);
            setNotice("Short link unavailable. This QR code uses the full link and still works.");
          }
        } catch {
          if (!cancelled) setError("Could not load the configured public URL. Please try again.");
        }
      });
    return () => { cancelled = true; };
  }, [props.target, props.fallbackUrl]);
  return <QrCodeModal id={props.id} isOpen title={props.title} url={url}
    filename={props.filename} onClose={props.onClose} loading={!url && !error} notice={notice} error={error} />;
};
export default ShortLinkQrCodeModal;
