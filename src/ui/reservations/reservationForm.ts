import { Shop } from "app/entities/toolCheckout";
import { ReservationCatalog } from "app/entities/reservation";

export const reservationCatalogDefaults = (
  catalog: ReservationCatalog,
  search: string
): { shopId: string; scope: "shop" | "tools"; toolIds: string[] } | null => {
  const query = new URLSearchParams(search);
  if (query.has("edit")) return null;

  const requestedShopId = query.get("shop");
  const requestedToolId = query.get("tool");
  const requestedTool = catalog.tools.find(tool =>
    tool.id === requestedToolId &&
    (!requestedShopId || tool.shopId === requestedShopId)
  );
  const first = catalog.shops.find(shop =>
    shop.id === (requestedShopId || requestedTool?.shopId)
  ) || catalog.shops[0];
  if (!first) return null;

  return requestedTool?.shopId === first.id
    ? { shopId: first.id, scope: "tools", toolIds: [requestedTool.id] }
    : {
        shopId: first.id,
        scope: first.reservable ? "shop" : "tools",
        toolIds: [],
      };
};

export const reservationShopOptions = ({
  shops,
  managedShopIds,
  creatingForMember,
  editingManaged,
  isResourceManager,
  isAdmin,
  isBoardMember,
}: {
  shops: Shop[];
  managedShopIds: string[];
  creatingForMember: boolean;
  editingManaged: boolean;
  isResourceManager: boolean;
  isAdmin: boolean;
  isBoardMember: boolean;
}): Shop[] => {
  const restrictToManagedShops =
    (creatingForMember || editingManaged) &&
    isResourceManager &&
    !isAdmin &&
    !isBoardMember;

  return restrictToManagedShops
    ? shops.filter(shop => managedShopIds.includes(shop.id))
    : shops;
};
