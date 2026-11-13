import { Routing } from 'app/constants';
export function enrollmentDestination(value: string): string | null {
  try {
    const url = new URL(value);
    const id = url.searchParams.get('memberId'), flow = url.searchParams.get('flow');
    if (url.protocol !== 'makerspace:' || url.hostname !== 'fob-enrollment' || url.pathname || !/^[a-f0-9]{24}$/i.test(id || '')) return null;
    if (flow === 'admin') return `/members/${id}?enroll=1`;
    if (flow === 'issuer') return `${Routing.IssueFob}?enrollMember=${id}`;
  } catch { /* Untrusted navigation request. */ }
  return null;
}
