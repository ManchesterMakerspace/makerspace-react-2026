import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

jest.mock("api/toolCheckouts", () => ({
  // Fail the Google lookup so the field uses its built-in 11-color palette.
  listGoogleCalendarColors: jest.fn(async () => ({ error: { message: "offline" } })),
}));

import ShopColorField, { colorUsage, FALLBACK_COLORS } from "ui/toolCheckouts/ShopColorField";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("colorUsage", () => {
  const shops = [
    { id: "a", name: "Laser", colorId: "4" },
    { id: "b", name: "Woodshop", colorId: "4" },
    { id: "c", name: "Paint", colorId: "9" },
    { id: "d", name: "No color" },
  ];

  it("lists the shops using each color, ignoring shops with none", () => {
    expect(colorUsage(shops)).toEqual({ "4": ["Laser", "Woodshop"], "9": ["Paint"] });
  });

  it("leaves out the shop being edited, so its own color is not reported as shared", () => {
    expect(colorUsage(shops, "a")).toEqual({ "4": ["Woodshop"], "9": ["Paint"] });
    expect(colorUsage(shops, "c")).toEqual({ "4": ["Laser", "Woodshop"] });
  });

  it("copes with no shops at all", () => {
    expect(colorUsage()).toEqual({});
    expect(colorUsage(undefined, "x")).toEqual({});
  });
});

describe("ShopColorField with colors that other shops use", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = "";
  });

  const render = async (value: string, usedBy: Record<string, string[]>, onChange = jest.fn()) => {
    await act(async () => { root.render(<ShopColorField value={value} onChange={onChange} usedBy={usedBy} />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    return onChange;
  };

  it("warns, without blocking, when the chosen color is shared", async () => {
    await render("4", { "4": ["Laser"] });
    expect(host.textContent).toContain("Laser already uses this color");
    expect(host.textContent).toContain("You can keep it");
  });

  it("names every shop when several share the color", async () => {
    await render("4", { "4": ["Laser", "Woodshop", "Paint"] });
    expect(host.textContent).toContain("Laser, Woodshop, and Paint already use this color");
  });

  it("shortens a long list of shops instead of listing them all", async () => {
    await render("4", { "4": ["Laser", "Woodshop", "Paint", "Metal Shop", "Textile Arts"] });
    expect(host.textContent).toContain("Laser, Woodshop, Paint, and 2 others already use this color");
    expect(host.textContent).not.toContain("Textile Arts");

    act(() => root.unmount());
    root = createRoot(host);
    await render("4", { "4": ["Laser", "Woodshop", "Paint", "Metal Shop"] });
    expect(host.textContent).toContain("Laser, Woodshop, Paint, and 1 other already use this color");
  });

  it("shows no warning for a color nobody else uses", async () => {
    await render("2", { "4": ["Laser"] });
    expect(host.textContent).not.toContain("already use");
  });

  it("still offers every color, marking the ones that are shared", async () => {
    await render("2", { "4": ["Laser"], "9": ["Paint", "Woodshop"] });
    const combobox = host.querySelector('[role="combobox"]') as HTMLElement;
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    });

    const options = Array.from(document.querySelectorAll('[role="option"]'));
    // "No color selected" plus all 11 -- nothing is hidden because another shop has it.
    expect(options.length).toBe(FALLBACK_COLORS.length + 1);
    const flamingo = options.find(option => option.textContent?.includes("Flamingo"))!;
    expect(flamingo.textContent).toContain("also used by Laser");
    const blueberry = options.find(option => option.textContent?.includes("Blueberry"))!;
    expect(blueberry.textContent).toContain("also used by Paint and Woodshop");
    const sage = options.find(option => option.textContent?.includes("Sage"))!;
    expect(sage.textContent).not.toContain("also used by");
  });

  it("gives a new shop an unused color by default when there is one, and any color when there is not", async () => {
    const onChange = jest.fn();
    await render("", { "1": ["A"], "2": ["B"] }, onChange);
    expect(onChange).toHaveBeenCalledWith("3");

    const everyColor = Object.fromEntries(FALLBACK_COLORS.map(color => [color.id, ["Someone"]]));
    const onChangeAll = jest.fn();
    act(() => root.unmount());
    root = createRoot(host);
    await render("", everyColor, onChangeAll);
    expect(onChangeAll).toHaveBeenCalledWith("1");
  });
});
