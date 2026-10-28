import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

const mockChoices = {
  categories: [
    { value: 'all_except_slack', label: 'All except Slack messages' },
    { value: 'all', label: 'All' },
    { value: 'email', label: 'Email' },
    { value: 'slack', label: 'Slack messages' },
    { value: 'billing', label: 'Billing' },
    { value: 'checkouts', label: 'Checkouts, tools & shops' },
    { value: 'other', label: 'Other' },
  ],
  eventTypes: [
    { value: 'invoice_settled', category: 'billing' },
    { value: 'slack_message_sent', category: 'slack' },
    { value: 'system_email_sent', category: 'email' },
    { value: 'tool_checkout_created', category: 'checkouts' },
    { value: 'transaction_refunded', category: 'billing' },
  ],
};
const mockRows = [{
  id: 'log-1', logType: 'member', eventType: 'tool_checkout_created', category: 'checkouts',
  actorId: null, actorName: null, subjectId: null, subjectName: null, resourceType: 'ToolCheckout', resourceId: 'x',
  fieldChanges: null, beforeSnapshot: null, afterSnapshot: null, slackChannel: null,
  slackMessage: 'Checkout created', slackPosted: null, ipAddress: null, createdAt: '2026-10-27T12:00:00Z',
}];
const mockListArgs: any[] = [];

jest.mock('api/auditLogs', () => ({
  adminListAuditLogs: jest.fn(),
  adminListAuditLogFilters: jest.fn(),
}));
jest.mock('ui/hooks/useReadTransaction', () => {
  const api = jest.requireMock('api/auditLogs');
  return {
    __esModule: true,
    default: (transaction: unknown, args: unknown) => {
      if (transaction === api.adminListAuditLogFilters) return { data: mockChoices, refresh: jest.fn() };
      mockListArgs.push(JSON.parse(JSON.stringify(args)));
      return { data: mockRows, refresh: jest.fn(), response: undefined, isRequesting: false };
    },
  };
});
jest.mock('ui/common/MemberSearchInput', () => () => null);

import AuditLogsTable from 'ui/auditLog/AuditLogsTable';

const buttonNamed = (name: string) =>
  Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === name)!;
const comboboxLabelled = (label: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"]'))
    .find(box => box.closest('.MuiFormControl-root')?.querySelector('label')?.textContent === label)!;
const openSelect = async (label: string) => {
  await act(async () => {
    comboboxLabelled(label).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  });
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
};

describe('audit log category filter', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    mockListArgs.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

  const lastCategory = () => mockListArgs[mockListArgs.length - 1].category;

  it('opens on everything except Slack messages, and labels each entry with its event and category', async () => {
    await act(async () => root.render(<AuditLogsTable />));
    expect(lastCategory()).toBe('all_except_slack');
    expect(container.textContent).toContain('Tool Checkout Created');
    expect(container.textContent).toContain('Checkouts, tools & shops');
  });

  it('offers the server categories, and keeps "All" chosen instead of falling back to the default', async () => {
    await act(async () => root.render(<AuditLogsTable />));
    await act(async () => buttonNamed('Filters').click());
    const options = await openSelect('Category');
    expect(options.map(option => option.textContent)).toEqual(mockChoices.categories.map(category => category.label));

    await act(async () => options.find(option => option.textContent === 'All')!.click());
    expect(lastCategory()).toBe('all');
    await act(async () => root.render(<AuditLogsTable />));
    expect(lastCategory()).toBe('all');
  });

  it('narrows the Event list to the chosen category and clears an event that no longer applies', async () => {
    await act(async () => root.render(<AuditLogsTable />));
    await act(async () => buttonNamed('Filters').click());
    let events = await openSelect('Event');
    expect(events.map(option => option.textContent)).toEqual([
      'All', 'Invoice Settled', 'Slack Message Sent', 'Email Sent', 'Tool Checkout Created', 'Transaction Refunded',
    ]);
    await act(async () => events.find(option => option.textContent === 'Email Sent')!.click());
    expect(mockListArgs[mockListArgs.length - 1].eventType).toBe('system_email_sent');

    await act(async () => buttonNamed('Filters').click());
    const categories = await openSelect('Category');
    await act(async () => categories.find(option => option.textContent === 'Billing')!.click());
    expect(lastCategory()).toBe('billing');
    expect(mockListArgs[mockListArgs.length - 1].eventType).toBeUndefined();

    await act(async () => buttonNamed('Filters').click());
    events = await openSelect('Event');
    expect(events.map(option => option.textContent)).toEqual(['All', 'Invoice Settled', 'Transaction Refunded']);
  });
});
