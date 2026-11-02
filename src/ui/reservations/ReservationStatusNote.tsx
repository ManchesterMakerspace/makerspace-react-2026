import * as React from 'react';
import Typography from '@mui/material/Typography';
import { Reservation } from 'app/entities/reservation';

export const reservationStatusLabel = (status: string) => status === 'abandoned' ? 'Abandoned' : status;
export const reservationStatusExplanation = (reservation: Reservation): string | null => {
  if (reservation.status === 'abandoned') return 'Released after no check-in within 15 minutes. Reservation fees are unchanged.';
  if (reservation.status === 'cancelled' && reservation.decisionNote === 'released_on_logoff')
    return 'Remaining reservation released when the owner logged off the tool.';
  return null;
};
export default function ReservationStatusNote({ reservation }: { reservation: Reservation }) {
  const text = reservationStatusExplanation(reservation);
  return text ? <Typography variant="body2" color="textSecondary">{text}</Typography> : null;
}
