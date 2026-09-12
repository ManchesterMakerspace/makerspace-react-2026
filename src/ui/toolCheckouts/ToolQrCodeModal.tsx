import * as React from "react";
import { Tool } from "app/entities/toolCheckout";
import PublicCatalogQrCodeModal from "ui/common/PublicCatalogQrCodeModal";

const ToolQrCodeModal: React.FC<{ tool: Tool; onClose: () => void }> = ({ tool, onClose }) => (
  <PublicCatalogQrCodeModal kind="tool" resource={tool} onClose={onClose} />
);
export default ToolQrCodeModal;
