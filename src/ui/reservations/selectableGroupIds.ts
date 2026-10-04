export const selectableGroupIds = (ids: string[], groups: Array<{ id: string }>) =>
  ids.filter(id => groups.some(group => group.id === id));
