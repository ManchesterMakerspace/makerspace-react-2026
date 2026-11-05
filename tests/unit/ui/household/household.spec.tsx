import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import { HouseholdState } from 'api/household';
import { HouseholdCardView, householdStep, COME_IN_MESSAGE, UNPAID_MESSAGE } from 'ui/household/HouseholdCard';
import { JoinHouseholdView } from 'ui/household/JoinHouseholdPage';

// The views under test are pure; the data hooks and API modules pull in the store and Firebase, so stub them.
jest.mock('api/household', () => ({}));
jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('ui/hooks/useWriteTransaction', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: { id: 'me' } }) }));

const household = (overrides: Partial<NonNullable<HouseholdState['household']>> = {}): NonNullable<HouseholdState['household']> => ({
  id: 'h1',
  display_name: 'Pat Primary',
  size: 2,
  seats_used: 1,
  payment_accepted: true,
  primary: { id: 'p1', name: 'Pat Primary', fob_issued: false },
  members: [],
  invitations: [],
  ...overrides,
});

const state = (overrides: Partial<HouseholdState> = {}): HouseholdState => ({
  role: 'primary',
  household_plan: true,
  can_invite: true,
  invite_blocked_reason: null,
  plan_size: 2,
  household: null,
  invited_to_a_household: false,
  ...overrides,
});

