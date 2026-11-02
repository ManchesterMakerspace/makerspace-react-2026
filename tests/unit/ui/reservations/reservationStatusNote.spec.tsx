import { Reservation } from 'app/entities/reservation';
import { reservationStatusExplanation, reservationStatusLabel } from 'ui/reservations/ReservationStatusNote';
describe('reservation attendance explanations',()=>{
  it('distinguishes a no-show from voluntary release without promising a refund',()=>{
    expect(reservationStatusLabel('abandoned')).toBe('Abandoned');
    expect(reservationStatusExplanation({status:'abandoned'} as Reservation)).toContain('fees are unchanged');
    expect(reservationStatusExplanation({status:'cancelled',decisionNote:'released_on_logoff'} as Reservation)).toContain('owner logged off');
    expect(reservationStatusExplanation({status:'approved'} as Reservation)).toBeNull();
  });
});
