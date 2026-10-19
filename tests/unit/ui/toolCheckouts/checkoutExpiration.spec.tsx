import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ToolCheckout } from 'app/entities/toolCheckout';
import CheckoutTrainingPlanLink from 'ui/toolCheckouts/CheckoutTrainingPlanLink';
import { CheckoutExpirationActions } from 'ui/toolCheckouts/CheckoutExpirationActions';
import { rosterStatus, statusFilterParams } from 'ui/toolCheckouts/checkoutRosterStatus';

const mockUpdate = jest.fn();
const mockRequest = jest.fn();
jest.mock('api/toolCheckouts', () => ({
  updateCheckoutExpiration: (...args: any[]) => mockUpdate(...args),
  createToolCheckoutRequest: (...args: any[]) => mockRequest(...args),
}));
jest.mock('ui/common/FormModal', () => ({ children, onSubmit, error, submitText }: any) =>
  <div role="dialog">{children}<p>{error}</p><button onClick={onSubmit}>{submitText}</button></div>);

describe('checkout expiration controls', () => {
  let container: HTMLDivElement, root: Root;
  const row = { id: 'checkout', memberId: 'member', toolId: 'tool', toolName: 'Bandsaw', memberName: 'Test Member',
    expiresOn: '2026-10-01', expirationStatus: 'expired', expirationRevision: 4, active: false } as ToolCheckout;
  const onSaved = jest.fn();
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({ data: {} }); mockRequest.mockResolvedValue({ data: {} });
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const click = async (label: string) => act(async () => {
    const button = Array.from(container.querySelectorAll('button')).filter(item => item.textContent === label).pop();
    expect(button).toBeDefined(); button!.click();
  });

  it('distinguishes expiration and renewal history from revocation', () => {
    expect(rosterStatus(row)).toBe('expired');
    expect(rosterStatus({ ...row, expirationStatus: 'history', supersededById: 'new' })).toBe('history');
    expect(statusFilterParams('expired')).toEqual({ status: 'expired' });
    expect(statusFilterParams('history')).toEqual({ status: 'history' });
    expect(statusFilterParams('revoked')).toEqual({ active: false, reinstated: false });
  });

  it('opens safe training plans in a separate browsing context', async () => {
    await act(async () => root.render(<CheckoutTrainingPlanLink url="https://example.com/training" />));
    const link = container.querySelector('a')!;
    expect(link.textContent).toBe('Checkout training plan'); expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    for (const url of ['javascript:alert(1)', '/relative', 'https://user:secret@example.com', null]) {
      await act(async () => root.render(<CheckoutTrainingPlanLink url={url} />));
      expect(container.querySelector('a')).toBeNull();
    }
  });

  it('uses server capabilities and keeps expired checkouts visible', async () => {
    await act(async () => root.render(<CheckoutExpirationActions checkout={row} onSaved={onSaved} />));
    expect(container.textContent).toContain('Expired 2026-10-01');
    expect(container.querySelector('button')).toBeNull();
    await act(async () => root.render(<CheckoutExpirationActions checkout={{ ...row, canRenew: true }} onSaved={onSaved} />));
    await click('Request renewal'); await click('Request renewal');
    expect(mockRequest).toHaveBeenCalledWith({ body: { toolId: 'tool', note: '' } });
  });

  it('submits the displayed expiration revision and shows stale-edit errors', async () => {
    mockUpdate.mockResolvedValue({ error: { status: 409, message: 'This checkout changed. Refresh before saving.' } });
    await act(async () => root.render(<CheckoutExpirationActions checkout={{ ...row, canManageExpiration: true }} onSaved={onSaved} />));
    await click('Edit expiration'); await click('Save expiration');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ expirationRevision: 4 }), '2026-10-01');
    expect(container.textContent).toContain('This checkout changed. Refresh before saving.');
    expect(onSaved).toHaveBeenCalled();
  });
});
