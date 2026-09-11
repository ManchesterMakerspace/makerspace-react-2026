import * as React from "react";
import { createShortLink } from "api/shortcodes";
import QrCodeModal from "./QrCodeModal";

const ShortLinkQrCodeModal: React.FC<{ id: string; title: string; target: string; fallbackUrl: string; filename: string; onClose: () => void }> = props => {
  const [url, setUrl] = React.useState("");
  const [notice, setNotice] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setUrl(""); setNotice("");
    createShortLink(props.target).then(link => { if (!cancelled) setUrl(link.short_url); })
      .catch(() => {
        if (!cancelled) {
          setUrl(props.fallbackUrl);
          setNotice("Short link unavailable. This QR code uses the full link and still works.");
        }
      });
    return () => { cancelled = true; };
  }, [props.target, props.fallbackUrl]);
  return <QrCodeModal id={props.id} isOpen title={props.title} url={url}
    filename={props.filename} onClose={props.onClose} loading={!url} notice={notice} />;
};
export default ShortLinkQrCodeModal;
