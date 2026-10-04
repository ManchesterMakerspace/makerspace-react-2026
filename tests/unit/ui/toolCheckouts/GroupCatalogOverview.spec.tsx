import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
const mockGroups = jest.fn();
const mockRows = [{ id: 'approver', memberName: 'Trainer', shopNames: [], toolNames: ['Saw'], toolGroups: [{ id: 'kit', name: 'Safety kit', shopId: 'wood' }] }];
jest.mock('api/toolCheckouts', () => ({ listToolGroups: (...args: any[]) => mockGroups(...args) }));
jest.mock('ui/hooks/useReadTransaction', () => () => ({ data: mockRows, refresh: jest.fn() }));
jest.mock('ui/hooks/useWriteTransaction', () => () => ({ call: jest.fn() }));
jest.mock('ui/common/Filters/QueryContext', () => ({ withQueryContext: (component: any) => component }));
jest.mock('ui/common/FormModal', () => () => null);
jest.mock('ui/common/table/StatefulTable', () => ({ data, columns }: any) => <>{data.map((row: any) =>
  <div key={row.id}>{columns.map((column: any) => <section key={column.id} aria-label={column.label}>{column.cell(row)}</section>)}</div>)}</>);
import ToolGroupList from 'ui/toolCheckouts/ToolGroupList';
import CheckoutApproversManager from 'ui/toolCheckouts/CheckoutApproversManager';

describe('group catalog overview', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockGroups.mockReset(); host = document.createElement('div'); root = createRoot(host);
  });
  afterEach(() => act(() => root.unmount()));
  it.each(['retry', 'event'])('recovers the group list through %s and clears the old error', async recovery => {
    let resolve: (value: any) => void;
    mockGroups.mockResolvedValueOnce({ error: { message: 'Unavailable' } })
      .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => root.render(<ToolGroupList shops={[]} tools={[]} />));
    expect(mockGroups).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => {
      if (recovery === 'retry') Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Retry tool groups')!.click();
      else window.dispatchEvent(new Event('tool-groups-changed'));
    });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading tool groups');
    await act(async () => resolve!({ data: [{ id: 'kit', name: 'Safety kit', includedTools: [] }] }));
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.textContent).toContain('Safety kit');
  });
  it('renders explicit group scope separately from effective tool grants', async () => {
    await act(async () => root.render(<CheckoutApproversManager />));
    const groups = host.querySelector('[aria-label="Authorized Groups"]')!;
    expect(groups.textContent).toContain('Safety kit');
    expect(groups.textContent).toContain('Group');
    expect(host.querySelector('[aria-label="Authorized Tools"]')?.textContent).toBe('Saw');
    expect(host.querySelector('[aria-label="Authorized Shops"]')?.textContent).toBe('');
  });
});
