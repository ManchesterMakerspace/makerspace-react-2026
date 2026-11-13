import { sourcePayload, eventLabel } from '../../src/api/eventbrite';
import { SIGNUP_SOURCES, signupSourceDetailPrompt } from '../../src/ui/member/signupSources';
import { computeCapabilities } from '../../src/app/permissions';

describe('Eventbrite attribution and visibility', () => {
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
  it.each(['isAdmin', 'isBoardMember', 'isResourceManager'])('allows %s to read history', role => {
    expect(computeCapabilities({ [role]: true } as any).canViewEventbriteHistory).toBe(true);
  });
  it('denies ordinary members', () => expect(computeCapabilities({} as any).canViewEventbriteHistory).toBe(false));
});
