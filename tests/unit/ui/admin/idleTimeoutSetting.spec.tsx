import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
jest.mock('app/permissions', () => ({ useCapabilities: () => ({ canViewPortalSettings: true }) }));
jest.mock('api/systemConfig', () => ({
  getSystemConfigs: jest.fn(), updateSystemSetting: jest.fn(), updateSystemFlag: jest.fn(), getBraintreeDiscounts: jest.fn(),
}));
import { getSystemConfigs, updateSystemSetting, getBraintreeDiscounts } from 'api/systemConfig';
import MemberPortalSettings, { validateIdleTimeoutMinutes } from 'ui/admin/MemberPortalSettings';

describe('idle session timeout setting', () => {
  let root: Root; let host: HTMLDivElement;
  const button = (prefix: string) => document.querySelector(`button[aria-label^="${prefix}"]`) as HTMLButtonElement;
  // The page has other text inputs, so find ours through its label.
  const field = () => {
    const label = Array.from(document.querySelectorAll('label')).find(l => /Idle Session Timeout/.test(l.textContent || ''));
    return document.getElementById(label!.getAttribute('for')!) as HTMLInputElement;
  };
  const fill = async (text: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
  const open = async (security?: unknown) => {
    (getSystemConfigs as jest.Mock).mockResolvedValue({
      data: { jobs: [], flags: {}, slack: { channel_cache: {} }, totp: {}, ...(security === undefined ? {} : { security }) },
    });
    (getBraintreeDiscounts as jest.Mock).mockResolvedValue({ data: [] });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><MemberPortalSettings /></MemoryRouter>));
    await act(async () => document.getElementById('settings-tab-security')!.click());
  };
  beforeEach(() => { jest.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; root = undefined as any; host = undefined as any; });
  afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); });

  it('only accepts a plain positive whole number (a leading zero would be read as octal by the server)', () => {
    ['1', '5', '30', '480', '1440'].forEach(value => expect(validateIdleTimeoutMinutes(value)).toBe(''));
    ['', ' ', '0', '-5', '1.5', '030', '08', '30 ', ' 30', 'abc', '1e3', '0x10', 'Infinity', '99999999999999999999']
      .forEach(value => expect(validateIdleTimeoutMinutes(value)).not.toBe(''));
  });

  it('shows the current value from the server on the Security tab', async () => {
    await open({ devise_timeout_minutes: '45', ticket_open_limit: 3 });
    expect(host.textContent).toContain('Idle Session Timeout (minutes)');
    expect(host.textContent).toContain('45');
  });

  it('shows the default of 30 when the server does not send a value', async () => {
    await open();
    expect(host.textContent).toContain('Idle Session Timeout (minutes)');
    expect(host.textContent).toContain('30');
  });

  it('blocks invalid values, keeps a failed draft, retries, then saves and shows the new value', async () => {
    await open({ devise_timeout_minutes: '30' });
    await act(async () => button('Edit Idle Session Timeout').click());
    for (const invalid of ['', '0', '-1', '1.5', '030', 'abc']) {
      await fill(invalid);
      expect(button('Save Idle Session Timeout').disabled).toBe(true);
      expect(host.textContent).toContain('Enter a whole number of minutes, at least 1, with no leading zero.');
    }
    expect(updateSystemSetting).not.toHaveBeenCalled();

    await fill('60'); expect(button('Save Idle Session Timeout').disabled).toBe(false);
    (updateSystemSetting as jest.Mock).mockResolvedValueOnce({ error: { message: 'Server rejected the setting' } });
    await act(async () => button('Save Idle Session Timeout').click());
    expect(field().value).toBe('60'); expect(host.textContent).toContain('Server rejected the setting');

    (updateSystemSetting as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
    await act(async () => button('Save Idle Session Timeout').click());
    expect(field().value).toBe('60'); expect(host.textContent).toContain('Network unavailable');

    (updateSystemSetting as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => button('Save Idle Session Timeout').click());
    expect(updateSystemSetting).toHaveBeenLastCalledWith({ key: 'devise_timeout_minutes', value: '60' });
    expect(button('Edit Idle Session Timeout')).not.toBeNull();
    expect(host.textContent).toContain('60');
  });
});