describe('household flow', () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  describe('householdStep', () => {
    it('starts at pay when the payment is not accepted', () => {
      expect(householdStep(state({ can_invite: false }))).toBe(0);
      expect(householdStep(state({ household: household({ payment_accepted: false }) }))).toBe(0);
    });

    it('moves to invite, then waiting, then come in, then done', () => {
      expect(householdStep(state())).toBe(1);
      const waiting = household({ invitations: [{ id: 'i1', email: 'a@example.com', status: 'pending', expires_at: '2030-01-01', sent_count: 1 }] });
      expect(householdStep(state({ household: waiting }))).toBe(2);
      const joined = household({
        primary: { id: 'p1', name: 'Pat Primary', fob_issued: true },
        members: [{ id: 's1', name: 'Sam Second', fob_issued: false, status: 'Active' }],
      });
      expect(householdStep(state({ household: joined }))).toBe(3);
      const done = household({
        primary: { id: 'p1', name: 'Pat Primary', fob_issued: true },
        members: [{ id: 's1', name: 'Sam Second', fob_issued: true, status: 'Active' }],
      });
      expect(householdStep(state({ household: done }))).toBe(4);
    });
  });

  describe('HouseholdCardView', () => {
    const render = (props: Partial<React.ComponentProps<typeof HouseholdCardView>> = {}) => act(() => root.render(
      <HouseholdCardView state={state()} email="" onEmail={jest.fn()} onInvite={jest.fn()} onResend={jest.fn()} onRevoke={jest.fn()} busy={false} {...props} />
    ));

    it('shows how many adults the plan covers and the invite form for a primary with an accepted payment', () => {
      render();
      expect(container.textContent).toContain('covers up to 2 adults');
      expect(container.textContent).toContain('1 of 2 used');
      expect(container.querySelector('input[type="email"]')).not.toBeNull();
      expect(container.textContent).toContain(COME_IN_MESSAGE);
    });

    it('sends the invitation when the form is submitted', () => {
      const onInvite = jest.fn();
      render({ email: 'second@example.com', onInvite });
      act(() => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      expect(onInvite).toHaveBeenCalled();
    });

    it('hides the invite form and explains why when the primary cannot invite yet', () => {
      render({ state: state({ can_invite: false, invite_blocked_reason: 'Wait for the payment to be accepted.' }) });
      expect(container.querySelector('input[type="email"]')).toBeNull();
      expect(container.textContent).toContain('Wait for the payment to be accepted.');
    });

    it('lists open invitations with resend and cancel', () => {
      const onResend = jest.fn(), onRevoke = jest.fn();
      const withInvite = household({ seats_used: 2, invitations: [{ id: 'i1', email: 'second@example.com', status: 'pending', expires_at: '2030-01-01T00:00:00Z', sent_count: 1 }] });
      render({ state: state({ household: withInvite }), onResend, onRevoke });
      expect(container.textContent).toContain('second@example.com');
      const buttons = Array.from(container.querySelectorAll('button'));
      act(() => { buttons.find(b => b.textContent === 'Resend')!.click(); });
      act(() => { buttons.find(b => b.textContent === 'Cancel')!.click(); });
      expect(onResend).toHaveBeenCalledWith('i1');
      expect(onRevoke).toHaveBeenCalledWith('i1');
    });

    it('shows the unpaid message and blocks resending when the payment was reversed', () => {
      const unpaid = household({ payment_accepted: false, invitations: [{ id: 'i1', email: 'second@example.com', status: 'pending', expires_at: '2030-01-01T00:00:00Z', sent_count: 1 }] });
      render({ state: state({ household: unpaid, can_invite: false }) });
      expect(container.textContent).toContain(UNPAID_MESSAGE);
      const resend = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Resend')!;
      expect(resend.disabled).toBe(true);
    });

    it('shows a secondary the household and the unpaid state', () => {
      const unpaid = household({ payment_accepted: false });
      render({ state: state({ role: 'secondary', household: unpaid }) });
      expect(container.textContent).toContain('Pat Primary');
      expect(container.textContent).toContain(UNPAID_MESSAGE);
      expect(container.querySelector('input[type="email"]')).toBeNull();
    });

    it('renders nothing for a member with no household plan and no invitation', () => {
      render({ state: state({ role: null, household_plan: false, can_invite: false }) });
      expect(container.textContent).toBe('');
    });
  });

  describe('JoinHouseholdView', () => {
    const preview = {
      status: 'pending', primary_name: 'Pat Primary', household_address: '1 Main St, 03101', your_address: '1 Main St, 03101',
      address_matches: true, payment_accepted: true, blocked_reason: null, expires_at: '2030-01-01',
    };
    const render = (overrides: Partial<typeof preview> = {}, onJoin = jest.fn(), error?: string) => act(() => root.render(
      <MemoryRouter><JoinHouseholdView preview={{ ...preview, ...overrides } as any} onJoin={onJoin} joining={false} error={error} profileUrl="/members/me" /></MemoryRouter>
    ));
    const joinButton = () => container.querySelector<HTMLButtonElement>('#household-join-button')!;

    it('lets the invited person join when the address matches and the payment is accepted', () => {
      const onJoin = jest.fn();
      render({}, onJoin);
      expect(joinButton().disabled).toBe(false);
      act(() => joinButton().click());
      expect(onJoin).toHaveBeenCalled();
      expect(container.textContent).toContain(COME_IN_MESSAGE);
    });

    it('blocks joining and points to the profile when the address does not match', () => {
      render({ address_matches: false, your_address: '9 Other Rd, 03102' });
      expect(joinButton().disabled).toBe(true);
      expect(container.textContent).toContain('These do not match');
      expect(container.querySelector('a[href="/members/me"]')).not.toBeNull();
    });

    it('blocks joining when the household payment is not accepted', () => {
      render({ payment_accepted: false });
      expect(joinButton().disabled).toBe(true);
      expect(container.textContent).toContain('payment has not been accepted');
    });

    it('shows the date message for someone who already has a membership', () => {
      render({ blocked_reason: 'Your current membership runs to Dec 1, 2030. You can join after it ends.' });
      expect(joinButton().disabled).toBe(true);
      expect(container.textContent).toContain('Your current membership runs to Dec 1, 2030');
    });

    it('explains an expired invitation and shows server errors', () => {
      render({ status: 'expired' }, jest.fn(), 'Something failed');
      expect(joinButton().disabled).toBe(true);
      expect(container.textContent).toContain('This invitation has expired');
      expect(container.textContent).toContain('Something failed');
    });

    it.each(['expired', 'revoked', 'accepted'])('shows no household or address details for a %s invitation', (status) => {
      render({ status, primary_name: null, household_address: null, address_matches: false, payment_accepted: false });
      expect(joinButton().disabled).toBe(true);
      expect(container.textContent).not.toContain('Household address');
      expect(container.textContent).not.toContain('Your address');
      expect(container.textContent).not.toContain('These do not match');
    });
  });
});
