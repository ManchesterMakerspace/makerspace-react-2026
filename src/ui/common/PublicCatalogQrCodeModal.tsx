import * as React from "react";
import ShortLinkQrCodeModal from "./ShortLinkQrCodeModal";
import { configuredPublicUrl } from "./publicCatalogUrl";

const PublicCatalogQrCodeModal: React.FC<{
  kind: "tool" | "shop"; resource: { id: string; name: string }; onClose: () => void;
}> = ({ kind, resource, onClose }) => {
  const target = `/api/${kind}/${resource.id}/public.html`;
  const fallback = React.useCallback(() => configuredPublicUrl(target), [target]);
  return <ShortLinkQrCodeModal id={`${kind}-qr-code`} title={`QR Code — ${resource.name}`}
    target={target} fallbackUrl={fallback} filename={`${kind}-${resource.id}-qr.png`} onClose={onClose} />;
};
export default PublicCatalogQrCodeModal;
