// The isolated bounty editor has no shop/tool catalog; its credit input and
// real update API are exercised without bootstrapping the whole Redux app.
const rows: unknown[] = [];
export default function useReadTransaction() {
  return { data: rows, isRequesting: false, error: '', refresh: () => {} };
}
