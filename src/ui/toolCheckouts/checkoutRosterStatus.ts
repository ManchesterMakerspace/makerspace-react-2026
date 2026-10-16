import { ToolCheckout } from "app/entities/toolCheckout";

export type RosterStatusFilter = "active" | "revoked" | "reinstated" | "all";

// Query params for the roster's Status filter. "Revoked only" leaves out revoked rows that an
// active checkout has superseded; those appear under "Reinstated".
export const statusFilterParams = (filter: RosterStatusFilter): { active?: boolean; reinstated?: boolean } => {
  switch (filter) {
    case "active": return { active: true };
    case "revoked": return { active: false, reinstated: false };
    case "reinstated": return { reinstated: true };
    default: return {};
  }
};

export type RosterStatus = "active" | "reinstatedActive" | "reinstatedRevoked" | "revoked";

export const rosterStatus = (row: ToolCheckout): RosterStatus => {
  if (row.active) return row.reinstatedFromId ? "reinstatedActive" : "active";
  return row.reinstated ? "reinstatedRevoked" : "revoked";
};

// Keeps a reinstated pair adjacent whatever order the rows arrive in or are sorted to:
// the active (replacement) row first, directly followed by the revoked row it replaced.
// A source row whose replacement is not in the list stays where it is.
export const keepReinstatedPairsTogether = (rows: ToolCheckout[]): ToolCheckout[] => {
  const ids = new Set(rows.map(row => row.id));
  const sourceByReplacement = new Map<string, ToolCheckout>();
  const byId = new Map(rows.map(row => [row.id, row] as const));
  rows.forEach(row => {
    const source = row.active && row.reinstatedFromId ? byId.get(row.reinstatedFromId) : undefined;
    if (source && !source.active) sourceByReplacement.set(row.id, source);
  });
  if (!sourceByReplacement.size) return rows;
  const moved = new Set(Array.from(sourceByReplacement.values()).map(row => row.id));
  const ordered: ToolCheckout[] = [];
  rows.forEach(row => {
    if (moved.has(row.id) && ids.has(row.id)) return;
    ordered.push(row);
    const source = sourceByReplacement.get(row.id);
    if (source) ordered.push(source);
  });
  return ordered;
};
