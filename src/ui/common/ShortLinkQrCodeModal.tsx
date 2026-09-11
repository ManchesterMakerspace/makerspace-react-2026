import * as React from "react";
import { createShortLink } from "api/shortcodes";
import QrCodeModal from "./QrCodeModal";

const ShortLinkQrCodeModal: React.FC<{ id: string; title: string; target: string; filename: string; onClose: () => void }> = props => {
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setUrl(""); setError("");
    createShortLink(props.target).then(link => { if (!cancelled) setUrl(link.short_url); })
      .catch(reason => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [props.target]);
  return <QrCodeModal id={props.id} isOpen title={props.title} url={url}
    filename={props.filename} onClose={props.onClose} loading={!url && !error} error={error} />;
};
export default ShortLinkQrCodeModal;
