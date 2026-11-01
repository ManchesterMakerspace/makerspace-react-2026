import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

const mockState: { rentals: any[]; currentUserId: string; canManageRentals: boolean; calls: any[] } = {
  rentals: [], currentUserId: 'owner', canManageRentals: false, calls: [],
};

jest.mock('makerspace-ts-api-client', () => ({ listRentals: jest.fn(), adminListRentals: jest.fn() }));
jest.mock('api/rentals', () => ({
  cancelRental: jest.fn(), markRentalVacated: jest.fn(), verifyRentalVacated: jest.fn(),
}));
jest.mock('ui/hooks/useReadTransaction', () => ({
  __esModule: true,
  default: () => ({ data: mockState.rentals, isRequesting: false, response: undefined, refresh: jest.fn(), error: undefined }),
}));
jest.mock('ui/hooks/useWriteTransaction', () => ({
  __esModule: true,
  default: (transaction: unknown, onSuccess?: () => void) => ({
    call: (args: unknown) => { mockState.calls.push([transaction, args]); onSuccess && onSuccess(); },
    isRequesting: false,
    error: undefined,
  }),
}));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: { id: mockState.currentUserId } }) }));
jest.mock('app/permissions', () => ({ useCapabilities: () => ({ canManageRentals: mockState.canManageRentals }) }));
jest.mock('ui/common/Filters/QueryContext', () => ({
  withQueryContext: (component: unknown) => component,
  useQueryContext: () => ({ params: {}, changePage: jest.fn() }),
}));
jest.mock('ui/utils/extractTotalItems', () => ({ __esModule: true, default: () => 0 }));
// A plain table: one select button per row plus each cell, so the screen's own buttons can be exercised.
jest.mock('ui/common/table/StatefulTable', () => ({
  __esModule: true,
  default: (props: any) => (
    <div>
      {props.data.map((row: any) => (
        <div key={props.rowId(row)}>
          <button data-select={row.id} onClick={() => props.setSelectedIds(row.id)}>select</button>
          {props.columns.map((column: any) => <span key={column.id}>{column.cell(row)}</span>)}
        </div>
      ))}
    </div>
  ),
}));

import { markRentalVacated, verifyRentalVacated } from 'api/rentals';
import MemberRentalsList from 'ui/rentals/MemberRentalsList';

const member: any = { id: 'owner', firstname: 'Pat', lastname: 'Member' };
const rental = (status: string) => ({ id: 'r1', number: 'BL_Tote_1', description: 'Tote', expiration: 1789000000000, status });

describe('rentals awaiting staff verification', () => {
  let container: HTMLDivElement;
  let root: Root;
  const button = (text: string) =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
  const render = async () => {
    await act(async () => root.render(<MemberRentalsList member={member} />));
    await act(async () => (document.querySelector('[data-select="r1"]') as HTMLButtonElement).click());
  };

  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    mockState.calls = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

  describe('as staff looking at a member', () => {
    beforeEach(() => { mockState.currentUserId = 'staff'; mockState.canManageRentals = true; });

    it('shows the rental as awaiting verification and offers Verify Vacated', async () => {
      mockState.rentals = [rental('awaiting_verification')];
      await render();

      expect(container.textContent).toContain('Awaiting Verification');
      expect(button('Verify Vacated for Pat Member')).toBeDefined();
      expect(button('Mark Vacated for Pat Member')).toBeUndefined();
    });

    it('verifies after a confirmation', async () => {
      mockState.rentals = [rental('awaiting_verification')];
      await render();

      await act(async () => button('Verify Vacated for Pat Member')!.click());
      expect(document.body.textContent).toContain('Have you checked that rental BL_Tote_1 is empty?');
      expect(mockState.calls).toEqual([]);

      await act(async () => button('Verify Vacated')!.click());
      expect(mockState.calls).toEqual([[verifyRentalVacated, { id: 'r1' }]]);
    });

    it('does not offer Verify Vacated for a rental that is only vacating', async () => {
      mockState.rentals = [rental('vacating')];
      await render();

      expect(button('Verify Vacated for Pat Member')).toBeUndefined();
      expect(button('Mark Vacated for Pat Member')).toBeDefined();
    });
  });

  describe('as the member', () => {
    beforeEach(() => { mockState.currentUserId = 'owner'; mockState.canManageRentals = false; });

    it('cannot verify their own rental, and sees it is waiting for staff', async () => {
      mockState.rentals = [rental('awaiting_verification')];
      await render();

      expect(container.textContent).toContain('Awaiting Verification');
      expect(button('Verify Vacated')).toBeUndefined();
      expect(button('Verify Vacated for Pat Member')).toBeUndefined();
    });

    it('is told that staff will check the space before it is released', async () => {
      mockState.rentals = [rental('vacating')];
      await render();

      await act(async () => button('Mark Vacated')!.click());
      expect(document.body.textContent).toContain('released once staff have checked that it is empty');
      expect(document.body.textContent).not.toContain('immediately end');

      await act(async () => button('Yes, I Have Vacated')!.click());
      expect(mockState.calls).toEqual([[markRentalVacated, { id: 'r1' }]]);
    });
  });
});
