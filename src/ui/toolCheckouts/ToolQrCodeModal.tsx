import * as React from "react";
import { Tool } from "app/entities/toolCheckout";
import ShortLinkQrCodeModal from "ui/common/ShortLinkQrCodeModal";

const ToolQrCodeModal: React.FC<{ tool: Tool; onClose: () => void }> = ({ tool, onClose }) => (
  <ShortLinkQrCodeModal id="tool-qr-code" title={`QR Code — ${tool.name}`}
    target={`/api/tool/${tool.id}/public.html`} fallbackUrl={`${window.location.origin}/api/tool/${tool.id}/public.html`} filename={`tool-${tool.id}-qr.png`} onClose={onClose} />
);
export default ToolQrCodeModal;
