import { Location } from "app/entities/toolCheckout";
import { labelForKind } from "./locationKinds";

// Depth-first flatten of a shop's locations into option-list-friendly
// entries, using an actual character (not whitespace, which native <option>
// rendering can collapse) to show nesting depth. Shared by ToolLocationField
// (ToolManager.tsx) and ShopLocationMap.tsx so both surfaces describe a
// shop's cabinet/shelf/drawer hierarchy the same way. Appends the kind in
// parens when it's set to one of the known kinds (blank/free-text-only
// kinds are skipped rather than showing a raw, possibly-redundant string).
export const flattenTree = (locations: Location[]): { id: string; label: string; depth: number }[] => {
  const byParent = new Map<string | undefined, Location[]>();
  locations.forEach(l => {
    const key = l.parentId || undefined;
    byParent.set(key, [...(byParent.get(key) || []), l]);
  });
  const walk = (parentId: string | undefined, depth: number): { id: string; label: string; depth: number }[] =>
    (byParent.get(parentId) || []).flatMap(l => {
      const kindLabel = labelForKind(l.kind);
      const name = kindLabel ? `${l.name} (${kindLabel})` : l.name;
      return [
        { id: l.id, label: `${"—".repeat(depth)}${depth ? " " : ""}${name}`, depth },
        ...walk(l.id, depth + 1),
      ];
    });
  return walk(undefined, 0);
};
