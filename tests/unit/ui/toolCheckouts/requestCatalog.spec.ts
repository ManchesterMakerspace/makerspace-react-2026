import { requestCatalog } from 'ui/toolCheckouts/requestCatalog';
import { selectableGroupIds } from 'ui/reservations/selectableGroupIds';

const tools: any[] = [{ id: 't1', name: 'Bandsaw', shopName: 'Woodshop' }, { id: 't2', name: 'Lathe', shopName: 'Metalshop' }];
const groups: any[] = [{ id: 'g1', name: 'Introduction', includedTools: [tools[0]], canRequest: true }, { id: 'g2', name: 'Metal kit', includedTools: [tools[1]] }];
it('searches both catalogs before counting and paging', () => {
  const result = requestCatalog(tools, groups, { search: 'metal', pageNum: 0 }, 1);
  expect(result.total).toBe(2);
  expect(result.rows.map(row => row.id)).toEqual(['t2']);
  expect(requestCatalog(tools, groups, { search: 'metal', pageNum: 1 }, 1).rows.map(row => row.id)).toEqual(['g2']);
  expect(requestCatalog(tools, groups, { search: 'missing' }, 2)).toEqual({ total: 0, rows: [] });
});
it('places alphabetic groups after tools without repeating them on later pages', () => {
  const ids = [0, 1, 2].flatMap(pageNum => requestCatalog(tools, groups, { pageNum }, 2).rows.map(row => row.id));
  expect(ids).toEqual(['t1', 't2', 'g1', 'g2']);
});
it('removes archived or other-shop groups from a fresh resource selection', () => {
  const historical = ['archived', 'available', 'other-shop'];
  expect(selectableGroupIds(historical, [{ id: 'available' }])).toEqual(['available']);
  expect(historical).toEqual(['archived', 'available', 'other-shop']);
});
