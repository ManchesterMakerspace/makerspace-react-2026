import { sourcePayload, eventLabel, staffEventLabel, defaultEventbriteDates } from '../../src/api/eventbrite';
import { SIGNUP_SOURCES, signupSourceDetailPrompt } from '../../src/ui/member/signupSources';
import { computeCapabilities } from '../../src/app/permissions';

describe('Eventbrite attribution and visibility', () => {
  it('starts on the Eastern date and clamps the sixth calendar month at month end', () => {
    expect(defaultEventbriteDates(new Date('2026-08-31T23:30:00-04:00'))).toEqual({
      from_date: '2026-08-31', to_date: '2027-02-28'
    });
  });
  it('maps a selected event to an ID without trusting a client-supplied name', () => {
    expect(sourcePayload('event:abc', 'arbitrary')).toEqual({ signupSource: 'eventbrite', signupEventbriteEventId: 'abc' });
    expect(sourcePayload('', '')).toEqual({ signupSource: '', signupSourceDetail: '' });
  });
  it('retains existing choices and ends with the member referral choice', () => {
    expect(SIGNUP_SOURCES.map(s => s.value)).toEqual(['class', 'walk_in', 'website', 'social', 'other', 'declined', 'friend']);
    expect(SIGNUP_SOURCES[SIGNUP_SOURCES.length - 1].label).toBe('Referral from Member');
    expect(signupSourceDetailPrompt('other')).toBeDefined();
    expect(signupSourceDetailPrompt('declined')).toBeUndefined();
  });
  it('renders the date in the event timezone', () => {
    expect(eventLabel({ name: 'Welding', startsAt: '2026-11-14T01:00:00Z', timezone: 'America/New_York' })).toBe('Welding — Nov 13, 2026');
  });
  it('shows a same-day staff event date once, including when it is already in the imported title', () => {
    const event = { startsAt: '2027-01-09T23:00:00Z', endsAt: '2027-01-10T02:00:00Z', timezone: 'America/New_York' };
    const name = 'MIG Welding 101 at Manchester Makerspace Saturday January 9 2027';
    expect(staffEventLabel({ ...event, name })).toBe(name);
    expect(staffEventLabel({ ...event, name: 'MIG Welding 101' })).toBe('MIG Welding 101 — Jan 9, 2027');
    expect(staffEventLabel({ ...event, endsAt: '2027-01-10T14:00:00Z', name: 'Welding' })).toBe('Welding — Jan 9, 2027 – Jan 10, 2027');
    expect(staffEventLabel({ name: 'Welding' })).toBe('Welding');
  });
  it.each(['isAdmin', 'isBoardMember', 'isResourceManager'])('allows %s to read history', role => {
    expect(computeCapabilities({ [role]: true } as any).canViewEventbriteHistory).toBe(true);
  });
  it('denies ordinary members', () => expect(computeCapabilities({} as any).canViewEventbriteHistory).toBe(false));
});
