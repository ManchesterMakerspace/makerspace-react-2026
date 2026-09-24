import * as React from "react";
import { listShops, listManagedShops, listTools } from "api/toolCheckouts";
import useReadTransaction, { ReadTransaction } from "ui/hooks/useReadTransaction";
import { Shop, Tool } from "app/entities/toolCheckout";

type Catalog = { shops: Shop[]; managedShops: Shop[]; tools: Tool[] };
type Resource = keyof Catalog;
type Reads = { [K in Resource]: ReadTransaction<any, Catalog[K]> };
const transactions = { shops: listShops, managedShops: listManagedShops, tools: listTools };
const Context = React.createContext<{
  reads: Reads;
  enable: (resource: Resource) => void;
  refresh: () => void;
} | null>(null);

// One lazy catalog per mounted checkout page. Public and management responses
// have separate keys. Nothing is reused when leaving/re-entering the page.
export const CheckoutCatalogProvider: React.FC<React.PropsWithChildren<{ scopeKey: string }>> = ({ children, scopeKey }) => {
  const [enabled, setEnabled] = React.useState<Partial<Record<Resource, boolean>>>({});
  const enable = React.useCallback((resource: Resource) => {
    setEnabled(previous => previous[resource] ? previous : { ...previous, [resource]: true });
  }, []);
  const shops = useReadTransaction(listShops, {}, !enabled.shops, `checkout-catalog-shops-${scopeKey}`, true, true);
  const managedShops = useReadTransaction(listManagedShops, {}, !enabled.managedShops, `checkout-catalog-managed-shops-${scopeKey}`, true, true);
  const tools = useReadTransaction(listTools, {}, !enabled.tools, `checkout-catalog-tools-${scopeKey}`, true, true);
  const refresh = React.useCallback(() => {
    if (enabled.shops) shops.refresh();
    if (enabled.managedShops) managedShops.refresh();
    if (enabled.tools) tools.refresh();
  }, [enabled, shops.refresh, managedShops.refresh, tools.refresh]);
  return <Context.Provider value={{ reads: { shops, managedShops, tools }, enable, refresh }}>
    {children}
  </Context.Provider>;
};

export function useCheckoutCatalog<K extends Resource>(resource: K, delay = false): Reads[K] {
  const context = React.useContext(Context);
  // Member-profile checkout tabs also use these components outside the page.
  const fallback = useReadTransaction<any, Catalog[K]>(
    transactions[resource] as any, {}, !!context || delay, `checkout-catalog-fallback-${resource}`
  );
  React.useEffect(() => {
    if (!delay) context?.enable(resource);
  }, [context?.enable, resource, delay]);
  return (context ? { ...context.reads[resource], refresh: context.refresh } : fallback) as Reads[K];
}
