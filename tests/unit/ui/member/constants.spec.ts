import { getDetailsForMember } from "ui/member/constants";

describe("getDetailsForMember", () => {
  it("gives the household's primary member distinct copy from a secondary member", () => {
    const primary = getDetailsForMember({ groupName: "primary-id", householdRole: "primary" } as any);
    const secondary = getDetailsForMember({ groupName: "primary-id", householdRole: "secondary" } as any);

    expect(primary.type).not.toEqual(secondary.type);
    expect(primary.description).not.toEqual(secondary.description);
    // The primary's own subscription is what the household follows -- the
    // copy should never tell them their own membership follows someone else's.
    expect(primary.description).not.toMatch(/follows the primary member/i);
    expect(secondary.description).toMatch(/follows the primary member/i);
  });

  it("still falls back to the plain subscription details for members with no household", () => {
    const details = getDetailsForMember({ subscriptionId: "sub_123" } as any);
    expect(details.type).toEqual("Subscription");
  });
});
