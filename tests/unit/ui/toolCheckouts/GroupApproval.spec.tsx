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
jest.mock('ui/common/FormModal', () => ({ children, onSubmit, error, submitDisabled, submitText }: any) => <div>{children}{error}<button disabled={submitDisabled} onClick={onSubmit}>{submitText}</button></div>);
import GroupApproval from 'ui/toolCheckouts/GroupApproval';

describe('group approval review', () => {
  let root: Root;
  let container: HTMLDivElement;
  const group = { id: 'group', name: 'Kit', includedTools: [] } as unknown as ToolGroup;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    mockReview.mockReset();
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
    const submit = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Approve group')!;
    expect(submit.disabled).toBe(true);
    await act(async () => submit.click());
    expect(mockApprove).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Refresh the review');
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Retry review')!.click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(submit.disabled).toBe(false);
  });
  it.each(['api', 'rejected', 'empty'])('shows %s load failures immediately and retries in place', async failure => {
    if (failure === 'rejected') mockReview.mockRejectedValueOnce(new Error('offline'));
    else mockReview.mockResolvedValueOnce(failure === 'api' ? { error: { message: 'Review unavailable' } } : {});
    await act(async () => root.render(<GroupApproval group={group} memberId="member" requestId="request" onClose={jest.fn()} onSaved={jest.fn()} />));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const submit = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Approve group')!;
    expect(submit.disabled).toBe(true);
    let resolve: (value: any) => void;
    mockReview.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Retry review')!.click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading group review');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(submit.disabled).toBe(true);
    await act(async () => resolve!({ data: { revision: 5, group, heldToolIds: [], createToolIds: [], prerequisiteIds: [], prerequisiteNames: [], missingPrerequisiteIds: [] } }));
    expect(submit.textContent).toBe('Resolve request');
    expect(submit.disabled).toBe(false);
    mockApprove.mockResolvedValueOnce({ data: {} });
    await act(async () => submit.click());
    expect(mockApprove).toHaveBeenCalledWith('group', 'member', 5, 'request');
    expect(mockReview).toHaveBeenCalledTimes(2);
  });
  it.each([undefined, 'request'])('handles all-held reviews with requestId=%s', async requestId => {
    mockReview.mockResolvedValueOnce({ data: { revision: 4, group, heldToolIds: ['tool'], createToolIds: [], prerequisiteIds: [], prerequisiteNames: [], missingPrerequisiteIds: [] } });
    mockApprove.mockResolvedValueOnce({ data: {} });
    const saved = jest.fn();
    await act(async () => root.render(<GroupApproval group={group} memberId="member" requestId={requestId} onClose={jest.fn()} onSaved={saved} />));
    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(!requestId);
    await act(async () => button.click());
    if (requestId) {
      expect(button.textContent).toBe('Resolve request');
      expect(mockApprove).toHaveBeenCalledWith('group', 'member', 4, 'request');
      expect(saved).toHaveBeenCalledTimes(1);
    } else expect(mockApprove).not.toHaveBeenCalled();
  });

});
