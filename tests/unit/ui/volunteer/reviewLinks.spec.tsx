import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';

jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('ui/hooks/useWriteTransaction', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('app/permissions', () => ({ useCapabilities: () => ({ canDeleteVolunteerRecords: false }) }));
jest.mock('ui/common/MemberSearchInput', () => () => null);
jest.mock('ui/common/table/StatefulTable', () => ({
  __esModule: true,
  default: ({ id, data, selectedIds }: any) => (
    <div id={id} data-selected={JSON.stringify(selectedIds)}>
      {data.map((row: any) => <div key={row.id}>{row.title}</div>)}
    </div>
  ),
}));

import AdminVolunteerPage from 'ui/volunteer/AdminVolunteerPage';
import useReadTransaction from 'ui/hooks/useReadTransaction';
import useWriteTransaction from 'ui/hooks/useWriteTransaction';
import {
  adminListVolunteerTasks, adminListVolunteerEvents,
  adminCompleteVolunteerTask, adminCloseVolunteerEvent,
} from 'api/volunteer';

describe('volunteer review links', () => {
  let host: HTMLDivElement;
  let root: Root;
  let tasks: any[];
  let events: any[];
  const taskId = '000000000000000000000017';
  const eventId = '000000000000000000000008';
  const verify = jest.fn();
  const closeEvent = jest.fn();
  const refresh = jest.fn();
  let navigate: ReturnType<typeof useNavigate>;

  const Page = () => {
    navigate = useNavigate();
    return <AdminVolunteerPage />;
  };

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    tasks = [
      { id: 'parent', title: 'Reusable parent', status: 'reusable', creditValue: 1 },
      { id: taskId, parentTaskId: 'parent', title: 'Exact child claim', status: 'pending', creditValue: 1 },
      { id: 'other', title: 'Other pending claim', status: 'pending', creditValue: 1 },
    ];
    events = [
      { id: eventId, title: 'Exact event', status: 'open', creditValue: 1, attendeeCount: 2 },
      { id: 'other-event', title: 'Other event', status: 'open', creditValue: 1 },
    ];
    verify.mockClear(); closeEvent.mockClear();
    (useReadTransaction as jest.Mock).mockImplementation((transaction: unknown) => ({
      data: transaction === adminListVolunteerTasks ? tasks : transaction === adminListVolunteerEvents ? events : [],
      isRequesting: false, refresh, error: '',
    }));
    (useWriteTransaction as jest.Mock).mockImplementation((transaction: unknown) => ({
      call: transaction === adminCompleteVolunteerTask ? verify : transaction === adminCloseVolunteerEvent ? closeEvent : jest.fn(),
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

  function button(label: string) {
    return Array.from(host.querySelectorAll('button')).find(node => node.textContent?.trim() === label)!;
  }

  it 'opens the Tasks tab and selects the child claim, with verification still requiring a click', async () => {
    await open(`task=${taskId}`);
    expect(document.getElementById('volunteer-tab-tasks')!.getAttribute('aria-selected')).toBe('true');
    const table = document.getElementById('volunteer-tasks-table')!;
    expect(table.textContent).toBe('Exact child claim');
    expect(table.getAttribute('data-selected')).toBe(JSON.stringify([taskId]));
    expect(verify).not.toHaveBeenCalled();
    await act(async () => button('Verify').click());
    expect(verify).toHaveBeenCalledWith({ id: taskId });
    await act(async () => button('Show all tasks').click());
    expect(table.textContent).toContain('Other pending claim');
    expect(table.getAttribute('data-selected')).toBe('[]');
  });

  it 'opens the event attendance review and closes only the linked event after a click', async () => {
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

  it 'shows a reviewed record without offering approval again', async () => {
    tasks[1].status = 'completed';
    await open(`task=${taskId}`);
    expect(host.textContent).toContain('Exact child claim');
    expect(button('Verify')).toBeUndefined();
  });

  it 'handles a deleted claim with a recovery action and no review controls', async () => {
    await open('task=000000000000000000000099');
    expect(host.textContent).toContain('This task is unavailable. It may have been deleted.');
    expect(button('Verify')).toBeUndefined();
    await act(async () => button('Show all tasks').click());
    expect(host.textContent).toContain('Other pending claim');
  });

  it 'retargets a review link when the Volunteer page is already open', async () => {
    await open(`task=${taskId}`);
    await act(async () => navigate(`/volunteer?event=${eventId}`));
    expect(document.getElementById('volunteer-tab-events')!.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('volunteer-events-table')!.textContent).toBe('Exact event');
    expect(document.getElementById('volunteer-tasks-table')).toBeNull();
  });
});
