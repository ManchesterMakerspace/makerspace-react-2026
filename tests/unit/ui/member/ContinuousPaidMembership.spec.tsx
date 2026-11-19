import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
const mockGet = jest.fn(), mockIncrease = jest.fn();
let mockUser: any;
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: mockUser }) }));
jest.mock('api/continuousPaidMembership', () => ({
  getContinuousPaidMembership: (...args: any[]) => mockGet(...args),
  increaseContinuousPaidMembership: (...args: any[]) => mockIncrease(...args),
}));
import ContinuousPaidMembership from 'ui/member/ContinuousPaidMembership';

describe('continuous paid membership profile control', () => {
  let host: HTMLDivElement, root: Root;
  const member = { id: 'subject', status: 'activeMember', expirationTime: Date.now() + 86400000 };
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockUser = { id: 'subject' };
    mockGet.mockReset().mockResolvedValue({ continuousPaidMembershipMonths: 11, revision: 7, estimated: true });
    mockIncrease.mockReset().mockResolvedValue({ continuousPaidMembershipMonths: 12, revision: 8, estimated: true });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = () => act(async () => { root.render(<ContinuousPaidMembership member={member} />); });
  const button = (label: string) => Array.from(document.querySelectorAll('button')).find(b => b.textContent === label)!;
  async function enter(label: string, value: string) {
    const field = document.querySelector(`[aria-label="${label}"]`) ||
      Array.from(document.querySelectorAll('input,textarea')).find(el => {
        const id = el.getAttribute('id'); return id && document.querySelector(`label[for="${id}"]`)?.textContent?.startsWith(label);
      });
    await act(async () => {
      const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
      field!.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('shows the owner their stored count and estimated history without an edit action', async () => {
    await render();
    expect(host.textContent).toContain('Continuous paid membership: 11 months');
    expect(host.textContent).toContain('Estimated history');
    expect(button('Adjust months')).toBeUndefined();
  });

  it('reloads the count after a profile status change revokes membership', async () => {
    await render();
    mockGet.mockResolvedValueOnce({ continuousPaidMembershipMonths: 0, revision: 8, estimated: true });
    await act(async () => {
      root.render(<ContinuousPaidMembership member={{ ...member, status: 'revoked' }} />);
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Continuous paid membership: 0 months');
  });

  it.each([{ id: 'other' }, { id: 'other', isResourceManager: true }])('does not fetch another profile for an unauthorized viewer', async user => {
    mockUser = user; await render();
    expect(mockGet).not.toHaveBeenCalled();
    expect(host.textContent).toBe('');
  });

  it('allows Board to read another profile without exposing corrections', async () => {
    mockUser = { id: 'board', isBoardMember: true }; await render();
    expect(mockGet).toHaveBeenCalledWith('subject');
    expect(button('Adjust months')).toBeUndefined();
  });

  it('requires an integer increase and reason, then sends the displayed revision', async () => {
    mockUser = { id: 'admin', isAdmin: true }; await render();
    await act(async () => button('Adjust months').click());
    await enter('Proposed months', '11.5'); await enter('Correction reason', 'Verified receipt');
    expect(button('Save increase').disabled).toBe(true);
    await enter('Proposed months', '11'); expect(button('Save increase').disabled).toBe(true);
    await enter('Proposed months', '12');
    await act(async () => button('Save increase').click());
    expect(mockIncrease).toHaveBeenCalledWith('subject', { continuousPaidMembershipMonths: 12, expectedRevision: 7, reason: 'Verified receipt' });
    expect(host.textContent).toContain('Continuous paid membership: 12 months');
    expect(host.textContent).toContain('Paid membership months increased to 12.');
  });

  it('refreshes a conflict and requires a new review before another submission', async () => {
    mockUser = { id: 'admin', isAdmin: true }; await render();
    mockIncrease.mockRejectedValueOnce(Object.assign(new Error('Conflict'), { status: 409 }));
    mockGet.mockResolvedValueOnce({ continuousPaidMembershipMonths: 15, revision: 9, estimated: false });
    await act(async () => button('Adjust months').click());
    await enter('Proposed months', '12'); await enter('Correction reason', 'Verified receipt');
    await act(async () => button('Save increase').click());
    expect(document.body.textContent).toContain('Current value: 15 months');
    expect(document.body.textContent).toContain('review it before saving again');
    expect(button('Save increase').disabled).toBe(true);
    await enter('Proposed months', '16');
    await act(async () => button('Save increase').click());
    expect(mockIncrease.mock.calls[1][1].expectedRevision).toBe(9);
  });

  it('offers recovery from a read failure and prevents edits until refreshed', async () => {
    mockUser = { id: 'admin', isAdmin: true };
    mockGet.mockRejectedValueOnce(new Error('Network unavailable'));
    await render();
    expect(host.textContent).toContain('Network unavailable');
    await act(async () => button('Retry').click());
    expect(host.textContent).toContain('Continuous paid membership: 11 months');
  });
});
