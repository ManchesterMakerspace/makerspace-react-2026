import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { householdNextStep, StaffHouseholdPanelView } from 'ui/member/StaffHouseholdPanel';

// The panel is pure; the data hook and API module pull in the store and Firebase, so stub them.
jest.mock('api/household', () => ({}));
jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: jest.fn() }));

describe('staff household panel', () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

    const member = (overrides: object = {}) => ({ id: 'm', firstname: 'Pat', lastname: 'Primary', email: 'p@example.com', fobIssued: true, ...overrides });
    const staff = (overrides: object = {}): any => ({
      id: 'h1', groupName: 'p', groupRep: 'Pat Primary', size: 2, seatsUsed: 2, paymentAccepted: true,
      primaryMember: member(), secondaryMembers: [member({ id: 's', firstname: 'Sam', lastname: 'Second' })], invitations: [], ...overrides,
    });

    it('says what to do next in each state', () => {
      expect(householdNextStep(staff({ paymentAccepted: false }))).toContain('not accepted');
      expect(householdNextStep(staff({ primaryMember: member({ fobIssued: false }) }))).toContain('Issue a fob to Pat Primary');
      expect(householdNextStep(staff({ secondaryMembers: [member({ id: 's', firstname: 'Sam', lastname: 'Second', fobIssued: false })] })))
        .toContain('Issue a fob to Sam Second');
      expect(householdNextStep(staff({ secondaryMembers: [], invitations: [{ id: 'i', email: 'a@example.com', status: 'pending', expiresAt: '', sentCount: 1 }] })))
        .toContain('Waiting for the second adult');
      expect(householdNextStep(staff({ secondaryMembers: [] }))).toContain('invite them from their home page');
      expect(householdNextStep(staff())).toContain('Nothing to do');
    });

    it('shows each person, an unpaid warning, and pending invitations', () => {
      act(() => root.render(<StaffHouseholdPanelView household={staff({
        paymentAccepted: false,
        invitations: [{ id: 'i', email: 'later@example.com', status: 'expired', expiresAt: '', sentCount: 2 }],
      })} />));
      expect(container.querySelector('#staff-household-unpaid')).not.toBeNull();
      expect(container.textContent).toContain('Pat Primary');
      expect(container.textContent).toContain('Sam Second');
      expect(container.textContent).toContain('later@example.com');
      expect(container.textContent).toContain('Invitation expired');
      expect(container.querySelector('#staff-household-next-step')!.textContent).toContain('not accepted');
    });
  });
