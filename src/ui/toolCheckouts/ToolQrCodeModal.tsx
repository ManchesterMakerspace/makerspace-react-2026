import * as React from "react";
import { loadClientConfig } from "api/clientConfig";
import { Tool } from "app/entities/toolCheckout";
import QrCodeModal from "ui/common/QrCodeModal";
import { toolPublicUrl } from "./toolPublicUrl";

const ToolQrCodeModal: React.FC<{ tool: Tool; onClose: () => void }> = ({ tool, onClose }) => {
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    setUrl("");
    setError("");
    loadClientConfig().then(config => {
      const destination = toolPublicUrl(config.app_domain, tool.id);
      if (!cancelled) setUrl(destination);
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load the public tool link.");
    });
    return () => { cancelled = true; };
  }, [tool.id]);
  return <QrCodeModal id="tool-qr-code" isOpen title={`QR Code — ${tool.name}`}
    url={url} filename={`tool-${tool.id}-qr.png`} onClose={onClose} loading={!url && !error} error={error} />;
};
export default ToolQrCodeModal;
