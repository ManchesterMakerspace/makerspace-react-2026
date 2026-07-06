import { getRuntimeItemsPerPage } from "ui/common/table/pagination";

describe("getRuntimeItemsPerPage", () => {
  it("uses the first page row count when the backend page size is smaller than the fallback", () => {
    expect(getRuntimeItemsPerPage({
      currentItemCount: 10,
      pageNum: 0,
      totalItems: 80,
      fallbackItemsPerPage: 25,
    })).toBe(10);
  });

  it("uses the first page row count when the backend page size is larger than the fallback", () => {
    expect(getRuntimeItemsPerPage({
      currentItemCount: 50,
      pageNum: 0,
      totalItems: 80,
      fallbackItemsPerPage: 25,
    })).toBe(50);
  });

  it("keeps the previous runtime page size on a shorter final page", () => {
    expect(getRuntimeItemsPerPage({
      currentItemCount: 30,
      pageNum: 1,
      totalItems: 80,
      previousItemsPerPage: 50,
      fallbackItemsPerPage: 25,
    })).toBe(50);
  });
});
