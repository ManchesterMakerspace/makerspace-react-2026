import { Location } from "app/entities/toolCheckout";

// Depth-first flatten of a shop's locations into option-list-friendly
// entries, using an actual character (not whitespace, which native <option>
// rendering can collapse) to show nesting depth. Shared by ToolLocationField
// (ToolManager.tsx) and ShopLocationMap.tsx so both surfaces describe a
// shop's cabinet/shelf/drawer hierarchy the same way.
export const flattenTree = (locations: Location[]): { id: string; label: string }[] => {
  const byParent = new Map<string | undefined, Location[]>();
  locations.forEach(l => {
    const key = l.parentId || undefined;
    byParent.set(key, [...(byParent.get(key) || []), l]);
  });
  const walk = (parentId: string | undefined, depth: number): { id: string; label: string }[] =>
    (byParent.get(parentId) || []).flatMap(l => [
      { id: l.id, label: `${"—".repeat(depth)}${depth ? " " : ""}${l.name}` },
      ...walk(l.id, depth + 1),
    ]);
  return walk(undefined, 0);
};
