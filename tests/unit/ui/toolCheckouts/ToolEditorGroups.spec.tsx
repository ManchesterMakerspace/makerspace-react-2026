import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ToolEditorModal from 'ui/toolCheckouts/ToolEditorModal';

const mockSaveGroup = jest.fn();
const mockCreateTool = jest.fn();
jest.mock('api/toolCheckouts', () => ({
  saveToolGroup: (...args: any[]) => mockSaveGroup(...args),
  adminCreateTool: (...args: any[]) => mockCreateTool(...args),
}));
jest.mock('ui/hooks/useReadTransaction', () => ({
  __esModule: true, default: () => ({ data: [], error: null }),
}));
jest.mock('ui/toolCheckouts/ReservationSettingsFields', () => ({ __esModule: true, default: () => null }));
jest.mock('ui/toolCheckouts/ToolGroupForm', () => ({
  __esModule: true,
  emptyGroup: (shopId: string) => ({ shopId, name: '', includedToolIds: [] }),
  default: ({ value, onChange }: any) => <button type="button" onClick={() => onChange({ ...value, name: ' Orientation ', includedToolIds: ['lathe'] })}>Fill group</button>,
}));

it('creates groups through the shared editor, retries failure, and refreshes the group catalog only on success', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockSaveGroup.mockResolvedValueOnce({ error: { message: 'Group unavailable' } }).mockResolvedValueOnce({ data: {} });
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const changed = jest.fn();
  window.addEventListener('tool-groups-changed', changed);
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const button = (label: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === label)!;
  try {
    await act(async () => root.render(<ToolEditorModal shops={[{ id: 'wood', name: 'Woodshop' }] as any} tools={[]}
      initialShopId="wood" onSaved={onSaved} onClose={onClose} />));
    expect(document.querySelector('input[aria-label="Tool Name"]') || document.querySelector('input')).not.toBeNull();
    await act(async () => (document.querySelector('input[value="group"]') as HTMLInputElement).click());
    expect(button('Add Group').disabled).toBe(true);
    await act(async () => button('Fill group').click());
    await act(async () => button('Add Group').click());
    expect(document.body.textContent).toContain('Group unavailable');
    expect(onSaved).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    await act(async () => button('Add Group').click());
    expect(mockSaveGroup).toHaveBeenLastCalledWith({ shopId: 'wood', name: 'Orientation', includedToolIds: ['lathe'] });
    expect(mockCreateTool).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1); expect(changed).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount()); host.remove(); window.removeEventListener('tool-groups-changed', changed);
  }
});
