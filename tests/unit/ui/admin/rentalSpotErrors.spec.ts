import {
  duplicateSpotNumber, friendlyRentalSpotError, spotNumberProblem, validateSpotForm,
} from "ui/admin/rentals/rentalSpotErrors";

const spots = [
  { id: "a1", number: "Tote-1", location: "Locker Room", rentalTypeId: "t1" },
  { id: "a2", number: "Tote-2", location: "Locker Room", rentalTypeId: "t1" },
];

describe("spotNumberProblem", () => {
  it("accepts letters, numbers, hyphens and underscores, and stays quiet for an empty field", () => {
    ["LR-Tote-1", "Shelf-1a", "BS_Tote_12", "x"].forEach(value => expect(spotNumberProblem(value)).toBe(""));
    expect(spotNumberProblem("")).toBe("");
  });

  it("explains a space and suggests a hyphen", () => {
    expect(spotNumberProblem("LR Tote 1")).toBe("A spot number can't contain spaces. Use a hyphen instead, for example LR-Tote-1.");
  });

  it("points at spaces at the start or end, which are easy to miss", () => {
    expect(spotNumberProblem("Tote-1 ")).toContain("check the start and end too");
    expect(spotNumberProblem(" Tote-1")).toContain("check the start and end too");
  });

  it("lists the characters that are not allowed, once each", () => {
    expect(spotNumberProblem("Tote/1.a/b")).toBe(
      "A spot number can only contain letters, numbers, hyphens and underscores. Remove: / .");
  });
});

describe("duplicateSpotNumber", () => {
  it("flags a number already used by another spot", () => {
    expect(duplicateSpotNumber("Tote-1", spots)).toContain('already exists');
  });
  it("does not flag the spot being edited, or a new number", () => {
    expect(duplicateSpotNumber("Tote-1", spots, "a1")).toBe("");
    expect(duplicateSpotNumber("Tote-3", spots)).toBe("");
    expect(duplicateSpotNumber("", spots)).toBe("");
  });
  it("is case-sensitive, like the server", () => {
    expect(duplicateSpotNumber("tote-1", spots)).toBe("");
  });
});

describe("validateSpotForm", () => {
  const good = { number: "Tote-3", location: "Locker Room", rentalTypeId: "t1" };
  it("passes a complete form", () => {
    expect(validateSpotForm(good, spots)).toBe("");
  });
  it("reports the first problem in a sensible order", () => {
    expect(validateSpotForm({ ...good, number: "" }, spots)).toBe("Enter a spot number.");
    expect(validateSpotForm({ ...good, number: "   " }, spots)).toBe("Enter a spot number.");
    expect(validateSpotForm({ ...good, number: "Tote 3" }, spots)).toContain("can't contain spaces");
    expect(validateSpotForm({ ...good, number: "Tote-2" }, spots)).toContain("already exists");
    expect(validateSpotForm({ ...good, location: " " }, spots)).toBe("Enter a location.");
    expect(validateSpotForm({ ...good, rentalTypeId: "" }, spots)).toBe("Choose a rental type.");
  });
  it("lets an existing spot keep its own number when editing", () => {
    expect(validateSpotForm({ id: "a1", number: "Tote-1", location: "Locker Room", rentalTypeId: "t1" }, spots, "a1")).toBe("");
  });
});

describe("friendlyRentalSpotError", () => {
  it("explains a duplicate number from the server's message", () => {
    expect(friendlyRentalSpotError("The following errors were found: Number has already been taken")).toBe(
      "That spot number is already in use. Spot numbers must be unique, so choose a different one.");
  });

  it("explains a bad character or space from the server's message", () => {
    const server = "The following errors were found: Number can only contain letters, numbers, hyphens, and underscores (no spaces or special characters), so it can be used in a rental deep link";
    expect(friendlyRentalSpotError(server)).toBe(
      "A spot number can only contain letters, numbers, hyphens and underscores, with no spaces or special characters, because it is used in the spot's link.");
  });

  it("still recognises the older wording", () => {
    expect(friendlyRentalSpotError("Number is already taken")).toContain("already in use");
  });

  it("reports several problems together", () => {
    const message = friendlyRentalSpotError("The following errors were found: Location can't be blank, Rental type can't be blank");
    expect(message).toBe("Enter a location. Choose a rental type.");
  });

  it("works whether or not Mongoid's Summary/Resolution wording is present", () => {
    const full = "\nSummary:\nThe following errors were found: Number has already been taken\n\nResolution:\nTry persisting the document with valid data or remove the validations.";
    expect(friendlyRentalSpotError(full)).toBe("That spot number is already in use. Spot numbers must be unique, so choose a different one.");
  });

  it("passes an unknown message through without the boilerplate, and handles empty input", () => {
    expect(friendlyRentalSpotError("The following errors were found: Something new went wrong")).toBe("Something new went wrong");
    expect(friendlyRentalSpotError("Network unavailable")).toBe("Network unavailable");
    expect(friendlyRentalSpotError("")).toBe("");
    expect(friendlyRentalSpotError(undefined)).toBe("");
  });
});
