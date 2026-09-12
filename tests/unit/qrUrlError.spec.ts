import { qrUrlError } from "ui/common/qrUrlError";
describe("QR destination validation", () => {
  it.each(["localhost", "LOCALHOST.", "sub.localhost", "127.0.0.1", "127.1", "2130706433", "[::1]", "[::ffff:127.0.0.1]", "0.0.0.0"])("rejects %s", host => {
    expect(qrUrlError(`http://${host}/L23456789AB`)).toContain("localhost");
  });
  it("accepts a public URL and port", () => {
    expect(qrUrlError("HTTPS://MEMBERS.EXAMPLE.ORG:8443/L23456789AB")).toBe("");
  });
  it.each(["bad", "javascript:alert(1)", "https://user@members.example.org/test"])("rejects invalid target %s", value => {
    expect(qrUrlError(value)).toContain("invalid URL");
  });
});
