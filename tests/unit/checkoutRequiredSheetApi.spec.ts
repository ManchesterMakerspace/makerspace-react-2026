const mockPost = jest.fn();
const mockUse = jest.fn();
jest.mock('axios', () => ({ create: () => ({ post: mockPost, interceptors: { request: { use: mockUse } } }) }));
jest.mock('ui/common/globalAuthInterceptor', () => ({ attachGlobalAuthInterceptor: (api: any) => api }));
import { generateCheckoutRequiredSheet } from 'api/toolCheckouts';

describe('sheet download API', () => {
  beforeEach(() => jest.clearAllMocks());
  it('requests text with a validated copy count and preserves SVG bytes', async () => {
    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">&amp;</svg>';
    mockPost.mockResolvedValue({ data: svg, headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'x-checkout-sheet-warning': 'missing_shop_channel' } });
    expect(await generateCheckoutRequiredSheet('tool', 'id', 1)).toEqual({ svg, missingChannel: true });
    expect(mockPost).toHaveBeenCalledWith('/api/tools/id/checkout_required_sheet', { copies: 1 }, { responseType: 'text' });
  });
  it('rejects a login HTML response instead of downloading it', async () => {
    mockPost.mockResolvedValue({ data: '<html>Sign in</html>', headers: { 'content-type': 'text/html' } });
    await expect(generateCheckoutRequiredSheet('shop', 'id')).rejects.toThrow('did not return a sheet');
  });
  it('extracts JSON errors received as text', async () => {
    mockPost.mockRejectedValue({ response: { status: 503, data: '{"error":"Short link unavailable"}' } });
    await expect(generateCheckoutRequiredSheet('shop', 'id')).rejects.toThrow('Short link unavailable');
  });
});
