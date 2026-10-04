import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockRead = jest.fn();
jest.mock('ui/common/Filters/QueryContext', () => ({ withQueryContext: (component: any) => component, useQueryContext: () => {
  const [params, setParams] = require('react').useState({});
  return { params, setParam: (key: string, value: string) => setParams((previous: any) => ({ ...previous, [key]: value, pageNum: 0 })) };
} }));
jest.mock('ui/toolCheckouts/CheckoutCatalog', () => ({ useCheckoutCatalog: () => ({ data: [{ id: 'wood', name: 'Woodshop' }] }) }));
jest.mock('ui/hooks/useReadTransaction', () => ({ __esModule: true, default: (...args: any[]) => { mockRead(...args); return ({
  data: [{ id: 'group-request', targetType: 'group', targetName: 'Woodshop induction' }, { id: 'legacy', toolName: 'Legacy saw' }], refresh: jest.fn()
}); } }));
jest.mock('ui/hooks/useWriteTransaction', () => ({ __esModule: true, default: () => ({ call: jest.fn() }) }));
jest.mock('api/toolCheckouts', () => ({ listToolGroups: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('ui/common/FormModal', () => () => null);
jest.mock('ui/common/table/StatefulTable', () => ({ id, data, columns, loading }: any) =>
  <div data-testid={id} aria-busy={!!loading}>{data.map((row: any) => <div key={row.id}>{columns[0].cell(row)}</div>)}</div>);
import ToolCheckoutRequestsManager from 'ui/toolCheckouts/ToolCheckoutRequestsManager';
import { listToolGroups } from 'api/toolCheckouts';

it.each([false, true])('renders group target names and legacy tool names with canManage=%s', async canManage => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ToolCheckoutRequestsManager canManage={canManage} />));
    const table = host.querySelector('[data-testid="tool-checkout-requests-table"]')!;
    expect(table.textContent).toContain('Woodshop induction');
    expect(table.textContent).toContain('Legacy saw');
    expect(table.textContent).toContain('Group');
  } finally { act(() => root.unmount()); }
});

it('scopes both catalog reads to the selected shop and restores all shops', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ToolCheckoutRequestsManager canManage={false} />));
    const select = host.querySelector('select')!;
    await act(async () => { select.value = 'wood'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(mockRead).toHaveBeenCalledWith(undefined, { shopId: 'wood' }, false, 'available-tool-checkout-requests-catalog-wood');
    expect(listToolGroups).toHaveBeenLastCalledWith('wood');
    await act(async () => { select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(listToolGroups).toHaveBeenLastCalledWith(undefined);
    expect(mockRead).toHaveBeenCalledWith(undefined, { shopId: undefined }, false, 'available-tool-checkout-requests-catalog-all');
  } finally { act(() => root.unmount()); }
});

it.each(['response', 'rejection'])('exposes group %s failures and retries the complete catalog', async failure => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  const api = listToolGroups as jest.Mock;
  if (failure === 'response') api.mockResolvedValueOnce({ error: 'Unavailable' });
  else api.mockRejectedValueOnce(new Error('Offline'));
  api.mockResolvedValueOnce({ data: [{ id: 'kit', name: 'Recovered kit', includedTools: [], canRequest: true }] });
  try {
    await act(async () => root.render(<ToolCheckoutRequestsManager canManage={false} />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Unable to load tool groups');
    expect(host.querySelector('[data-testid="available-tools-table"]')?.textContent).toBe('');
    await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Retry tool groups')!.click(); });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[data-testid="available-tools-table"]')?.textContent).toContain('Recovered kit');
  } finally { act(() => root.unmount()); }
});

it('keeps the catalog loading until groups finish and ignores a stale shop response', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  let resolveOld: (result: any) => void;
  (listToolGroups as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ error: 'Woodshop unavailable' });
  try {
    await act(async () => root.render(<ToolCheckoutRequestsManager canManage={false} />));
    const table = host.querySelector('[data-testid="available-tools-table"]')!;
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(table.textContent).toBe('');
    const select = host.querySelector('select')!;
    await act(async () => { select.value = 'wood'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { resolveOld!({ data: [{ id: 'stale', name: 'Stale kit', includedTools: [] }] }); });
    expect(table.getAttribute('aria-busy')).toBe('false');
    expect(table.textContent).toBe('');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Unable to load tool groups');
  } finally { act(() => root.unmount()); }
});
