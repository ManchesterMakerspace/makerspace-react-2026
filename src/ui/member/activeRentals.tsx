import * as React from "react";
import { Link } from "react-router-dom";
import Alert from "@mui/material/Alert";
import { Routing } from "app/constants";

// Rails sends the rentals still marked active to admin/board only (`activeRentals` on the
// member profile). Rentals bill on their own subscriptions, so ending a membership does not
// end them: the member (or staff) has to cancel the rental, and a board member confirms the
// space is empty before it is rented again (#276).
export interface ActiveRental {
  id: string;
  number: string;
  description: string;
  billing: boolean;
}

export const activeRentalsOf = (member?: unknown): ActiveRental[] =>
  ((member as { activeRentals?: ActiveRental[] } | undefined)?.activeRentals) || [];

// Mirrors RentalLapseNotifier.reason_for: not active or pending, never paid, or past expiration.
export const membershipHasEnded = (member?: unknown, now: number = Date.now()): boolean => {
  const { status, expirationTime } = (member || {}) as { status?: string; expirationTime?: number | null };
  if (!status) return false;
  if (!["activeMember", "pending"].includes(status)) return true;
  return expirationTime == null || Number(expirationTime) < now;
};

const spaces = (rentals: ActiveRental[]) => rentals.map(rental => `${rental.description}${rental.billing ? " (still billing)" : ""}`).join(", ");

export const ActiveRentalsBanner: React.FC<{ member?: unknown }> = ({ member }) => {
  const rentals = activeRentalsOf(member);
  if (!rentals.length || !membershipHasEnded(member)) return null;
  return (
    <Alert id="member-active-rentals-banner" severity="warning" role="status" sx={{ marginBottom: 2 }}>
      <strong>Membership ended, but there {rentals.length > 1 ? "are active rentals" : "is an active rental"}.</strong>{" "}
      {spaces(rentals)}. A rental keeps its own subscription and keeps billing until it is cancelled. Ask the member to
      cancel it from their profile (Rentals tab), or cancel it in{" "}
      <Link to={Routing.AdminRentals}>Rental Management</Link>. A board member confirms the space
      is empty before it can be rented again.
    </Alert>
  );
};

// Shown beside the status field when editing: changing the status never cancels a rental.
export const ActiveRentalsStatusNote: React.FC<{ member?: unknown }> = ({ member }) => {
  const rentals = activeRentalsOf(member);
  if (!rentals.length) return null;
  return (
    <Alert id="member-active-rentals-status-note" severity="info" sx={{ marginTop: 1 }}>
      This member has {rentals.length > 1 ? "active rentals" : "an active rental"}: {spaces(rentals)}. Revoking or suspending
      the membership does not cancel {rentals.length > 1 ? "them" : "it"}; {rentals.length > 1 ? "they keep" : "it keeps"} billing
      until cancelled. Staff are told in Slack when you save, and the member too where they can be reached.
    </Alert>
  );
};
