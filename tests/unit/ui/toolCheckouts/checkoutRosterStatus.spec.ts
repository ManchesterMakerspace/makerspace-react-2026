import { ToolCheckout } from "app/entities/toolCheckout";
import { keepReinstatedPairsTogether, rosterStatus, statusFilterParams } from "ui/toolCheckouts/checkoutRosterStatus";

const row = (id: string, extra: Partial<ToolCheckout> = {}) => ({ id, active: true, ...extra } as ToolCheckout);

describe("checkout roster status helpers", () => {
  it("maps the Status filter to server params", () => {
    expect(statusFilterParams("active")).toEqual({ active: true });
    expect(statusFilterParams("revoked")).toEqual({ active: false, reinstated: false });
    expect(statusFilterParams("reinstated")).toEqual({ reinstated: true });
    expect(statusFilterParams("all")).toEqual({});
  });

  it("derives the displayed status without relying on edited data", () => {
    expect(rosterStatus(row("a"))).toBe("active");
    expect(rosterStatus(row("b", { reinstatedFromId: "x" }))).toBe("reinstatedActive");
    expect(rosterStatus(row("c", { active: false }))).toBe("revoked");
    expect(rosterStatus(row("d", { active: false, reinstated: true }))).toBe("reinstatedRevoked");
  });

  it("keeps a reinstated pair adjacent with the active row first, in any input order", () => {
    const old = row("old", { active: false, reinstated: true });
    const replacement = row("new", { reinstatedFromId: "old" });
    const other = row("other");
    const mid = row("mid");
    expect(keepReinstatedPairsTogether([old, other, mid, replacement]).map(r => r.id)).toEqual(["other", "mid", "new", "old"]);
    expect(keepReinstatedPairsTogether([replacement, other, old]).map(r => r.id)).toEqual(["new", "old", "other"]);
  });

  it("leaves rows alone when a counterpart is not in the list", () => {
    const rows = [row("new", { reinstatedFromId: "old" }), row("x")];
    expect(keepReinstatedPairsTogether(rows)).toBe(rows);
  });
});
