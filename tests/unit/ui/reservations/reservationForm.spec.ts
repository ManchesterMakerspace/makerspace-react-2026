import { reservationShopOptions } from "ui/reservations/reservationForm";

const shops = [
  { id: "managed", name: "Managed Shop" },
  { id: "unmanaged", name: "Unmanaged Shop" },
] as any;

const options = (overrides: Record<string, unknown> = {}) => ({
  shops,
  managedShopIds: ["managed"],
  creatingForMember: false,
  editingManaged: false,
  isResourceManager: true,
  isAdmin: false,
  isBoardMember: false,
  ...overrides,
});

describe("reservationShopOptions", () => {
  it("restricts delegated creation and managed edits to an RM's shops", () => {
    expect(reservationShopOptions(options({ creatingForMember: true }))
      .map(shop => shop.id)).toEqual(["managed"]);
    expect(reservationShopOptions(options({ editingManaged: true }))
      .map(shop => shop.id)).toEqual(["managed"]);
  });

  it("does not restrict an RM's own reservation form", () => {
    expect(reservationShopOptions(options()).map(shop => shop.id))
      .toEqual(["managed", "unmanaged"]);
  });

  it("does not restrict global administrators during managed operations", () => {
    expect(reservationShopOptions(options({
      editingManaged: true,
      isAdmin: true,
    })).map(shop => shop.id)).toEqual(["managed", "unmanaged"]);
  });
});
