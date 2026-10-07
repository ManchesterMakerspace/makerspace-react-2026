import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockDecline = jest.fn();
jest.mock('ui/common/Filters/QueryContext', () => ({ withQueryContext: (component: any) => component, useQueryContext: () => ({ params: {}, setParam: jest.fn() }) }));
jest.mock('ui/toolCheckouts/CheckoutCatalog', () => ({ useCheckoutCatalog: () => ({ data: [] }) }));
jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: () => ({
  data: [{ id: 'r1', toolId: 't1', memberId: 'm1', memberName: 'Pat Member', memberEmail: 'pat@example.org',
    toolName: 'Laguna Bandsaw', shopName: 'Woodworking', requestDate: '2026-10-01T12:00:00Z', status: 'open' }],
  refresh: jest.fn()
}) }));
jest.mock('ui/hooks/useWriteTransaction', () => ({ __esModule: true, default: (apiCall: any) => ({
  call: apiCall === require('api/toolCheckouts').declineToolCheckoutRequest ? mockDecline : jest.fn()
}) }));
jest.mock('api/toolCheckouts', () => ({
  listToolGroups: jest.fn().mockResolvedValue({ data: [] }),
  declineToolCheckoutRequest: jest.fn(),
}));
jest.mock('ui/common/FormModal', () => ({ isOpen, title, children, onSubmit, submitText }: any) => isOpen
  ? <form aria-label={title} onSubmit={event => { event.preventDefault(); onSubmit(); }}>{children}<button type="submit">{submitText}</button></form>
  : null);
jest.mock('ui/common/table/StatefulTable', () => ({ id, data, setSelectedIds }: any) =>
  <div data-testid={id}>{data.map((row: any) => <button key={row.id} onClick={() => setSelectedIds(row.id)}>select {row.id}</button>)}</div>);
import ToolCheckoutRequestsManager from 'ui/toolCheckouts/ToolCheckoutRequestsManager';

const click = async (element: Element) => { await act(async () => { (element as HTMLElement).click(); }); };
const buttonNamed = (host: HTMLElement, text: string) =>
  Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === text);

const render = async (canManage: boolean) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<ToolCheckoutRequestsManager canManage={canManage} />));
  return { host, unmount: () => { act(() => root.unmount()); host.remove(); } };
};

const typeReason = async (host: HTMLElement, value: string) => {
  const textarea = host.querySelector('textarea')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => { setValue.call(textarea, value); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
};

beforeEach(() => mockDecline.mockClear());

it('offers Decline to approvers only after a request is selected', async () => {
  const { host, unmount } = await render(true);
  try {
    expect(buttonNamed(host, 'Decline')).toBeUndefined();
    await click(buttonNamed(host, 'select r1')!);
    expect(buttonNamed(host, 'Decline')).toBeDefined();
  } finally { unmount(); }
});

it('does not offer Decline to a member viewing their own requests', async () => {
  const { host, unmount } = await render(false);
  try {
    await click(buttonNamed(host, 'select r1')!);
    expect(buttonNamed(host, 'Decline')).toBeUndefined();
  } finally { unmount(); }
});

it('requires a reason and sends the trimmed reason with the request id', async () => {
  const { host, unmount } = await render(true);
  try {
    await click(buttonNamed(host, 'select r1')!);
    await click(buttonNamed(host, 'Decline')!);
    expect(host.textContent).toContain('Pat Member will be told this request for Laguna Bandsaw was declined');

    await click(buttonNamed(host, 'Decline Request')!);
    expect(mockDecline).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Enter a reason for declining.');

    await typeReason(host, '  Needs the safety class first  ');
    await click(buttonNamed(host, 'Decline Request')!);
    expect(mockDecline).toHaveBeenCalledWith({ id: 'r1', body: { reason: 'Needs the safety class first' } });
  } finally { unmount(); }
});
