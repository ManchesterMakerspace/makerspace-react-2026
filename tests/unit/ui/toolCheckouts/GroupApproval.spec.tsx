import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ToolGroup } from 'app/entities/toolCheckout';
const mockReview = jest.fn();
const mockApprove = jest.fn();
jest.mock('api/toolCheckouts', () => ({
  reviewToolGroup: (...args: unknown[]) => mockReview(...args),
  approveToolGroup: (...args: unknown[]) => mockApprove(...args),
}));
jest.mock('ui/common/FormModal', () => ({ children, onSubmit, error }: any) => <div>{children}{error}<button onClick={onSubmit}>Approve</button></div>);
import GroupApproval from 'ui/toolCheckouts/GroupApproval';

describe('group approval review', () => {
  let root: Root;
  let container: HTMLDivElement;
  const group = { id: 'group', name: 'Kit', includedTools: [] } as unknown as ToolGroup;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    mockReview.mockResolvedValue({ data: { revision: 4, group: { ...group, includedTools: [{ id: 'tool', name: 'Current tool', wikiUrl: 'https://example.test/tool' }] },
      heldToolIds: [], createToolIds: ['tool'], prerequisiteIds: [], prerequisiteNames: [], missingPrerequisiteIds: [] } });
    mockApprove.mockReset();
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it('shows current membership and sends exactly the reviewed revision', async () => {
    const saved = jest.fn();
    mockApprove.mockResolvedValue({ data: {} });
    await act(async () => root.render(<GroupApproval group={group} memberId="member" onClose={jest.fn()} onSaved={saved} />));
    expect(container.textContent).toContain('New checkouts: Current tool');
    await act(async () => container.querySelector('button')!.click());
    expect(mockApprove).toHaveBeenCalledWith('group', 'member', 4, undefined);
    expect(saved).toHaveBeenCalledTimes(1);
  });
  it('requires a fresh review after a stale submission', async () => {
    mockApprove.mockResolvedValue({ error: { status: 409, message: 'Refresh the review' } });
    await act(async () => root.render(<GroupApproval group={group} memberId="member" onClose={jest.fn()} onSaved={jest.fn()} />));
    await act(async () => container.querySelector('button')!.click());
    await act(async () => container.querySelector('button')!.click());
    expect(mockApprove).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Refresh the review');
  });
});
