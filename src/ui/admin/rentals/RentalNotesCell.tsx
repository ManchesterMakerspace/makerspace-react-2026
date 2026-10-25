import * as React from "react";
import Tooltip from "@mui/material/Tooltip";

const NOTE_LIMIT = 60;

// A rental's Notes hold staff-facing facts such as "assigned to WOODSHOP" or "contains facilities
// cleaning supplies", plus the member's note on a request and any "Denied: ..." text the system
// appends. Staff need to see them in the table, not only by opening Edit Rental.
export const rentalNote = (rental?: unknown): string =>
  (((rental as { notes?: string | null } | undefined)?.notes) || "").replace(/\s+/g, " ").trim();

export const RentalNotesCell: React.FC<{ rental?: unknown }> = ({ rental }) => {
  const note = rentalNote(rental);
  if (!note) return <>—</>;
  const short = note.length > NOTE_LIMIT ? `${note.slice(0, NOTE_LIMIT - 1)}…` : note;
  return <Tooltip title={note} placement="top"><span>{short}</span></Tooltip>;
};
