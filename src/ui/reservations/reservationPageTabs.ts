import { Reservation } from "app/entities/reservation";

export type ReservationPageTabKey =
  | "new"
  | "mine"
  | "history"
  | "managed"
  | "blackouts"
  | "manageShops"
  | "manageTools";

export interface ReservationPageTab {
  key: ReservationPageTabKey;
  label: string;
}

export const buildReservationPageTabs = (access: {
  canManageReservations: boolean;
  canManageBlackouts: boolean;
  canManageShops: boolean;
  canManageTools: boolean;
}): ReservationPageTab[] => {
  const tabs: ReservationPageTab[] = [
    { key: "new", label: "New Reservation" },
    { key: "mine", label: "My Reservations" },
    { key: "history", label: "History" },
  ];

  if (access.canManageReservations) {
    tabs.push({ key: "managed", label: "In My Shops" });
  }
  if (access.canManageBlackouts) {
    tabs.push({ key: "blackouts", label: "Reservation Blackouts" });
  }
  if (access.canManageShops) {
    tabs.push({ key: "manageShops", label: "Manage Shops" });
  }
  if (access.canManageTools) {
    tabs.push({ key: "manageTools", label: "Manage Tools" });
  }

  return tabs;
};

export const groupMemberReservations = (
  reservations: Reservation[],
  now = Date.now()
) => {
  const future = reservations.filter(item => new Date(item.endAt).getTime() > now);
  const terminalStatuses = new Set(["cancelled", "denied"]);

  return {
    upcoming: future.filter(item => item.status === "approved"),
    pending: future.filter(item => item.status === "pending"),
    cancelled: future.filter(item => terminalStatuses.has(item.status)),
    history: reservations
      .filter(item => new Date(item.endAt).getTime() <= now)
      .slice()
      .reverse(),
  };
};
