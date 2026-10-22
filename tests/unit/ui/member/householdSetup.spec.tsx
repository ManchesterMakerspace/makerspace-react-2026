import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  HOUSEHOLD_SETUP_TOAST_MESSAGE, HouseholdSetupBanner, needsHouseholdSetup, useHouseholdSetupToast
} from 'ui/member/householdSetup';

const mockCreate = jest.fn();
jest.mock('components/Toast/Toast', () => ({
  ToastStatus: { Success: 'success', Error: 'error', Warning: 'warning', Info: 'info' },
  useToastContext: () => ({ create: (...args: any[]) => mockCreate(...args) }),
}));

describe('household setup reminder', () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('reads the server flag and never infers a household from anything else', () => {
    expect(needsHouseholdSetup({ householdSetupNeeded: true })).toBe(true);
    expect(needsHouseholdSetup({ householdSetupNeeded: false })).toBe(false);
    // A legacy group name or role without the flag must not trigger the reminder.
    expect(needsHouseholdSetup({ groupName: 'legacy-partner-group' })).toBe(false);
    expect(needsHouseholdSetup({ householdRole: 'secondary' })).toBe(false);
    expect(needsHouseholdSetup(undefined)).toBe(false);
  });

  it('shows the banner with the steps when the member needs a household', () => {
    act(() => root.render(<HouseholdSetupBanner member={{ householdSetupNeeded: true }} />));
    const banner = container.querySelector('#member-household-setup-banner');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Create Household');
    expect(banner!.textContent).toContain('Manage Household');
    expect(banner!.textContent).toContain('Add Secondary Member');
  });

  it('renders nothing for a member who does not need a household', () => {
    act(() => root.render(<HouseholdSetupBanner member={{ householdSetupNeeded: false }} />));
    expect(container.querySelector('#member-household-setup-banner')).toBeNull();
    act(() => root.render(<HouseholdSetupBanner member={{}} />));
    expect(container.querySelector('#member-household-setup-banner')).toBeNull();
  });

  it('toasts a warning after an onboarding step only when a household is needed', () => {
    let show: (member?: unknown) => void = () => {};
    const Probe: React.FC = () => { show = useHouseholdSetupToast(); return null; };
    act(() => root.render(<Probe />));

    show({ householdSetupNeeded: false });
    expect(mockCreate).not.toHaveBeenCalled();

    show({ householdSetupNeeded: true });
    expect(mockCreate).toHaveBeenCalledWith({ message: HOUSEHOLD_SETUP_TOAST_MESSAGE, status: 'warning' });
  });
});
