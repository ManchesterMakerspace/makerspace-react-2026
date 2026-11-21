const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock("axios", () => ({ __esModule: true, default: { create: () => ({
  post: mockPost, put: mockPut, interceptors: { request: { use: jest.fn() } }
}) } }));
jest.mock("ui/common/globalAuthInterceptor", () => ({ attachGlobalAuthInterceptor: (api: unknown) => api }));

import { adminCreateShop, adminUpdateShop, adminCreateTool, adminUpdateTool } from "api/toolCheckouts";

describe("tool settings requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: {}, headers: {} });
    mockPut.mockResolvedValue({ data: {}, headers: {} });
  });

  it.each([true, false])("sends pending-member access %s with the same create and update settings", async allowPending => {
    const body = { name: "Orientation", shopId: "shop", allowPending, notes: "Key at desk", requestorAnnotation: null,
      prerequisiteIds: [], reservationPrerequisiteToolIds: [], announceChannel: "#announcements", usersChannel: "#users" };
    await adminCreateTool({ body });
    await adminUpdateTool({ id: "tool", body });
    const created = JSON.parse(JSON.stringify(mockPost.mock.calls[0][1]));
    const updated = JSON.parse(JSON.stringify(mockPut.mock.calls[0][1]));
    expect(created).toEqual(updated);
    expect(updated).toMatchObject({ allow_pending: allowPending, notes: "Key at desk", requestor_annotation: null,
      prerequisite_ids: [], reservation_prerequisite_tool_ids: [], announce_channel: "announcements", users_channel: "users" });
  });

  it("preserves unrelated settings when changing only a map location", async () => {
    await adminUpdateTool({ id: "tool", body: { locationId: "location" } });
    expect(JSON.parse(JSON.stringify(mockPut.mock.calls[0][1]))).toEqual({ location_id: "location" });
  });

  it("omits private notes when the editor did not receive them", async () => {
    await adminUpdateTool({ id: "tool", body: { name: "Renamed tool", notes: undefined } });
    expect(JSON.parse(JSON.stringify(mockPut.mock.calls[0][1]))).toEqual({ name: "Renamed tool" });
  });

  it("sends explicit empty values to clear settings", async () => {
    await adminUpdateTool({ id: "tool", body: { allowPending: false, notes: "", locationId: "", wikiUrlOverride: "",
      announceChannel: "", usersChannel: "", prerequisiteIds: [], reservationPrerequisiteToolIds: [], durationFees: [] } });
    expect(JSON.parse(JSON.stringify(mockPut.mock.calls[0][1]))).toEqual({ allow_pending: false, notes: "", location_id: "",
      wiki_url: "", announce_channel: "", users_channel: "", prerequisite_ids: [], reservation_prerequisite_tool_ids: [], duration_fees: [] });
  });

  it.each([true, false])("round trips the shop empty-announcement preference %s", async value => {
    await adminCreateShop({ body: { name: "Woodshop", slackAnnounceEmptyReservations: value } });
    await adminUpdateShop({ id: "shop", body: { slackAnnounceEmptyReservations: value } });
    expect(mockPost.mock.calls[0][1].slack_announce_empty_reservations).toBe(value);
    expect(mockPut.mock.calls[0][1].slack_announce_empty_reservations).toBe(value);
  });

  it("omits an unknown shop empty-announcement preference from unrelated edits", async () => {
    await adminUpdateShop({ id: "shop", body: { name: "Renamed shop" } });
    expect(mockPut.mock.calls[0][1]).not.toHaveProperty("slack_announce_empty_reservations");
  });
});
