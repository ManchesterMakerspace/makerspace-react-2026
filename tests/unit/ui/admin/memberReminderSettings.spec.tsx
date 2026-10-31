import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
jest.mock('app/permissions', () => ({ useCapabilities: () => ({ canViewPortalSettings: true }) }));
jest.mock('api/systemConfig', () => ({
  getSystemConfigs: jest.fn(),
  updateSystemSetting: jest.fn(),
  updateSystemFlag: jest.fn(),
  getBraintreeDiscounts: jest.fn(),
  runSystemJob: jest.fn(),
}));
import { getSystemConfigs, updateSystemSetting, updateSystemFlag, getBraintreeDiscounts } from 'api/systemConfig';
import MemberPortalSettings, { validateReminderDays } from 'ui/admin/MemberPortalSettings';

describe('validateReminderDays', () => {
  it('accepts whole numbers from 1 to 14 only', () => {
    ['1', '7', '14'].forEach(value => expect(validateReminderDays(value)).toBe(''));
    ['', ' ', '0', '15', '-1', '3.5', 'abc', '1e1'].forEach(value =>
      expect(validateReminderDays(value)).toBe('Enter a whole number from 1 to 14.'));
  });
});

describe('member reminder settings on the Jobs tab', () => {
  let root: Root; let host: HTMLDivElement;
  const field = () => document.querySelector('input:not([type="checkbox"]):not([aria-hidden="true"])') as HTMLInputElement;
  const buttonFor = (prefix: string, label: string) => Array.from(document.querySelectorAll(`button[aria-label^="${prefix}"]`))
    .find(b => b.getAttribute('aria-label')!.toLowerCase().includes(label)) as HTMLButtonElement;
  const fill = async (text: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });

  beforeEach(async () => {
    jest.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (getSystemConfigs as jest.Mock).mockResolvedValue({
      data: {
        jobs: [{ key: 'member_reminders', task: 'member_reminders', last_run_at: null, last_run_status: null }],
        flags: { fob_reminder_enabled: false, signup_reminder_enabled: true },
        slack: { channel_cache: {} },
        volunteer: {},
        job_schedule: { channel_cache_refresh_day: '1', card_expiration_check_day: '1', garbage_collect_day: '1' },
        reminders: { fob_reminder_days: '7', signup_reminder_days: '10' },
      },
    });
    (getBraintreeDiscounts as jest.Mock).mockResolvedValue({ data: [] });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><MemberPortalSettings /></MemoryRouter>));
    await act(async () => document.getElementById('settings-tab-jobs')!.click());
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it('shows both reminders, their on/off state and their days, and names the job', () => {
    expect(host.textContent).toContain('Key fob reminder');
    expect(host.textContent).toContain('Finish-joining reminder');
    expect(host.textContent).toContain('Member Reminder Emails');
    expect((document.querySelector('input#fob_reminder_enabled-switch') as HTMLInputElement).checked).toBe(false);
    expect((document.querySelector('input#signup_reminder_enabled-switch') as HTMLInputElement).checked).toBe(true);
    expect(host.textContent).toContain('Days after first payment');
    expect(host.textContent).toContain('10');
  });

  it('switches a reminder on through the flag endpoint', async () => {
    (updateSystemFlag as jest.Mock).mockResolvedValue({ data: {} });

    await act(async () => (document.querySelector('input#fob_reminder_enabled-switch') as HTMLInputElement).click());

    expect(updateSystemFlag).toHaveBeenCalledWith('fob_reminder_enabled', true);
  });

  it('blocks invalid days and saves a valid value through the setting endpoint', async () => {
    await act(async () => buttonFor('Edit', 'after first payment').click());
    for (const invalid of ['', '0', '15', 'abc']) {
      await fill(invalid);
      expect((document.querySelector('button[aria-label^="Save"]') as HTMLButtonElement).disabled).toBe(true);
      expect(host.textContent).toContain('Enter a whole number from 1 to 14.');
    }
    expect(updateSystemSetting).not.toHaveBeenCalled();

    (updateSystemSetting as jest.Mock).mockResolvedValue({ data: {} });
    await fill('10');
    await act(async () => (document.querySelector('button[aria-label^="Save"]') as HTMLButtonElement).click());

    expect(updateSystemSetting).toHaveBeenLastCalledWith({ key: 'fob_reminder_days', value: '10' });
  });
});
