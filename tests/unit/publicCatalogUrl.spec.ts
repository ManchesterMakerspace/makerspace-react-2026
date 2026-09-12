import { configuredPublicUrl } from "ui/common/publicCatalogUrl";
import { loadClientConfig } from "api/clientConfig";
jest.mock("api/clientConfig", () => ({ loadClientConfig: jest.fn() }));
const path = "/api/tool/0123456789abcdef01234567/public.html";
describe("configured public fallback URLs", () => {
  it.each(["public.example.org", "https://public.example.org/", "http://public.example.org"])("uses HTTPS config origin for %s instead of browser origin", async app_domain => {
    (loadClientConfig as jest.Mock).mockResolvedValue({ app_domain });
    expect(await configuredPublicUrl(path)).toBe(`https://public.example.org${path}`);
  });
  it("preserves configured ports", async () => {
    (loadClientConfig as jest.Mock).mockResolvedValue({ app_domain: "https://public.example.org:8443/" });
    expect(await configuredPublicUrl(path)).toBe(`https://public.example.org:8443${path}`);
  });
  it.each([undefined, "", "user@host.test", "host.test/path", "host.test?query=1"])("rejects unusable config %s without using the browser origin", async app_domain => {
    (loadClientConfig as jest.Mock).mockResolvedValue({ app_domain });
    await expect(configuredPublicUrl(path)).rejects.toThrow();
  });
});
