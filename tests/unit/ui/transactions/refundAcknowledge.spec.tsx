import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import RefundTransactionModal from 'ui/transactions/RefundTransactionModal';

let mockIsAdmin = true;
jest.mock('app/permissions', () => ({ useCapabilities: () => ({ canRefundTransactions: mockIsAdmin }) }));
jest.mock('ui/hooks/useWriteTransaction', () => ({
  __esModule: true,
  default: () => ({ isRequesting: false, error: undefined, call: jest.fn() }),
}));

const transaction: any = {
  id: 't1', status: 'settled', amount: '70', discountAmount: '0', createdAt: new Date().toISOString(),
  memberName: 'Test Member', invoice: { description: 'Household membership' },
};

describe('refund acknowledgement', () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    mockIsAdmin = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const open = () => {
    act(() => root.render(<RefundTransactionModal transaction={transaction} onSuccess={jest.fn()} />));
    act(() => { container.querySelector<HTMLButtonElement>('#transactions-list-delete')!.click(); });
  };
  const submit = () => document.querySelector<HTMLButtonElement>('#refund-transaction-submit')!;

  it('keeps the refund button disabled until staff acknowledge the expiration date is not changed', () => {
    open();
    expect(document.body.textContent).toContain('does not change the member');
    expect(submit().disabled).toBe(true);
    act(() => { document.querySelector<HTMLInputElement>('#refund-transaction-acknowledge')!.click(); });
    expect(submit().disabled).toBe(false);
  });

  it('does not ask a member requesting a refund to acknowledge anything', () => {
    mockIsAdmin = false;
    open();
    expect(document.querySelector('#refund-transaction-acknowledge')).toBeNull();
    expect(submit().disabled).toBe(false);
  });
});
