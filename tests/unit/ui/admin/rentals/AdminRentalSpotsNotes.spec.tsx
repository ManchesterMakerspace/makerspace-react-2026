import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

let mockSpots: any[] = [];
jest.mock("api/rentals", () => ({
  adminListRentalSpots: jest.fn(), adminCreateRentalSpot: jest.fn(),
  adminUpdateRentalSpot: jest.fn(), adminDeleteRentalSpot: jest.fn(),
  adminListRentalTypes: jest.fn(),
}));
jest.mock("api/shortcodes", () => ({ createShortLink: jest.fn() }));
jest.mock("ui/hooks/useReadTransaction", () => {
  const api = jest.requireMock("api/rentals");
  return {
    __esModule: true,
    default: (transaction: unknown) => transaction === api.adminListRentalTypes
      ? { data: [], refresh: jest.fn() }
      : { data: mockSpots, response: undefined, isRequesting: false, refresh: jest.fn(), error: undefined },
  };
});
jest.mock("ui/hooks/useWriteTransaction", () => ({
  __esModule: true,
  default: () => ({ call: jest.fn(), isRequesting: false, error: undefined }),
}));
jest.mock("ui/common/Filters/QueryContext", () => ({
  withQueryContext: (component: any) => component,
  useQueryContext: () => ({ params: { pageNum: 0 }, changePage: jest.fn(), setParam: jest.fn() }),
}));
jest.mock("ui/common/FormModal", () => () => null);
jest.mock("ui/admin/rentals/RentalSpotQrCodeModal", () => () => null);
jest.mock("ui/admin/rentals/RentalSpotLabelModal", () => () => null);
jest.mock("ui/admin/rentals/RentalSpotBulkLabelModal", () => () => null);
// The real table needs much more context; this stand-in renders each column's header and cell.
jest.mock("ui/common/table/StatefulTable", () => ({ data, columns }: any) => (
  <table>
    <thead><tr>{columns.map((column: any) => <th key={column.id}>{column.label}</th>)}</tr></thead>
    <tbody>
      {data.map((row: any) => (
        <tr key={row.id} data-spot={row.number}>
          {columns.map((column: any) => <td key={column.id} data-col={column.id}>{column.cell(row)}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
));

import AdminRentalSpots from "ui/admin/rentals/AdminRentalSpots";

const spot = (id: string, number: string, notes: string | null) => ({
  id, number, location: "Locker Room", description: "Black Tote", rentalTypeDisplayName: "Tote",
  requiresApproval: false, active: true, available: true, parentNumber: null, notes,
});

describe("Rental Spots tab", () => {
  let container: HTMLDivElement, root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const cell = (number: string) =>
    container.querySelector(`tr[data-spot="${number}"] td[data-col="notes"]`)!.textContent;

  it("has a Notes column, so a spot's note is visible without opening Edit Spot", async () => {
    mockSpots = [
      spot("1", "Tote-01", "holds facilities cleaning supplies, not for rent"),
      spot("2", "Tote-02", null),
      spot("3", "Tote-03", "  free bin,\n historical agreement "),
    ];
    await act(async () => root.render(<AdminRentalSpots />));
    const headers = Array.from(container.querySelectorAll("th")).map(th => th.textContent);
    expect(headers).toContain("Notes");
    expect(headers[headers.length - 1]).toBe("Notes");
    expect(cell("Tote-01")).toBe("holds facilities cleaning supplies, not for rent");
    expect(cell("Tote-03")).toBe("free bin, historical agreement");
  });

  it("shows a dash when a spot has no note, and shortens a long one", async () => {
    mockSpots = [spot("1", "Tote-01", null), spot("2", "Tote-02", "x".repeat(200))];
    await act(async () => root.render(<AdminRentalSpots />));
    expect(cell("Tote-01")).toBe("—");
    expect(cell("Tote-02")!.length).toBe(60);
    expect(cell("Tote-02")!.endsWith("…")).toBe(true);
  });
});
