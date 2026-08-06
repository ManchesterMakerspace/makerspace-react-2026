import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockListBlackouts = jest.fn();
const mockCreateBlackout = jest.fn();
const mockUpdateBlackout = jest.fn();
const mockDeleteBlackout = jest.fn();
const mockListManagedShops = jest.fn();

jest.mock("api/reservations", () => ({
  listReservationBlackouts: (...args: unknown[]) => mockListBlackouts(...args),
  createReservationBlackout: (...args: unknown[]) => mockCreateBlackout(...args),
  updateReservationBlackout: (...args: unknown[]) => mockUpdateBlackout(...args),
  deleteReservationBlackout: (...args: unknown[]) => mockDeleteBlackout(...args),
}));

jest.mock("api/toolCheckouts", () => ({
  listManagedShops: (...args: unknown[]) => mockListManagedShops(...args),
}));

import ReservationBlackouts from "ui/reservations/ReservationBlackouts";

const blackout = {
  id: "blackout-1",
  title: "Open House",
  shopId: "shop-1",
  shopName: "Woodshop",
  recurrence: "weekly" as const,
  weekday: 1,
  startTime: "17:00",
  endTime: "20:00",
  createdById: "member-1",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("ReservationBlackouts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListManagedShops.mockResolvedValue({
      data: [{ id: "shop-1", name: "Woodshop" }],
    });
    mockListBlackouts.mockResolvedValue({ data: [] });
    mockCreateBlackout.mockResolvedValue({ data: blackout });
    mockUpdateBlackout.mockResolvedValue({ data: blackout });
    mockDeleteBlackout.mockResolvedValue({ data: {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
  });

  const render = async () => {
    await act(async () => {
      root.render(<ReservationBlackouts />);
    });
  };

  const button = (label: string) => Array.from(container.querySelectorAll("button"))
    .find(item => item.textContent?.trim() === label) as HTMLButtonElement;

  it("submits an entire-day blackout as midnight to midnight and refreshes the list", async () => {
    await render();

    const title = container.querySelector('input[type="text"]') as HTMLInputElement;
    const entireDay = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(title, "All day maintenance");
      entireDay.click();
    });
    await act(async () => button("Add Blackout").click());

    expect(mockCreateBlackout).toHaveBeenCalledWith({
      body: expect.objectContaining({
        title: "All day maintenance",
        startTime: "00:00",
        endTime: "00:00",
      }),
    });
    expect(mockListBlackouts).toHaveBeenCalledTimes(2);
  });

  it("refreshes after editing a blackout", async () => {
    mockListBlackouts.mockResolvedValue({ data: [blackout] });
    await render();

    await act(async () => button("Edit").click());
    const entireDay = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => entireDay.click());
    await act(async () => button("Save Blackout").click());

    expect(mockUpdateBlackout).toHaveBeenCalledWith({
      id: "blackout-1",
      body: expect.objectContaining({ startTime: "00:00", endTime: "00:00" }),
    });
    expect(mockListBlackouts).toHaveBeenCalledTimes(2);
  });

  it("refreshes after deleting a blackout", async () => {
    mockListBlackouts.mockResolvedValue({ data: [blackout] });
    jest.spyOn(window, "confirm").mockReturnValue(true);
    await render();

    await act(async () => button("Delete").click());

    expect(mockDeleteBlackout).toHaveBeenCalledWith({ id: "blackout-1" });
    expect(mockListBlackouts).toHaveBeenCalledTimes(2);
  });
});
