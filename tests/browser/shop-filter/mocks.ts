import * as React from 'react';
export const shops = [{ id: 'wood', name: 'Woodshop' }, { id: 'metal', name: 'Metalshop' }];
const tools = shops.map(shop => ({ id: shop.id, name: `${shop.name} saw`, shopId: shop.id, shopName: shop.name, requestable: true }));
const groups = shops.map(shop => ({ id: `${shop.id}-group`, name: `${shop.name} introduction`, shopId: shop.id, includedTools: [tools.find(tool => tool.shopId === shop.id)], canRequest: true, canApprove: shop.id === 'wood', targetType: 'group' }));
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
export const reviewToolGroup = listMyToolCheckoutRequests;
export const saveToolGroup = listMyToolCheckoutRequests;
export const archiveToolGroup = listMyToolCheckoutRequests;
export const useCheckoutCatalog = () => ({ data: shops });
export function useRead(transaction: any, args: any, delay: boolean) {
  const [data, setData] = React.useState([]);
  React.useEffect(() => { let active = true; if (!delay && transaction) transaction(args).then((result: any) => { if (active) setData(result.data); }); return () => { active = false; }; }, [transaction, JSON.stringify(args), delay]);
  return { data, refresh: () => {}, isRequesting: false, error: '' };
}
export const useWrite = () => ({ call: () => {}, isRequesting: false, error: '' });
