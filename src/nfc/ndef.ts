export interface TagRecord {
  recordType: string;
  data?: DataView;
  encoding?: string;
  toRecords?: () => TagRecord[];
}
export interface TagContent { urls: string[]; texts: string[]; unsupported: string[]; }

/** Browser records are already URI-decoded. Native bridges emit the same content shape. */
export function decodeNdef(records: TagRecord[], depth = 0): TagContent {
  if (depth > 4 || records.length > 64) throw new Error('NDEF message is too complex.');
  const content: TagContent = { urls: [], texts: [], unsupported: [] };
  const posters = records.filter(record => record.recordType === 'smart-poster');
  for (const record of records) {
    if ((record.data?.byteLength || 0) > 32768) throw new Error('NDEF record is too large.');
    if (record.recordType === 'smart-poster') {
      const nested = decodeNdef(record.toRecords?.() || [], depth + 1);
      content.urls.push(...nested.urls);
      content.texts.push(...nested.texts);
      content.unsupported.push(...nested.unsupported);
    } else if (record.recordType === 'url' || record.recordType === 'absolute-url') {
      if (!posters.length) content.urls.push(new TextDecoder().decode(record.data));
    } else if (record.recordType === 'text') {
      content.texts.push(new TextDecoder(record.encoding || 'utf-8').decode(record.data));
    } else if (record.recordType !== 'empty') content.unsupported.push(record.recordType);
  }
  content.urls = [...new Set(content.urls)];
  return content;
}
