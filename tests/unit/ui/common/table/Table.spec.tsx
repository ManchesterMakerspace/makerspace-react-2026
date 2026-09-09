import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Table from "ui/common/table/Table";

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: "1", name: "First" },
  { id: "2", name: "Second" },
  { id: "3", name: "Third" },
];

const columns = [
  { id: "name", label: "Name", cell: (row: Row) => row.name },
];

describe("Table expanded row rendering", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders detail content directly after the matching row, not after the whole table", () => {
    act(() => {
      root.render(
        <Table
          id="test-table"
          data={rows}
          columns={columns}
          rowId={(row: Row) => row.id}
          expandedRowId="2"
          renderExpandedContent={(row: Row) => <div id="detail-content">Detail for {row.name}</div>}
        />
      );
    });

    const tableRows = Array.from(container.querySelectorAll("tbody tr"));
    // 3 data rows + 1 detail row = 4
    expect(tableRows.length).toBe(4);

    const detailIndex = tableRows.findIndex(row => row.querySelector("#detail-content"));
    const secondRowIndex = tableRows.findIndex(row => row.textContent?.includes("Second"));
    expect(detailIndex).toBe(secondRowIndex + 1);
    expect(container.textContent).toContain("Detail for Second");
  });

  it("renders no extra row when no row matches expandedRowId", () => {
    act(() => {
      root.render(
        <Table
          id="test-table"
          data={rows}
          columns={columns}
          rowId={(row: Row) => row.id}
          expandedRowId="not-a-real-id"
          renderExpandedContent={(row: Row) => <div id="detail-content">Detail for {row.name}</div>}
        />
      );
    });

    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(3);
  });
});
