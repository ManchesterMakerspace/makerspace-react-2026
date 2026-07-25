import { FALLBACK_COLORS } from "ui/toolCheckouts/ShopColorField";

describe("ShopColorField fallback colors", () => {
  it("maps Google event color IDs to their actual palette", () => {
    expect(FALLBACK_COLORS.map(color => [
      color.id,
      color.name,
      color.backgroundColor,
      color.foregroundColor,
    ])).toEqual([
      ["1", "Lavender", "#a4bdfc", "#1d1d1d"],
      ["2", "Sage", "#7ae7bf", "#1d1d1d"],
      ["3", "Grape", "#dbadff", "#1d1d1d"],
      ["4", "Flamingo", "#ff887c", "#1d1d1d"],
      ["5", "Banana", "#fbd75b", "#1d1d1d"],
      ["6", "Tangerine", "#ffb878", "#1d1d1d"],
      ["7", "Peacock", "#46d6db", "#1d1d1d"],
      ["8", "Graphite", "#e1e1e1", "#1d1d1d"],
      ["9", "Blueberry", "#5484ed", "#1d1d1d"],
      ["10", "Basil", "#51b749", "#1d1d1d"],
      ["11", "Tomato", "#dc2127", "#1d1d1d"],
    ]);
  });
});
