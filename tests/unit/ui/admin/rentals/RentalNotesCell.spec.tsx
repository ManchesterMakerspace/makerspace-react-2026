import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { RentalNotesCell, rentalNote } from 'ui/admin/rentals/RentalNotesCell';

describe('rental notes column', () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const render = (rental?: unknown) => act(() => root.render(<RentalNotesCell rental={rental} />));

  it('reads the note, tidying whitespace, and tolerates a missing one', () => {
    expect(rentalNote({ notes: '  assigned to  WOODSHOP \n' })).toBe('assigned to WOODSHOP');
    expect(rentalNote({ notes: null })).toBe('');
    expect(rentalNote({})).toBe('');
    expect(rentalNote(undefined)).toBe('');
  });

  it('shows the note so staff do not have to open Edit Rental', () => {
    render({ notes: 'contains facilities cleaning supplies' });
    expect(container.textContent).toBe('contains facilities cleaning supplies');
  });

  it('shortens a long note in the table', () => {
    render({ notes: 'x'.repeat(200) });
    expect(container.textContent!.length).toBe(60);
    expect(container.textContent!.endsWith('…')).toBe(true);
  });

  it('shows a dash when there is no note', () => {
    render({ notes: '  ' });
    expect(container.textContent).toBe('—');
    render({});
    expect(container.textContent).toBe('—');
  });
});
