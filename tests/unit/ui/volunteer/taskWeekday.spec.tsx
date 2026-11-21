import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: () => ({ data: [], refresh: jest.fn() }) }));
jest.mock('ui/common/MemberSearchInput', () => () => null);
jest.mock('api/clientConfig', () => ({ loadClientConfig: jest.fn() }));
import { loadClientConfig } from 'api/clientConfig';
import { CreateTaskModal, EditTaskModal, CreateEventModal } from 'ui/volunteer/AdminVolunteerPage';

describe('volunteer task weekdays and credit guidance', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (loadClientConfig as jest.Mock).mockReset().mockResolvedValue({ volunteer_task_max_credit: 3.5 });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  const renderCreate = async (save = jest.fn()) => {
    await act(async () => root.render(<CreateTaskModal isOpen onClose={jest.fn()} onSave={save} loading={false} error='' />));
    return save;
  };
  const select = (name: string) => Array.from(document.querySelectorAll('[role="combobox"]')).find(node =>
    node.getAttribute('aria-labelledby')?.split(' ').some(id => document.getElementById(id)?.textContent === name));
  const choose = async (name: string, value: string) => {
    await act(async () => select(name)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(node => node.textContent === value) as HTMLElement;
    await act(async () => option.click());
  };
  const setField = async (label: string, value: string) => {
    const node = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.replace(/\s*\*$/, '') === label)!;
    const field = document.getElementById(node.htmlFor) as HTMLInputElement;
    const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return field;
  };

  it('offers Any day plus Monday through Sunday only for multi-use task types and clears Standard selections', async () => {
    await renderCreate();
    expect(select('Day of week')).toBeUndefined();
    for (const type of ['Reusable (any member once)', 'Repeatable (any member, unlimited)', 'Recurring (repeatable with cooldown)']) {
      await choose('Task Type', type);
      expect(select('Day of week')?.textContent).toContain('Any day');
    }
    await act(async () => select('Day of week')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    expect(Array.from(document.querySelectorAll('[role="option"]')).map(node => node.textContent)).toEqual([
      'Any day', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ]);
    await act(async () => (Array.from(document.querySelectorAll('[role="option"]')).find(node => node.textContent === 'Sunday') as HTMLElement).click());
    await choose('Task Type', 'Standard (one-time)');
    expect(select('Day of week')).toBeUndefined();
    await choose('Task Type', 'Reusable (any member once)');
    expect(select('Day of week')?.textContent).toContain('Any day');
  });

  it.each(['reusable', 'repeatable', 'recurring'])('loads Sunday and saves Any day for a %s parent', async status => {
    const save = jest.fn();
    const task = { id: 'parent', title: 'Clean', description: 'Clean benches', status, days: 7, dayOfWeek: 0,
      creditValue: 1, prerequisiteToolIds: [] } as any;
    await act(async () => root.render(<EditTaskModal task={task} canEditCredits onClose={jest.fn()} onSave={save} loading={false} error='' />));
    expect(select('Day of week')?.textContent).toContain('Sunday');
    await choose('Day of week', 'Any day');
    await act(async () => (document.getElementById('edit-volunteer-task-submit') as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith('parent', expect.objectContaining({ dayOfWeek: null }));
  });

  it('uses the configured task creation maximum in inline guidance and prevents an excessive submission', async () => {
    const save = await renderCreate();
    await setField('Title', 'Clean');
    await setField('Description', 'Clean benches');
    expect(document.body.textContent).toContain('Maximum 3.5 credits.');
    const credit = await setField('Credit Value', '4');
    expect(credit.getAttribute('max')).toBe('3.5');
    expect(credit.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('configured maximum of 3.5 credits');
    expect((document.getElementById('create-volunteer-task-submit') as HTMLButtonElement).disabled).toBe(true);
    await setField('Credit Value', '3.5');
    await act(async () => (document.getElementById('create-volunteer-task-submit') as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ creditValue: '3.5' }));
  });

  it('reloads an increased maximum when the same mounted dialog opens again', async () => {
    const save = jest.fn();
    await renderCreate(save);
    expect(document.body.textContent).toContain('Maximum 3.5 credits.');
    await act(async () => root.render(<CreateTaskModal isOpen={false} onClose={jest.fn()} onSave={save} loading={false} error='' />));
    (loadClientConfig as jest.Mock).mockResolvedValue({ volunteer_task_max_credit: 8 });
    await renderCreate(save);
    expect(loadClientConfig).toHaveBeenCalledTimes(2);
    expect(loadClientConfig).toHaveBeenNthCalledWith(2, { refresh: true });
    expect(document.body.textContent).toContain('Maximum 8 credits.');
    await setField('Title', 'Clean');
    await setField('Description', 'Clean benches');
    const credit = await setField('Credit Value', '5');
    expect(credit.getAttribute('max')).toBe('8');
    await act(async () => (document.getElementById('create-volunteer-task-submit') as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ creditValue: '5' }));
  });

  it('allows server validation when the configuration request fails and keeps the actionable error visible', async () => {
    (loadClientConfig as jest.Mock).mockRejectedValue(new Error('Unavailable'));
    await act(async () => root.render(<CreateTaskModal isOpen onClose={jest.fn()} onSave={jest.fn()} loading={false}
      error='Credit value cannot exceed the configured maximum of 2 credits.' />));
    await setField('Title', 'Clean');
    await setField('Description', 'Clean benches');
    await act(async () => (document.getElementById('create-volunteer-task-submit') as HTMLButtonElement).click());
    expect(document.body.textContent).toContain('configured maximum of 2 credits');
    expect(document.body.textContent).toContain('checked when you save');
  });

  it.each([false, true])('keeps event credits uncapped on edit=%s and has no weekday control', async editing => {
    const save = jest.fn();
    const event = editing ? { id: 'event', title: 'Event', creditValue: 1, prerequisiteToolIds: [] } as any : null;
    await act(async () => root.render(<CreateEventModal isOpen event={event} onClose={jest.fn()} onSave={save} loading={false} error='' />));
    expect(select('Day of week')).toBeUndefined();
    await setField('Title', 'Event');
    const credit = await setField('Credit Value', '1000.5');
    expect(credit.getAttribute('max')).toBeNull();
    await act(async () => (document.getElementById(`${editing ? 'edit' : 'create'}-volunteer-event-submit`) as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ creditValue: 1000.5 }));
  });
});
