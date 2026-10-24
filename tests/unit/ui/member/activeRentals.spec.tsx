import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import {
  ActiveRentalsBanner, ActiveRentalsStatusNote, activeRentalsOf, membershipHasEnded
} from 'ui/member/activeRentals';

const rentals = [{ id: 'r1', number: 'BS-Tote-3', description: 'BS-Tote-3 (Black Tote)', billing: true }];
const future = Date.now() + 86_400_000;
const past = Date.now() - 86_400_000;

describe('active rentals for staff (#276)', () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const render = (node: React.ReactElement) => act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));

  it('reads the list the server sends and nothing else', () => {
    expect(activeRentalsOf({ activeRentals: rentals })).toEqual(rentals);
    expect(activeRentalsOf({})).toEqual([]);
    expect(activeRentalsOf(undefined)).toEqual([]);
  });

  it('treats a membership as ended like Rails does', () => {
    expect(membershipHasEnded({ status: 'activeMember', expirationTime: future })).toBe(false);
    expect(membershipHasEnded({ status: 'activeMember', expirationTime: past })).toBe(true);
    expect(membershipHasEnded({ status: 'activeMember', expirationTime: null })).toBe(true);
    for (const status of ['revoked', 'suspended', 'expired', 'nonMember', 'inactive']) {
      expect(membershipHasEnded({ status, expirationTime: future })).toBe(true);
    }
    expect(membershipHasEnded({})).toBe(false);
  });

  it('shows the banner, with the space, billing, and where to act, when the membership has ended', () => {
    render(<ActiveRentalsBanner member={{ status: 'activeMember', expirationTime: past, activeRentals: rentals }} />);
    const banner = container.querySelector('#member-active-rentals-banner');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Membership ended');
    expect(banner!.textContent).toContain('BS-Tote-3 (Black Tote) (still billing)');
    expect(banner!.textContent).toContain('Rental Management');
    expect(banner!.textContent).toContain('board member confirms the space is empty');
    expect(banner!.querySelector('a')!.getAttribute('href')).toBe('/admin/rentals');
  });

  it('shows no banner for a current member, or an ended membership with no active rental', () => {
    render(<ActiveRentalsBanner member={{ status: 'activeMember', expirationTime: future, activeRentals: rentals }} />);
    expect(container.querySelector('#member-active-rentals-banner')).toBeNull();
    render(<ActiveRentalsBanner member={{ status: 'revoked', expirationTime: past, activeRentals: [] }} />);
    expect(container.querySelector('#member-active-rentals-banner')).toBeNull();
    render(<ActiveRentalsBanner member={{ status: 'revoked', expirationTime: past }} />);
    expect(container.querySelector('#member-active-rentals-banner')).toBeNull();
  });

  it('uses plural wording for several rentals', () => {
    render(<ActiveRentalsBanner member={{ status: 'revoked', activeRentals: [...rentals, { ...rentals[0], id: 'r2', description: 'Shelf-2' , billing: false }] }} />);
    expect(container.querySelector('#member-active-rentals-banner')!.textContent).toContain('are active rentals');
  });

  it('notes beside the status field that changing the status does not cancel a rental', () => {
    render(<ActiveRentalsStatusNote member={{ status: 'activeMember', expirationTime: future, activeRentals: rentals }} />);
    const note = container.querySelector('#member-active-rentals-status-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('does not cancel it');
    expect(note!.textContent).toContain('BS-Tote-3 (Black Tote)');
    render(<ActiveRentalsStatusNote member={{ status: 'activeMember', expirationTime: future }} />);
    expect(container.querySelector('#member-active-rentals-status-note')).toBeNull();
  });
});
