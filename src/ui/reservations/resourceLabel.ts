import { Reservation } from 'app/entities/reservation';

export const reservationResourceLabel = (reservation: Reservation) => {
  const groups = (reservation.groupSnapshots || []).map(group => `${group.name} (Group)`).join(', ');
  const tools = reservation.toolNames?.join(', ') || reservation.shopName;
  return groups ? `${groups} — ${tools}` : tools;
};
