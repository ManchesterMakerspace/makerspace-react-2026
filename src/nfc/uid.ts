/** A UID is bytes, never an integer: preserve byte order and leading zeroes. */
export function normalizeUid(value: string | ArrayLike<number>): string {
  if (typeof value === 'string') {
    const serial = value.trim();
    if (serial.length > 383) throw new Error('The card UID is too long.');
    if (!/^(?:[\da-f]{2})+$/i.test(serial) &&
        !/^[\da-f]{2}(?::[\da-f]{2})+$/i.test(serial) &&
        !/^[\da-f]{2}(?:-[\da-f]{2})+$/i.test(serial)) {
      throw new Error('The card did not provide a valid hexadecimal UID.');
    }
    const normalized = serial.replace(/[:-]/g, '').toUpperCase();
    if (normalized.length > 256) throw new Error('The card UID is too long.');
    return normalized;
  }
  const bytes = Array.from(value);
  if (!bytes.length || bytes.length > 128 || bytes.some(byte => !Number.isInteger(byte) || byte < -128 || byte > 255)) {
    throw new Error('The card did not provide a valid UID.');
  }
  return bytes.map(byte => (byte & 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
