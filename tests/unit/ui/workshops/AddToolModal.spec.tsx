import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
const mockTools = jest.fn();
const mockShops = jest.fn();
jest.mock('api/toolCheckouts', () => ({ listTools: (...args: any[]) => mockTools(...args), listManagedShops: () => mockShops() }));
jest.mock('ui/toolCheckouts/ToolEditorModal', () => ({ __esModule: true, default: () => <div>Resource form</div> }));
import AddToolModal from 'ui/workshops/AddToolModal';
it.each(['tools', 'shops', 'rejection'])('retries both catalogs after %s fails', async failure => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockTools.mockReset(); mockShops.mockReset();
  mockTools.mockResolvedValue({ data: [] });
  mockShops.mockResolvedValue({ data: [{ id: 'wood' }] });
  if (failure === 'rejection') mockTools.mockRejectedValueOnce(new Error('offline'));
  else (failure === 'tools' ? mockTools : mockShops).mockResolvedValueOnce({ error: { message: 'offline' } });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AddToolModal workshop={{ id: 'wood' } as any} onClose={jest.fn()} onCreated={jest.fn()} />));
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry resources')!.click());
    expect(mockTools).toHaveBeenCalledTimes(2); expect(mockShops).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Resource form');
  } finally { act(() => root.unmount()); host.remove(); }
});
