import { toolPublicUrl } from "ui/toolCheckouts/toolPublicUrl";
describe("tool QR destination", () => {
  it("uses the configured HTTPS domain, never the browser origin", () => {
    expect(toolPublicUrl("portal.example.test", "0123456789abcdef01234567"))
      .toBe("https://portal.example.test/api/tool/0123456789abcdef01234567/public.html");
  });
  it.each([undefined, "", "https://portal.example.test", "portal.example.test/path", "user@portal.example.test"])("rejects invalid configuration %s", domain => {
    expect(() => toolPublicUrl(domain, "abc")).toThrow();
  });
});
