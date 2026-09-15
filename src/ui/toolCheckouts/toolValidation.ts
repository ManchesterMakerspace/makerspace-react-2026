import { Tool } from "app/entities/toolCheckout";
const normalizedName = (value: string) => value.trim().toLowerCase();

export const duplicateToolName = (tools: Tool[], name: string, shopId: string, excludeId?: string) => {
  const target = normalizedName(name);
  return !!target && tools.some(t =>
    t.shopId === shopId && t.id !== excludeId && normalizedName(t.name) === target
  );
};

export const wouldCreatePrerequisiteLoop = (
  tools: Tool[],
  toolId: string | undefined,
  prerequisiteIds: string[]
) => {
  if (!toolId) return false;

  const byId = new Map(tools.map(t => [t.id, t]));
  const stack = [...prerequisiteIds];
  const visited = new Set<string>();

  while (stack.length) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === toolId) return true;

    visited.add(currentId);
    const currentTool = byId.get(currentId);
    currentTool?.prerequisiteIds?.forEach(id => stack.push(id));
  }

  return false;
};

