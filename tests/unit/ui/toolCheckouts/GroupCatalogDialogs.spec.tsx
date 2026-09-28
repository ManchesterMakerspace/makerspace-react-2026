import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
const mockGroups = jest.fn();
jest.mock('api/toolCheckouts', () => ({ listToolGroups: (...args: any[]) => mockGroups(...args) }));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: {} }) }));
jest.mock('ui/hooks/useReadTransaction', () => () => ({ data: [], refresh: jest.fn() }));
jest.mock('ui/hooks/useWriteTransaction', () => () => ({ call: jest.fn() }));
jest.mock('ui/common/Filters/QueryContext', () => ({ withQueryContext: (component: any) => component }));
jest.mock('ui/common/MemberSearchInput', () => ({ onChange }: any) => <button onClick={() => onChange({ value: 'member', label: 'Member' })}>Choose member</button>);
jest.mock('ui/common/FormModal', () => ({ children, onSubmit, submitDisabled }: any) =>
  <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>{children}<button type="submit" disabled={submitDisabled}>Save</button></form>);
import { CheckoutModal } from 'ui/toolCheckouts/CheckoutRoster';
import { ApproverModal } from 'ui/toolCheckouts/CheckoutApproversManager';

describe('group catalog dialog recovery', () => {
  let host: HTMLDivElement;
  let root: Root;
  const shops = [{ id: 'wood', name: 'Woodshop' }] as any;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockGroups.mockReset();
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it.each(['checkout', 'approver'])('keeps %s incomplete while loading and recovers from a rejected catalog', async kind => {
    let reject: (error: Error) => void;
    mockGroups.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }))
      .mockResolvedValueOnce({ data: [{ id: 'kit', shopId: 'wood', name: 'Kit', canApprove: true }] });
    const save = jest.fn();
    const existing = { id: 'assignment', memberId: 'member', memberName: 'Member', shopIds: [], toolIds: [], toolGroupIds: ['kit'] } as any;
    await act(async () => root.render(kind === 'checkout'
      ? <CheckoutModal shops={[]} allShops={shops} tools={[]} preselectedMember={{ id: 'member', name: 'Member' }} onClose={jest.fn()} onCheckout={save} loading={false} error="" />
      : <ApproverModal shops={shops} tools={[]} existing={existing} onClose={jest.fn()} onSave={save} loading={false} error="" />));
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading tool groups');
    await act(async () => reject!(new Error('Network unavailable')));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Unable to load tool groups');
    expect(submit.disabled).toBe(true);
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(save).not.toHaveBeenCalled();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Retry tool groups')!.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(submit.disabled).toBe(false);
    if (kind === 'checkout') {
      expect(host.querySelector('select[aria-label="Shop"]')?.textContent).toContain('Woodshop');
    } else {
      expect(host.textContent).toContain('Kit');
      await act(async () => submit.click());
      expect(save).toHaveBeenCalledWith('member', [], [], 'assignment', ['kit']);
    }
  });
  it('clears only the selected shop child scopes and does not restore them when deselected', async () => {
    mockGroups.mockResolvedValue({ data: [
      { id: 'kit', shopId: 'wood', name: 'Kit' }, { id: 'other', shopId: 'metal', name: 'Other' }
    ] });
    const save = jest.fn();
    const existing = { id: 'assignment', memberId: 'member', memberName: 'Member', shopIds: [], toolIds: ['saw'], toolGroupIds: ['kit', 'other'] } as any;
    await act(async () => root.render(<ApproverModal shops={shops} tools={[{ id: 'saw', shopId: 'wood', name: 'Saw' }] as any}
      existing={existing} onClose={jest.fn()} onSave={save} loading={false} error="" />));
    const shop = Array.from(host.querySelectorAll('[role="button"]')).find(button => button.textContent?.includes('Woodshop')) as HTMLElement;
    await act(async () => shop.click());
    await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(save).toHaveBeenLastCalledWith('member', ['wood'], [], 'assignment', ['other']);
    await act(async () => shop.click());
    await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(save).toHaveBeenLastCalledWith('member', [], [], 'assignment', ['other']);
  });
  it('shows API errors when adding an approver and restores group choices after retry', async () => {
    mockGroups.mockResolvedValueOnce({ error: { message: 'Unavailable' } })
      .mockResolvedValueOnce({ data: [{ id: 'kit', shopId: 'wood', name: 'Kit' }] });
    await act(async () => root.render(<ApproverModal shops={shops} tools={[]} existing={null} onClose={jest.fn()} onSave={jest.fn()} loading={false} error="" />));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Retry tool groups')!.click());
    expect(host.textContent).toContain('Kit');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
