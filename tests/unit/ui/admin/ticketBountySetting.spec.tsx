import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
jest.mock('app/permissions', () => ({ useCapabilities: () => ({ canViewPortalSettings: true }) }));
jest.mock('api/systemConfig', () => ({ getSystemConfigs: jest.fn(), updateSystemSetting: jest.fn(), getBraintreeDiscounts: jest.fn() }));
import { getSystemConfigs, updateSystemSetting, getBraintreeDiscounts } from 'api/systemConfig';
import MemberPortalSettings from 'ui/admin/MemberPortalSettings';

describe('ticket bounty setting saves', () => {
  let root: Root; let host: HTMLDivElement;
  const button = (prefix: string) => document.querySelector(`button[aria-label^="${prefix}"]`) as HTMLButtonElement;
  const field = () => document.querySelector('input:not([type="checkbox"]):not([aria-hidden="true"])') as HTMLInputElement;
  const fill = async (text: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
  beforeEach(async () => {
    jest.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (getSystemConfigs as jest.Mock).mockResolvedValue({ data: { jobs: [], flags: {}, slack: { channel_cache: {} }, volunteer: { ticket_bounty_max_credit: '2' } } });
    (getBraintreeDiscounts as jest.Mock).mockResolvedValue({ data: [] });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><MemberPortalSettings /></MemoryRouter>));
    await act(async () => document.getElementById('settings-tab-volunteer')!.click());
    const edit = Array.from(document.querySelectorAll('button[aria-label^="Edit"]')).find(b => b.getAttribute('aria-label')!.toLowerCase().includes('ticket')) as HTMLButtonElement;
    await act(async () => edit.click());
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it('blocks invalid values, retains failed drafts, retries, and displays the saved value', async () => {
    for (const invalid of ['', ' ', '0.49', '-1', 'nope', 'Infinity', '0x10']) {
      await fill(invalid);
      expect(button('Save').disabled).toBe(true);
      expect(host.textContent).toContain('Enter a number of at least 0.5.');
    }
    expect(updateSystemSetting).not.toHaveBeenCalled();
    await fill('0.5'); expect(button('Save').disabled).toBe(false);
    (updateSystemSetting as jest.Mock).mockResolvedValueOnce({ error: { message: 'Server rejected the setting' } });
    await act(async () => button('Save').click());
    expect(field().value).toBe('0.5'); expect(host.textContent).toContain('Server rejected the setting');
    (updateSystemSetting as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
    await act(async () => button('Save').click());
    expect(field().value).toBe('0.5'); expect(host.textContent).toContain('Network unavailable');
    (updateSystemSetting as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => button('Save').click());
    expect(document.querySelector('input:not([type="checkbox"]):not([aria-hidden="true"])')).toBeNull();
    expect(updateSystemSetting).toHaveBeenLastCalledWith({ key: 'ticket_bounty_max_credit', value: '0.5' });
    const edit = Array.from(document.querySelectorAll('button[aria-label^="Edit"]')).find(b => b.getAttribute('aria-label')!.toLowerCase().includes('ticket')) as HTMLButtonElement;
    await act(async () => edit.click()); expect(field().value).toBe('0.5');
  });
});
