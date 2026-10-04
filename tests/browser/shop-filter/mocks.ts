import * as React from 'react';
export const shops = [{ id: 'wood', name: 'Woodshop' }, { id: 'metal', name: 'Metalshop' }];
const tools = shops.map(shop => ({ id: shop.id, name: `${shop.name} saw`, shopId: shop.id, shopName: shop.name, requestable: true }));
export const groups = shops.map(shop => ({ id: `${shop.id}-group`, name: `${shop.name} introduction`, shopId: shop.id, includedTools: [tools.find(tool => tool.shopId === shop.id)], canRequest: true, canApprove: shop.id === 'wood', targetType: 'group' }));
export const listAvailableTools = async ({ shopId }: any = {}) => {
  (window as any).shopCalls = [...((window as any).shopCalls || []), shopId || 'all'];
  return { data: tools.filter(tool => !shopId || tool.shopId === shopId) };
};
let groupLoadFailed = false;
export const listToolGroups = async (shopId?: string) => {
  if (location.search.includes('failure') && !groupLoadFailed) {
    groupLoadFailed = true;
    return { error: 'Catalog unavailable' };
  }
  return { data: groups.filter(group => !shopId || group.shopId === shopId) };
};
export const listToolCheckouts = async () => ({ data: [] });
export const listMemberCheckouts = listToolCheckouts;
export const searchCheckoutMembers = listToolCheckouts;
export const adminRevokeToolCheckout = listToolCheckouts;
export const listMyToolCheckoutRequests = async () => ({ data: [] });
export const listToolCheckoutRequests = listMyToolCheckoutRequests;
export const createToolCheckoutRequest = listMyToolCheckoutRequests;
export const updateToolCheckoutRequest = listMyToolCheckoutRequests;
export const deleteToolCheckoutRequest = listMyToolCheckoutRequests;
export const adminCreateToolCheckout = listMyToolCheckoutRequests;
export const approveToolGroup = listMyToolCheckoutRequests;
let reviewFailed = false;
export const reviewToolGroup = async () => {
  if (location.search.includes('failure') && !reviewFailed) {
    reviewFailed = true;
    return { error: { message: 'Review unavailable' } };
  }
  return { data: { group: groups[0], revision: 1, heldToolIds: ['wood'], createToolIds: [], prerequisiteIds: [], prerequisiteNames: [], missingPrerequisiteIds: [] } };
};
export const listCheckoutApprovers = async () => ({ data: [{ id: 'approver', memberName: 'Group trainer', memberEmail: 'trainer@example.test',
  toolIds: ['wood'], toolNames: ['Woodshop saw'], shopIds: [], shopNames: [],
  toolGroups: [{ id: 'wood-group', name: 'Woodshop introduction', shopId: 'wood' }] }] });
export const adminCreateCheckoutApprover = listMyToolCheckoutRequests;
export const adminUpdateCheckoutApprover = listMyToolCheckoutRequests;
export const adminDeleteCheckoutApprover = listMyToolCheckoutRequests;
export const saveToolGroup = async (body: any) => { (window as any).savedGroup = body; return { data: body }; };
export const adminListLocations = async () => ({ data: [] });
export const archiveToolGroup = listMyToolCheckoutRequests;
export const useCheckoutCatalog = () => ({ data: shops });
export function useRead(transaction: any, args: any, delay: boolean) {
  const [data, setData] = React.useState([]);
  React.useEffect(() => { let active = true; if (!delay && transaction) transaction(args).then((result: any) => { if (active) setData(result.data); }); return () => { active = false; }; }, [transaction, JSON.stringify(args), delay]);
  return { data, refresh: () => {}, isRequesting: false, error: '' };
}
export const useWrite = () => ({ call: () => {}, isRequesting: false, error: '' });

let resourceLoadFailed = false;
export const listTools = async () => {
  (window as any).toolLoads = ((window as any).toolLoads || 0) + 1;
  if (location.search.includes('failure') && !resourceLoadFailed) {
    resourceLoadFailed = true;
    return { error: { message: 'Resources unavailable' } };
  }
  return { data: tools };
};
export const listManagedShops = async () => {
  (window as any).shopLoads = ((window as any).shopLoads || 0) + 1;
  return { data: shops };
};
export const adminCreateTool = listMyToolCheckoutRequests;

export const adminUpdateToolAnnotation = listMyToolCheckoutRequests;
export const adminUpdateToolNotes = listMyToolCheckoutRequests;
export const adminUpdateTool = listMyToolCheckoutRequests;
export const adminDeleteTool = listMyToolCheckoutRequests;
