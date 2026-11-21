describe('public client configuration refresh', () => {
  const originalFetch = globalThis.fetch;
  let fetchConfig: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchConfig = jest.fn();
    globalThis.fetch = fetchConfig;
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('fresh task-form reads observe setting changes without replacing the shared cached snapshot', async () => {
    fetchConfig.mockResolvedValueOnce({ ok: true, json: async () => ({ wiki_url: 'https://example.com/', volunteer_task_max_credit: 3.5 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ wiki_url: 'https://example.com/', volunteer_task_max_credit: 8 }) });
    const { loadClientConfig } = require('api/clientConfig');
    const initial = loadClientConfig();
    expect(await initial).toMatchObject({ wiki_url: 'https://example.com', volunteer_task_max_credit: 3.5 });
    expect(loadClientConfig()).toBe(initial);
    expect((await loadClientConfig({ refresh: true })).volunteer_task_max_credit).toBe(8);
    expect(loadClientConfig()).toBe(initial);
    expect(fetchConfig).toHaveBeenCalledTimes(2);
  });

  it('retains the shared cache when a fresh read fails and allows a later fresh retry', async () => {
    fetchConfig.mockResolvedValueOnce({ ok: true, json: async () => ({ wiki_url: '', volunteer_task_max_credit: 2 }) })
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ wiki_url: '', volunteer_task_max_credit: 5 }) });
    const { loadClientConfig } = require('api/clientConfig');
    const initial = loadClientConfig();
    await initial;
    await expect(loadClientConfig({ refresh: true })).rejects.toThrow('Unavailable');
    expect(loadClientConfig()).toBe(initial);
    expect((await loadClientConfig({ refresh: true })).volunteer_task_max_credit).toBe(5);
  });
});
