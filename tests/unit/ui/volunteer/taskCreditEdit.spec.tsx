import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: () => ({ data: [], refresh: jest.fn() }) }));
jest.mock('ui/common/MemberSearchInput', () => () => null);
import { EditTaskModal } from 'ui/volunteer/AdminVolunteerPage';

describe('bounty credit edits', () => {
  let root: Root;
  let host: HTMLDivElement;
  const task = { id: 'task', title: 'Repair', description: 'Replace switch', status: 'available', creditValue: 1, ticketId: 'ticket', prerequisiteToolIds: [] } as any;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it('submits uncapped credits without sending forbidden linked-bounty fields', async () => {
    const save = jest.fn();
    await act(async () => root.render(<EditTaskModal task={task} canEditCredits onClose={jest.fn()} onSave={save} loading={false} error='' />));
    const field = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(field.getAttribute('max')).toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '1000.5');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => (document.getElementById('edit-volunteer-task-submit') as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith('task', expect.objectContaining({ creditValue: 1000.5 }));
    expect(save.mock.calls[0][1]).not.toHaveProperty('shopId');
    expect(save.mock.calls[0][1]).not.toHaveProperty('days');
  });
  it('does not expose credit editing without admin/board capability', async () => {
    await act(async () => root.render(<EditTaskModal task={task} canEditCredits={false} onClose={jest.fn()} onSave={jest.fn()} loading={false} error='' />));
    expect(document.querySelector('input[type="number"]')).toBeNull();
  });
});
