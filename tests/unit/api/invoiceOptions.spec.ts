const mockGet = jest.fn();
const mockApi = {
  get: mockGet,
  interceptors: {
    response: { use: jest.fn() },
  },
};

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => mockApi),
  },
}));

jest.mock("ui/common/globalAuthInterceptor", () => ({
  attachGlobalAuthInterceptor: (api: unknown) => api,
}));

import { listSignupInvoiceOptions } from "api/invoiceOptions";

describe("signup invoice options API", () => {
  it("uses the dedicated signup endpoint", async () => {
    mockGet.mockResolvedValueOnce({
      data: [],
      headers: {},
      status: 200,
    });

    const response = await listSignupInvoiceOptions({});

    expect(mockGet).toHaveBeenCalledWith("/api/invoice_options/signup");
    expect(response).toMatchObject({ data: [] });
  });
});
