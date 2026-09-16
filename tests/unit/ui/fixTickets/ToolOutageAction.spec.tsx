import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
const mockFixRequest = jest.fn();
jest.mock('api/fixTickets', () => ({ fixRequest: (...args: unknown[]) => mockFixRequest(...args) }));
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div role="dialog">{children}</div> : null,
}));
import ToolOutageAction from 'ui/fixTickets/ToolOutageAction';

describe('Tool outage dialog feedback', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockFixRequest.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ToolOutageAction tool={{ id: 'tool', name: 'Lathe' }} onSaved={jest.fn()} />));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const click = async (text: string) => {
    const button = Array.from(container.querySelectorAll('button')).find(button => button.textContent === text)!;
    expect(button).toBeDefined();
    await act(async () => button.click());
  };
  it('clears failed feedback when closing and reopening, then permits a fresh attempt', async () => {
    mockFixRequest.mockRejectedValueOnce(new Error('Outage save failed'));
    await click('Mark out of service');
    await click('Confirm');
    expect(container.textContent).toContain('Outage save failed');
    await click('Close');
    await click('Mark out of service');
    expect(container.textContent).not.toContain('Outage save failed');
    mockFixRequest.mockResolvedValueOnce({ affectedCount: 1, affectedReservations: [{ id: 'reservation', startAt: '2026-09-15T12:00:00Z' }] });
    await click('Confirm');
    expect(container.textContent).toContain('1 existing reservations need review');
    expect(container.querySelector('[aria-label="Affected reservations"]')).not.toBeNull();
    await click('Close');
    await click('Mark out of service');
    expect(container.textContent).not.toContain('existing reservations need review');
    expect(container.querySelector('[aria-label="Affected reservations"]')).toBeNull();
    expect(container.textContent).toContain('Confirm');
    expect(mockFixRequest).toHaveBeenCalledTimes(2);
  });
});
