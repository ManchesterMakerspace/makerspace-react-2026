import * as React from "react";
import ShortLinkQrCodeModal from "ui/common/ShortLinkQrCodeModal";

const RentalSpotQrCodeModal: React.FC<{
  spot: { id: string; number: string } | null;
  onClose: () => void;
}> = ({ spot, onClose }) => spot ? (
  <ShortLinkQrCodeModal key={spot.id} id="rental-spot-qr-code" title={`QR Code — ${spot.number}`}
    target={`/rentals/spots/${spot.id}`} fallbackUrl={`${window.location.origin}/rentals/spots/${spot.id}`} filename={`rental-spot-${spot.number}-qr.png`} onClose={onClose} />
) : null;
export default RentalSpotQrCodeModal;
