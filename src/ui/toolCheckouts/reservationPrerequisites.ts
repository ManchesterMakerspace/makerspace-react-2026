export const togglePrerequisiteToolId = (
  prerequisiteToolIds: readonly string[] | undefined,
  toolId: string
): string[] => {
  const selected = Array.from(prerequisiteToolIds || []);
  return selected.includes(toolId)
    ? selected.filter(id => id !== toolId)
    : [...selected, toolId];
};
