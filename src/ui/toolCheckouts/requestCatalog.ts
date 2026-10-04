import { Tool, ToolGroup } from 'app/entities/toolCheckout';

// Both source endpoints return complete catalogs. Apply one query to their
// combined rows so a group occupies exactly one position in the paged result.
export function requestCatalog(tools: Tool[], groups: ToolGroup[], params: any, pageSize: number) {
  const search = String(params.search || '').trim().toLocaleLowerCase();
  const matches = (row: any) => (!params.shopId || row.shopId === params.shopId) &&
    (!search || [row.name, row.shopName, row.description].some(value => String(value || '').toLocaleLowerCase().includes(search)));
  const key = ['name', 'shopName', 'requestable'].includes(params.orderBy) ? params.orderBy : 'name';
  const direction = key === params.orderBy && params.order === 'desc' ? -1 : 1;
  const compare = (a: any, b: any) => direction * String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  const rows = [...tools.filter(matches).sort(compare),
    ...groups.map(group => ({ ...group, shopName: group.includedTools?.[0]?.shopName, requestable: group.canRequest })).filter(matches).sort(compare)];
  const offset = Math.max(0, Number(params.pageNum) || 0) * pageSize;
  return { rows: rows.slice(offset, offset + pageSize), total: rows.length };
}
