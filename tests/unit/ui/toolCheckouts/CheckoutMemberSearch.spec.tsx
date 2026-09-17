import * as React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

let mockLoadOptions: (query: string) => Promise<any[]>;
jest.mock("awesome-debounce-promise", () => (fn: any) => fn);
jest.mock("ui/common/AsyncSelect", () => ({
  AsyncSelectFixed: ({ loadOptions }: any) => { mockLoadOptions = loadOptions; return null; },
  AsyncCreatableSelect: () => null
}));
jest.mock("ui/hooks/useWriteTransaction", () => () => ({ call: jest.fn() }));
jest.mock("api/toolCheckouts", () => ({ searchCheckoutMembers: jest.fn() }));
jest.mock("makerspace-ts-api-client", () => ({
  listMembers: jest.fn(), getMember: jest.fn(), message: jest.fn(),
  isApiErrorResponse: (response: any) => !!response.error,
  MemberStatus: { ActiveMember: "activeMember" }
}));
import { listMembers } from "makerspace-ts-api-client";
import { searchCheckoutMembers } from "api/toolCheckouts";
import MemberSearchInput from "ui/common/MemberSearchInput";

describe("checkout member autocomplete", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    const result = { data: [{ id: "member-1", firstname: "Ada", lastname: "Lovelace" }] };
    (listMembers as jest.Mock).mockResolvedValue(result);
    (searchCheckoutMembers as jest.Mock).mockResolvedValue(result);
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); });

  it("uses the server-filtered endpoint only when opted in", async () => {
    await act(async () => root.render(<MemberSearchInput name="member" fullyActiveUnexpired />));
    expect(await mockLoadOptions("Ada")).toEqual([{ id: "member-1", value: "member-1", label: "Ada Lovelace" }]);
    expect(searchCheckoutMembers).toHaveBeenCalledWith("Ada");
    expect(listMembers).not.toHaveBeenCalled();
    await act(async () => root.render(<MemberSearchInput name="member" />));
    await mockLoadOptions("Ada");
    expect(listMembers).toHaveBeenCalledWith({ search: "Ada" });
  });
});
