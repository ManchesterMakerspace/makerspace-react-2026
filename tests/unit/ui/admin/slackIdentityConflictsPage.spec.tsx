import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
jest.mock('api/slackIdentityConflicts', () => ({
  getSlackIdentityConflicts: jest.fn(),
  resolveSlackIdentityConflict: jest.fn(),
  dismissSlackIdentityConflict: jest.fn(),
}));
jest.mock('api/systemConfig', () => ({ updateSystemSetting: jest.fn() }));
import { getSlackIdentityConflicts } from 'api/slackIdentityConflicts';
import { updateSystemSetting } from 'api/systemConfig';
import SlackIdentityConflictsPage, { validateSlackScanSize } from 'ui/admin/SlackIdentityConflictsPage';

const conflict = (slackId: string) => ({
  slack_id: slackId, slack_name: `Name ${slackId}`, slack_email: `${slackId}@example.com`,
  member_id: `member-${slackId}`, member_name: `Member ${slackId}`,
  conflicting_slack_id: 'ULINKED', conflicting_slack_name: 'Linked', conflicting_slack_email: 'linked@example.com',
});

describe('validateSlackScanSize', () => {
  it('accepts whole numbers from 10 to 500 only', () => {
    ['10', '200', '500'].forEach(value => expect(validateSlackScanSize(value)).toBe(''));
    ['', '9', '501', '0', '-1', '2.5', 'abc', '1e2'].forEach(value =>
      expect(validateSlackScanSize(value)).toBe('Enter a whole number from 10 to 500.'));
  });
});

describe('Slack Identity Conflicts page', () => {
  let root: Root; let host: HTMLDivElement;
  const render = async () => {
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><SlackIdentityConflictsPage /></MemoryRouter>));
  };
  const reply = (data: any) => ({ data, response: {} });
  const advance = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

  beforeEach(() => {
    jest.clearAllMocks(); jest.useFakeTimers(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); jest.useRealTimers(); });

  it('shows a finished check without polling again', async () => {
    (getSlackIdentityConflicts as jest.Mock).mockResolvedValue(reply({ conflicts: [conflict('UONE')], live_check: 'fresh', scan_size: 200 }));
    await render();

    expect(host.textContent).toContain('Member UONE');
    expect(host.textContent).not.toContain('Checking Slack in small steps');
    await advance(10000);
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(1);
  });

  it('keeps asking while the check is under way, shows progress and what was found, then stops', async () => {
    (getSlackIdentityConflicts as jest.Mock)
      .mockResolvedValueOnce(reply({ conflicts: [], live_check: 'scanning', scan_size: 200, progress: { checked: 200, estimated_total: 1000, waiting_seconds: 0 } }))
      .mockResolvedValueOnce(reply({ conflicts: [conflict('UONE')], live_check: 'scanning', scan_size: 200, progress: { checked: 400, estimated_total: 1000, waiting_seconds: 0 } }))
      .mockResolvedValue(reply({ conflicts: [conflict('UONE')], live_check: 'fresh', scan_size: 200 }));
    await render();

    expect(host.textContent).toContain('Checking Slack in small steps');
    expect(host.textContent).toContain('200 of about 1000 Slack accounts checked so far');
    expect(host.textContent).toContain('No Slack identity conflicts found so far.');

    await advance(400);
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('400 of about 1000');
    expect(host.textContent).toContain('Member UONE');

    await advance(400);
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(3);
    expect(host.textContent).not.toContain('Checking Slack in small steps');
    await advance(10000);
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(3);
  });

  it('waits as long as Slack asked before the next step', async () => {
    (getSlackIdentityConflicts as jest.Mock)
      .mockResolvedValueOnce(reply({ conflicts: [], live_check: 'scanning', scan_size: 200, progress: { checked: 10, estimated_total: null, waiting_seconds: 30 } }))
      .mockResolvedValue(reply({ conflicts: [], live_check: 'fresh', scan_size: 200 }));
    await render();

    expect(host.textContent).toContain('Slack asked us to slow down');
    expect(host.textContent).toContain('10 Slack accounts checked so far');
    await advance(20000);
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(1);
    await advance(11000);
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(2);
  });

  it('stops asking when the page is closed', async () => {
    (getSlackIdentityConflicts as jest.Mock).mockResolvedValue(reply({ conflicts: [], live_check: 'scanning', scan_size: 200, progress: { checked: 1, estimated_total: null, waiting_seconds: 0 } }));
    await render();
    act(() => root.unmount());
    await advance(5000);

    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(1);
    root = createRoot(host);
  });

  it('points to the scan size when the live check could not finish, and lets the admin try again', async () => {
    (getSlackIdentityConflicts as jest.Mock)
      .mockResolvedValueOnce(reply({ conflicts: [], live_check: 'unavailable', scan_size: 200 }))
      .mockResolvedValue(reply({ conflicts: [], live_check: 'fresh', scan_size: 200 }));
    await render();

    expect(host.textContent).toContain('could not finish');
    expect(host.textContent).toContain('lower the number of Slack accounts checked per request');
    const tryAgain = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Try again')!;
    await act(async () => tryAgain.click());
    expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain('could not finish');
  });

  describe('Slack accounts checked per request', () => {
    const editButton = () => host.querySelector('button[aria-label^="Edit Slack accounts checked per request"]') as HTMLButtonElement;
    const field = () => host.querySelector('input') as HTMLInputElement;
    const fill = async (text: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
      field().dispatchEvent(new Event('input', { bubbles: true }));
    });
    const saveButton = () => host.querySelector('button[aria-label="Save Slack accounts checked per request"]') as HTMLButtonElement;

    beforeEach(() => {
      (getSlackIdentityConflicts as jest.Mock).mockResolvedValue(reply({ conflicts: [], live_check: 'fresh', scan_size: 150 }));
    });

    it('shows the current number', async () => {
      await render();
      expect(host.textContent).toContain('Slack accounts checked per request');
      expect(host.textContent).toContain('150');
    });

    it('refuses a number outside 10 to 500', async () => {
      await render();
      await act(async () => editButton().click());
      await fill('5');

      expect(host.textContent).toContain('Enter a whole number from 10 to 500.');
      expect(saveButton().disabled).toBe(true);
      expect(updateSystemSetting).not.toHaveBeenCalled();
    });

    it('saves the new number and starts the check again', async () => {
      (updateSystemSetting as jest.Mock).mockResolvedValue({ data: { key: 'slack_conflict_scan_size', value: '50' } });
      await render();
      await act(async () => editButton().click());
      await fill('50');
      await act(async () => saveButton().click());

      expect(updateSystemSetting).toHaveBeenCalledWith({ key: 'slack_conflict_scan_size', value: '50' });
      expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(2);
    });

    it('shows the server message and does not check again when the save fails', async () => {
      (updateSystemSetting as jest.Mock).mockResolvedValue({ error: { message: 'Slack accounts per scan step must be a whole number from 10 to 500' } });
      await render();
      await act(async () => editButton().click());
      await fill('50');
      await act(async () => saveButton().click());

      expect(host.textContent).toContain('whole number from 10 to 500');
      expect(getSlackIdentityConflicts).toHaveBeenCalledTimes(1);
    });
  });
});
