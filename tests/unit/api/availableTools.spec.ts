const mockGet = jest.fn().mockResolvedValue({ data: [], headers: {}, status: 200 });
jest.mock('axios', () => ({ __esModule: true, default: { create: () => ({
  get: mockGet, interceptors: { request: { use: jest.fn() } }
}) } }));
jest.mock('ui/common/globalAuthInterceptor', () => ({ attachGlobalAuthInterceptor: (api: unknown) => api }));
import { listAvailableTools } from 'api/toolCheckouts';

it('sends shop_id only for a selected shop', async () => {
  await listAvailableTools({ shopId: 'woodshop' });
  expect(mockGet).toHaveBeenLastCalledWith('/api/tools', { params: { shop_id: 'woodshop' } });
  await listAvailableTools();
  expect(mockGet).toHaveBeenLastCalledWith('/api/tools', { params: {} });
  await listAvailableTools({ shopId: '' });
  expect(mockGet).toHaveBeenLastCalledWith('/api/tools', { params: {} });
});
