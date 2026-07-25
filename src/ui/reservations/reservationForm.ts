import { Shop } from "app/entities/toolCheckout";

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
