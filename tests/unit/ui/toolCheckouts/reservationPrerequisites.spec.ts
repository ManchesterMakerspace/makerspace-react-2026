import { togglePrerequisiteToolId } from "ui/toolCheckouts/reservationPrerequisites";

describe("togglePrerequisiteToolId", () => {
  it("selects a tool without nesting the existing ID array", () => {
    expect(togglePrerequisiteToolId(["first-tool"], "second-tool")).toEqual([
      "first-tool",
      "second-tool"
    ]);
  });

  it("deselects an already selected tool", () => {
    expect(togglePrerequisiteToolId(
      ["first-tool", "second-tool"],
      "first-tool"
    )).toEqual(["second-tool"]);
  });
});
