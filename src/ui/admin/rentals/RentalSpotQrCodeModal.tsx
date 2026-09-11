import * as React from "react";
import { Routing } from "app/constants";
import QrCodeModal from "ui/common/QrCodeModal";

const RentalSpotQrCodeModal: React.FC<{
  spotNumber: string | null;
  onClose: () => void;
}> = ({ spotNumber, onClose }) => (
  <QrCodeModal id="rental-spot-qr-code" isOpen={!!spotNumber}
    title={spotNumber ? `QR Code — ${spotNumber}` : "QR Code"}
    url={spotNumber ? `${window.location.origin}${Routing.RentalSpotDeepLink.replace(Routing.PathPlaceholder.SpotId, spotNumber)}` : ""}
    filename={`rental-spot-${spotNumber}-qr.png`} onClose={onClose} />
);
export default RentalSpotQrCodeModal;
