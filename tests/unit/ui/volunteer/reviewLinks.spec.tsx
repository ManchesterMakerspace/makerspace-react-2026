import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';

let mockCanDeleteVolunteerRecords = false;
let mockTableProps: Record<string, any> = {};

jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('ui/hooks/useWriteTransaction', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('app/permissions', () => ({
  useCapabilities: () => ({ canDeleteVolunteerRecords: mockCanDeleteVolunteerRecords }),
}));
jest.mock('ui/common/MemberSearchInput', () => () => null);
jest.mock('ui/common/table/StatefulTable', () => ({
  __esModule: true,
  default: (props: any) => {
    mockTableProps[props.id] = props;
    return (
      <div id={props.id} data-selected={JSON.stringify(props.selectedIds)}>
        {props.data.map((row: any) => <div key={row.id}>{row.title}</div>)}
      </div>
    );
  },
}));

import AdminVolunteerPage from 'ui/volunteer/AdminVolunteerPage';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';
import {
  adminListVolunteerTasks, adminListVolunteerEvents, adminListVolunteerCredits,
  adminCreateVolunteerTask, adminCompleteVolunteerTask, adminCloseVolunteerEvent,
  adminDeleteVolunteerTask, adminDeleteVolunteerEvent, adminDeleteVolunteerCredit,
} from 'api/volunteer';
import { listManagedShops } from 'api/toolCheckouts';

describe('volunteer review links', () => {
  let host: HTMLDivElement;
  let root: Root;
  let tasks: any[];
  let events: any[];
  let children: any[];
  let credits: any[];
  let reads: Record<string, { isRequesting: boolean; error: string }>;
  const taskId = '000000000000000000000017';
  const eventId = '000000000000000000000008';
  const createTask = jest.fn();
  const verify = jest.fn();
  const closeEvent = jest.fn();
  const deleteTask = jest.fn();
  const deleteEvent = jest.fn();
  const deleteCredit = jest.fn();
  const refresh = jest.fn();
  let navigate: ReturnType<typeof useNavigate>;

  const Page = () => {
    navigate = useNavigate();
    return <AdminVolunteerPage />;
  };

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockCanDeleteVolunteerRecords = false;
    mockTableProps = {};
    reads = Object.fromEntries(['tasks', 'events', 'children', 'credits'].map(key => [key, {
      isRequesting: false, error: '',
    }]));
    tasks = [
      { id: 'parent', title: 'Reusable parent', status: 'reusable', creditValue: 1 },
      { id: taskId, parentTaskId: 'parent', title: 'Exact child claim', status: 'pending', creditValue: 1 },
      { id: 'other', title: 'Other pending claim', status: 'pending', creditValue: 1 },
    ];
    events = [
      { id: eventId, title: 'Exact event', status: 'open', creditValue: 1, attendeeCount: 2 },
      { id: 'other-event', title: 'Other event', status: 'open', creditValue: 1 },
    ];
    children = [tasks[1]];
    credits = [{ id: 'credit-id', title: 'Approved credit', status: 'approved', creditValue: 1 }];
    [createTask, verify, closeEvent, deleteTask, deleteEvent, deleteCredit, refresh].forEach(mock => mock.mockClear());
    (useReadTransaction as jest.Mock).mockImplementation((transaction: unknown, args: any) => {
      const type = transaction === adminListVolunteerTasks ? (args.parentTaskId ? 'children' : 'tasks')
        : transaction === adminListVolunteerEvents ? 'events'
          : transaction === adminListVolunteerCredits ? 'credits' : null;
      const data = { tasks, events, children, credits };
      return {
        data: transaction === listManagedShops ? [{ id: 'woodshop', name: 'Woodshop' }] : type ? data[type] : [],
        refresh, ...(type ? reads[type] : { isRequesting: false, error: '' }),
      };
    });
    (useWriteTransaction as jest.Mock).mockImplementation((transaction: unknown, onSuccess?: () => void) => ({
      call: transaction === adminCreateVolunteerTask ? (args: any) => { createTask(args); onSuccess?.(); }
        : transaction === adminCompleteVolunteerTask ? verify
        : transaction === adminCloseVolunteerEvent ? closeEvent
          : transaction === adminDeleteVolunteerTask ? deleteTask
            : transaction === adminDeleteVolunteerEvent ? deleteEvent
              : transaction === adminDeleteVolunteerCredit ? deleteCredit : jest.fn(),
      isRequesting: false, error: '',
    }));
    host = document.createElement('div'); document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount()); host.remove();
    window.history.replaceState(null, '', '/');
  });

  async function open(query: string) {
    window.history.replaceState(null, '', `/volunteer?${query}`);
    await act(async () => root.render(<BrowserRouter><Page /></BrowserRouter>));
  }

  async function renderPage() {
    await act(async () => root.render(<BrowserRouter><Page /></BrowserRouter>));
  }

  async function select(tableId: string, ids: string[]) {
    await act(async () => mockTableProps[tableId].setSelectedIds(ids));
  }

  function table(type: 'task' | 'event') {
    return document.getElementById(`volunteer-${type}s-table`)!;
  }

  function id(type: 'task' | 'event') {
    return type === 'task' ? taskId : eventId;
  }

  function expectNoDelete() {
    expect(Array.from(host.querySelectorAll('button')).some(node => /^Delete \(/.test(node.textContent?.trim() || ''))).toBe(false);
    expect(deleteTask).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(deleteCredit).not.toHaveBeenCalled();
  }

  function button(label: string) {
    return Array.from(host.querySelectorAll('button')).find(node => node.textContent?.trim() === label)!;
  }

  async function changeStatus(label: string) {
    const filter = host.querySelector('[role="combobox"]')!;
    await act(async () => filter.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    const option = Array.from(document.body.querySelectorAll('[role="option"]'))
      .find(node => node.textContent?.trim() === label)!;
    expect(option).toBeDefined();
    await act(async () => (option as HTMLElement).click());
    await flushFocusFrame();
  }

  async function flushFocusFrame() {
    await act(async () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  }

  function expectStatusFocus(type: 'task' | 'event') {
    const filter = document.getElementById(`volunteer-${type}s-status`)!;
    const labelId = `volunteer-${type}s-status-label`;
    expect(filter.getAttribute('role')).toBe('combobox');
    expect(filter.getAttribute('aria-labelledby')?.split(' ')).toContain(labelId);
    expect(document.getElementById(labelId)!.textContent).toBe('Filter by Status');
    expect(document.activeElement).toBe(filter);
  }

  function expectRequestedStatus(type: 'task' | 'event', status: string) {
    const transaction = type === 'task' ? adminListVolunteerTasks : adminListVolunteerEvents;
    const calls = (useReadTransaction as jest.Mock).mock.calls.filter(([read]) => read === transaction);
    expect(calls[calls.length - 1][1].status).toBe(status || undefined);
  }

  function expectFullList(type: 'task' | 'event', status: string) {
    expect(document.getElementById(`volunteer-tab-${type}s`)!.getAttribute('aria-selected')).toBe('true');
    expect(table(type).textContent).toContain(type === 'task' ? 'Other pending claim' : 'Other event');
    expect(table(type).getAttribute('data-selected')).toBe('[]');
    expect(button(`Show all ${type}s`)).toBeUndefined();
    expectRequestedStatus(type, status);
  }

  async function expectFilterPersists(type: 'task' | 'event', status: string) {
    expectFullList(type, status);
    await act(async () => document.getElementById('volunteer-tab-credits')!.click());
    await act(async () => document.getElementById(`volunteer-tab-${type}s`)!.click());
    expectFullList(type, status);
    await act(async () => root.unmount());
    root = createRoot(host);
    await renderPage();
    expectFullList(type, status);
  }

  it('opens the Tasks tab and selects the child claim, with verification still requiring a click', async () => {
    await open(`task=${taskId}`);
    expect(document.getElementById('volunteer-tab-tasks')!.getAttribute('aria-selected')).toBe('true');
    const table = document.getElementById('volunteer-tasks-table')!;
    expect(table.textContent).toBe('Exact child claim');
    expect(table.getAttribute('data-selected')).toBe(JSON.stringify([taskId]));
    expect(verify).not.toHaveBeenCalled();
    await act(async () => button('Verify').click());
    expect(verify).toHaveBeenCalledWith({ id: taskId });
    await act(async () => button('Show all tasks').click());
    expect(document.getElementById('volunteer-tasks-table')!.textContent).toContain('Other pending claim');
    expect(document.getElementById('volunteer-tasks-table')!.getAttribute('data-selected')).toBe('[]');
  });

  it('opens the event attendance review and closes only the linked event after a click', async () => {
    await open(`event=${eventId}`);
    expect(document.getElementById('volunteer-tab-events')!.getAttribute('aria-selected')).toBe('true');
    const table = document.getElementById('volunteer-events-table')!;
    expect(table.textContent).toBe('Exact event');
    expect(table.getAttribute('data-selected')).toBe(JSON.stringify([eventId]));
    expect(button('Manage Attendees')).toBeDefined();
    expect(closeEvent).not.toHaveBeenCalled();
    await act(async () => button('Close Event').click());
    expect(closeEvent).toHaveBeenCalledWith({ id: eventId });
  });

  it('shows a reviewed record without offering approval again', async () => {
    tasks[1].status = 'completed';
    await open(`task=${taskId}`);
    expect(host.textContent).toContain('Exact child claim');
    expect(button('Verify')).toBeUndefined();
  });

  it('handles a deleted claim with a recovery action and no review controls', async () => {
    await open('task=000000000000000000000099');
    expect(host.textContent).toContain('This task is unavailable. It may have been deleted.');
    expect(button('Verify')).toBeUndefined();
    await act(async () => button('Show all tasks').click());
    expect(host.textContent).toContain('Other pending claim');
  });

  it('retargets a review link when the Volunteer page is already open', async () => {
    await open(`task=${taskId}`);
    await act(async () => navigate(`/volunteer?event=${eventId}`));
    expect(document.getElementById('volunteer-tab-events')!.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('volunteer-events-table')!.textContent).toBe('Exact event');
    expect(document.getElementById('volunteer-tasks-table')).toBeNull();
  });

  it.each([
    ['task', 'loading'], ['task', 'failed'], ['task', 'missing'],
    ['event', 'loading'], ['event', 'failed'], ['event', 'missing'],
  ] as const)('does not select or offer Delete for an admin %s link while %s', async (type, state) => {
    mockCanDeleteVolunteerRecords = true;
    tasks[1].status = 'completed';
    events[0].status = 'closed';
    reads[`${type}s`] = { isRequesting: state === 'loading', error: state === 'failed' ? 'Request failed' : '' };

    await open(`${type}=${state === 'missing' ? 'missing-id' : id(type)}`);

    expect(table(type).getAttribute('data-selected')).toBe('[]');
    expectNoDelete();
  });

  it.each(['task', 'event'] as const)('does not offer Delete for a loaded active %s review link', async type => {
    mockCanDeleteVolunteerRecords = true;

    await open(`${type}=${id(type)}`);

    expect(table(type).getAttribute('data-selected')).toBe(JSON.stringify([id(type)]));
    expectNoDelete();
  });

  it.each(['completed', 'cancelled', 'denied'])('lets an admin delete only the loaded linked %s task', async status => {
    mockCanDeleteVolunteerRecords = true;
    tasks[1].status = status;

    await open(`task=${taskId}`);
    expect(deleteTask).not.toHaveBeenCalled();
    await act(async () => button('Delete (1)').click());

    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith({ id: taskId });
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it('lets an admin delete only the loaded linked closed event', async () => {
    mockCanDeleteVolunteerRecords = true;
    events[0].status = 'closed';

    await open(`event=${eventId}`);
    expect(deleteEvent).not.toHaveBeenCalled();
    await act(async () => button('Delete (1)').click());

    expect(deleteEvent).toHaveBeenCalledTimes(1);
    expect(deleteEvent).toHaveBeenCalledWith({ id: eventId });
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('does not offer deletion for a terminal repair-ticket bounty', async () => {
    mockCanDeleteVolunteerRecords = true;
    tasks[1].status = 'completed';
    tasks[1].ticketId = 'ticket-id';

    await open(`task=${taskId}`);

    expectNoDelete();
  });

  it.each(['task', 'event'] as const)('keeps terminal %s deletion unavailable without admin capability', async type => {
    tasks[1].status = 'completed';
    events[0].status = 'closed';

    await open(`${type}=${id(type)}`);

    expectNoDelete();
  });

  it.each(['task', 'event'] as const)('validates every selected %s ID before allowing batch deletion', async type => {
    mockCanDeleteVolunteerRecords = true;
    tasks[1].status = tasks[2].status = 'completed';
    events[0].status = events[1].status = 'closed';
    const otherId = type === 'task' ? 'other' : 'other-event';
    const tableId = `volunteer-${type}s-table`;
    await open(`${type}=${id(type)}`);

    await select(tableId, [id(type), 'missing-id']);
    expectNoDelete();
    await select(tableId, ['missing-id']);
    expectNoDelete();
    await select(tableId, [id(type), otherId]);
    await act(async () => button('Delete (2)').click());

    const deletion = type === 'task' ? deleteTask : deleteEvent;
    expect(deletion.mock.calls).toEqual([[{ id: id(type) }], [{ id: otherId }]]);
  });

  it.each(['task', 'event'] as const)('waits for successful %s loading and hides deletion when that data becomes stale', async type => {
    mockCanDeleteVolunteerRecords = true;
    tasks[1].status = 'completed';
    events[0].status = 'closed';
    reads[`${type}s`].isRequesting = true;
    await open(`${type}=${id(type)}`);
    expectNoDelete();

    reads[`${type}s`].isRequesting = false;
    await renderPage();
    expect(table(type).getAttribute('data-selected')).toBe(JSON.stringify([id(type)]));
    expect(button('Delete (1)')).toBeDefined();
    reads[`${type}s`].isRequesting = true;
    await renderPage();
    expectNoDelete();
    reads[`${type}s`] = { isRequesting: false, error: 'Refresh failed' };
    await renderPage();
    expectNoDelete();
    reads[`${type}s`].error = '';
    if (type === 'task') tasks = []; else events = [];
    await renderPage();
    expectNoDelete();
  });

  it.each(['task', 'event'] as const)('does not reselect a %s after the reviewer clears selection', async type => {
    await open(`${type}=${id(type)}`);
    await select(`volunteer-${type}s-table`, []);
    if (type === 'task') tasks = tasks.map(row => ({ ...row }));
    else events = events.map(row => ({ ...row }));

    await renderPage();

    expect(table(type).getAttribute('data-selected')).toBe('[]');
  });

  it.each(['task', 'event'] as const)('Show all %ss clears review selectors and preserves URL context across tabs and remounts', async type => {
    if (type === 'event') events[1].status = 'closed';
    await open(`${type}=${id(type)}&shop=woodshop&source=slack#review`);
    const historyLength = window.history.length;
    await act(async () => button(`Show all ${type}s`).click());
    await flushFocusFrame();
    expectStatusFocus(type);

    const query = new URLSearchParams(window.location.search);
    expect(query.has('task')).toBe(false);
    expect(query.has('event')).toBe(false);
    expect(query.get('tab')).toBe(`${type}s`);
    expect(query.get('shop')).toBe('woodshop');
    expect(query.get('source')).toBe('slack');
    expect(window.location.hash).toBe('#review');
    expect(window.history.length).toBe(historyLength);
    const otherTitle = type === 'task' ? 'Other pending claim' : 'Other event';
    expect(table(type).textContent).toContain(otherTitle);
    expect(table(type).getAttribute('data-selected')).toBe('[]');
    expect(document.getElementById(`volunteer-tab-${type}s`)!.getAttribute('aria-selected')).toBe('true');
    const expectAllEventStatuses = () => {
      if (type === 'event') {
        const eventCalls = (useReadTransaction as jest.Mock).mock.calls.filter(([transaction]) => transaction === adminListVolunteerEvents);
        expect(eventCalls[eventCalls.length - 1][1].status).toBeUndefined();
      }
    };
    expectAllEventStatuses();

    await act(async () => document.getElementById('volunteer-tab-credits')!.click());
    await act(async () => document.getElementById(`volunteer-tab-${type}s`)!.click());
    expect(table(type).textContent).toContain(otherTitle);
    expect(button(`Show all ${type}s`)).toBeUndefined();
    expectAllEventStatuses();

    await act(async () => root.unmount());
    root = createRoot(host);
    await renderPage();
    expect(document.getElementById(`volunteer-tab-${type}s`)!.getAttribute('aria-selected')).toBe('true');
    expect(table(type).textContent).toContain(otherTitle);
    expect(table(type).getAttribute('data-selected')).toBe('[]');
    expect(button(`Show all ${type}s`)).toBeUndefined();
    expectAllEventStatuses();
  });

  it('Show all removes a competing review selector instead of switching to that record', async () => {
    await open(`task=${taskId}&event=${eventId}`);

    await act(async () => button('Show all tasks').click());

    expect(new URLSearchParams(window.location.search).has('event')).toBe(false);
    expect(document.getElementById('volunteer-tab-tasks')!.getAttribute('aria-selected')).toBe('true');
    expect(table('task').textContent).toContain('Other pending claim');
  });

  it.each([
    ['task', 'pending', 'Pending Verification'],
    ['task', 'completed', 'Completed'],
    ['task', '', 'All'],
    ['event', 'open', 'Open'],
    ['event', 'closed', 'Closed'],
    ['event', '', 'All'],
  ] as const)('changing a linked %s filter to %s clears review selectors and persists the filter', async (type, status, label) => {
    await open(`tab=${type}s&task=${taskId}&event=${eventId}&${type}Status=all&shop=woodshop&source=slack#review`);
    expect(table(type).getAttribute('data-selected')).toBe(JSON.stringify([id(type)]));
    const historyLength = window.history.length;

    if (status === '') {
      // Linked review starts on All, so choose another value before testing a return to All.
      await changeStatus(type === 'task' ? 'Pending Verification' : 'Open');
      await select(`volunteer-${type}s-table`, [id(type)]);
    }

    await changeStatus(label);
    expectStatusFocus(type);

    const query = new URLSearchParams(window.location.search);
    expect(query.has('task')).toBe(false);
    expect(query.has('event')).toBe(false);
    expect(query.get('tab')).toBe(`${type}s`);
    expect(query.get(`${type}Status`)).toBe(status || 'all');
    expect(query.get('shop')).toBe('woodshop');
    expect(query.get('source')).toBe('slack');
    expect(window.location.hash).toBe('#review');
    expect(window.history.length).toBe(historyLength);
    await expectFilterPersists(type, status);
  });

  it.each([
    ['open', 'Open'], ['closed', 'Closed'],
  ] as const)('changing Show all events to %s replaces the stale all-status query', async (status, label) => {
    await open(`event=${eventId}&source=slack#review`);
    await act(async () => button('Show all events').click());
    expect(new URLSearchParams(window.location.search).get('eventStatus')).toBe('all');
    const historyLength = window.history.length;

    await changeStatus(label);
    expectStatusFocus('event');

    const query = new URLSearchParams(window.location.search);
    expect(query.get('eventStatus')).toBe(status);
    expect(query.has('task')).toBe(false);
    expect(query.has('event')).toBe(false);
    expect(query.get('source')).toBe('slack');
    expect(window.location.hash).toBe('#review');
    expect(window.history.length).toBe(historyLength);
    await expectFilterPersists('event', status);
  });

  it.each([
    ['task', 'cancelled', 'filter'],
    ['task', 'submitted', 'filter'],
    ['event', 'cancelled', 'filter'],
    ['task', 'cancelled', 'show all'],
  ] as const)('keeps the workshop task dialog closed after %s navigation following %s (%s)', async (type, outcome, action) => {
    const reviewSelector = action === 'show all' ? `&task=${taskId}` : '';
    await open(`createTask=true${reviewSelector}&shop=woodshop&source=workshop#review`);
    const form = document.getElementById('create-volunteer-task')!;
    expect(form).not.toBeNull();
    if (outcome === 'submitted') {
      const title = form.querySelector('input:not([type="hidden"])') as HTMLInputElement;
      const description = form.querySelector('textarea') as HTMLTextAreaElement;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'Tidy the woodshop');
        title.dispatchEvent(new Event('input', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(description, 'Sweep the floor');
        description.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => (document.getElementById('create-volunteer-task-submit') as HTMLButtonElement).click());
      expect(createTask).toHaveBeenCalledWith({ body: expect.objectContaining({
        title: 'Tidy the woodshop', description: 'Sweep the floor', shopId: 'woodshop',
      }) });
    } else {
      await act(async () => (document.getElementById('create-volunteer-task-cancel') as HTMLButtonElement).click());
      expect(createTask).not.toHaveBeenCalled();
    }
    await act(async () => new Promise<void>(resolve => setTimeout(resolve, 300)));
    expect(document.getElementById('create-volunteer-task')).toBeNull();
    const historyLength = window.history.length;
    if (type === 'event') await act(async () => document.getElementById('volunteer-tab-events')!.click());
    if (action === 'show all') {
      await act(async () => button('Show all tasks').click());
      await flushFocusFrame();
    } else {
      await changeStatus(type === 'task' ? 'Completed' : 'Closed');
    }
    expectStatusFocus(type);

    const query = new URLSearchParams(window.location.search);
    expect(query.has('createTask')).toBe(false);
    expect(query.has('task')).toBe(false);
    expect(query.get('shop')).toBe('woodshop');
    expect(query.get('source')).toBe('workshop');
    expect(window.location.hash).toBe('#review');
    expect(window.history.length).toBe(historyLength);
    expect(document.getElementById('create-volunteer-task')).toBeNull();
    await expectFilterPersists(type, action === 'show all' ? '' : type === 'task' ? 'completed' : 'closed');
    if (type === 'event') await act(async () => document.getElementById('volunteer-tab-tasks')!.click());
    expect(document.getElementById('create-volunteer-task')).toBeNull();
  });

  it('validates loaded credit selections and suppresses deletion during loading or errors', async () => {
    mockCanDeleteVolunteerRecords = true;
    await open('tab=credits');
    await select('volunteer-credits-table', ['credit-id', 'missing-id']);
    expectNoDelete();
    await select('volunteer-credits-table', ['credit-id']);
    reads.credits.isRequesting = true;
    await renderPage();
    expectNoDelete();
    reads.credits = { isRequesting: false, error: 'Refresh failed' };
    await renderPage();
    expectNoDelete();
    reads.credits.error = '';
    await renderPage();
    await act(async () => button('Delete (1)').click());
    expect(deleteCredit.mock.calls).toEqual([[{ id: 'credit-id' }]]);
  });

  it('validates loaded child-claim selections and suppresses deletion during loading or errors', async () => {
    mockCanDeleteVolunteerRecords = true;
    children[0].status = 'completed';
    await open('tab=tasks');
    const claimsColumn = mockTableProps['volunteer-tasks-table'].columns.find((column: any) => column.id === 'claims');
    await act(async () => claimsColumn.cell(tasks[0]).props.children.props.onClick({ stopPropagation: jest.fn() }));

    await select('volunteer-child-tasks-table', [taskId, 'missing-id']);
    expectNoDelete();
    await select('volunteer-child-tasks-table', [taskId]);
    reads.children.isRequesting = true;
    await renderPage();
    expectNoDelete();
    reads.children = { isRequesting: false, error: 'Refresh failed' };
    await renderPage();
    expectNoDelete();
    reads.children.error = '';
    await renderPage();
    children[0].ticketId = 'ticket-id';
    await renderPage();
    expectNoDelete();
    delete children[0].ticketId;
    await renderPage();
    await act(async () => button('Delete (1)').click());
    expect(deleteTask.mock.calls).toEqual([[{ id: taskId }]]);
  });
});
