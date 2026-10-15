// Plain-language problems for the Add/Edit Rental Spot form. The server stays the authority (RentalSpot validates the
// number's format and uniqueness); these checks only explain the same rules before and after a save attempt.

// Same rule as RentalSpot#number on the server: the number is used in links, so no spaces or special characters.
export const SPOT_NUMBER_PATTERN = /^[A-Za-z0-9_-]+$/;

export const SPOT_NUMBER_HINT = "Letters, numbers, hyphens and underscores only, no spaces (for example LR-Tote-1). Must be unique.";

/** Why this text cannot be a spot number, or "" when it is acceptable (an empty value is left to the required checks). */
export const spotNumberProblem = (value: string): string => {
  if (!value || SPOT_NUMBER_PATTERN.test(value)) return "";
  if (/\s/.test(value)) {
    const edge = value !== value.trim() ? " (check the start and end too)" : "";
    return `A spot number can't contain spaces${edge}. Use a hyphen instead, for example LR-Tote-1.`;
  }
  const bad = Array.from(new Set(value.split("").filter(c => !/[A-Za-z0-9_-]/.test(c)))).join(" ");
  return `A spot number can only contain letters, numbers, hyphens and underscores. Remove: ${bad}`;
};

interface SpotLike { id?: string; number?: string; location?: string; rentalTypeId?: string; }

/** Another already-loaded spot with this exact number (the server compares case-sensitively too). */
export const duplicateSpotNumber = (number: string, spots: SpotLike[], editingId?: string): string => {
  if (!number) return "";
  const clash = spots.find(spot => spot.number === number && spot.id !== editingId);
  return clash ? `A rental spot numbered "${number}" already exists. Spot numbers must be unique, so choose a different one.` : "";
};

/** The first thing wrong with the form, or "" when it can be saved. */
export const validateSpotForm = (spot: SpotLike, spots: SpotLike[], editingId?: string): string => {
  const number = spot.number || "";
  if (!number.trim()) return "Enter a spot number.";
  return spotNumberProblem(number)
    || duplicateSpotNumber(number, spots, editingId)
    || (!(spot.location || "").trim() ? "Enter a location." : "")
    || (!spot.rentalTypeId ? "Choose a rental type." : "");
};

/** Turns the server's validation text into plain sentences; unknown messages pass through without the boilerplate. */
export const friendlyRentalSpotError = (message?: string): string => {
  if (!message) return "";
  const text = String(message);
  const found: string[] = [];
  if (/number can't be blank/i.test(text)) found.push("Enter a spot number.");
  if (/number (?:has already been|is already) taken/i.test(text)) {
    found.push("That spot number is already in use. Spot numbers must be unique, so choose a different one.");
  }
  if (/number can only contain/i.test(text)) {
    found.push("A spot number can only contain letters, numbers, hyphens and underscores, with no spaces or special characters, because it is used in the spot's link.");
  }
  if (/location can't be blank/i.test(text)) found.push("Enter a location.");
  if (/rental type can't be blank/i.test(text)) found.push("Choose a rental type.");
  if (found.length) return found.join(" ");
  return text
    .replace(/^\s*Summary:\s*/i, "")
    .replace(/^\s*The following errors were found:\s*/i, "")
    .replace(/\s*Resolution:[\s\S]*$/i, "")
    .trim() || text;
};
