import type { APIRequestContext } from '@playwright/test';
import { restoreMemberPassword } from '../../e2e/fixtures/memberPassword';

jest.mock('@playwright/test', () => ({
  expect: (actual: unknown) => expect(actual),
}));

const EMAIL = 'password_fixture@test.com';
const ORIGINAL_PASSWORD = 'password';
const CHANGED_PASSWORD = 'ChangedPassword1!';

const response = (status: number) => ({ status: () => status });
const storageState = (token: string) => ({
  cookies: [{ name: 'XSRF-TOKEN', value: token }],
  origins: [],
});

describe('restoreMemberPassword', () => {
  let request: {
    get: jest.Mock;
    post: jest.Mock;
    put: jest.Mock;
    storageState: jest.Mock;
    dispose: jest.Mock;
  };

  const restore = () => restoreMemberPassword(
    request as unknown as APIRequestContext,
    EMAIL,
    ORIGINAL_PASSWORD,
    CHANGED_PASSWORD,
  );

  beforeEach(() => {
    request = {
      get: jest.fn().mockResolvedValue(response(200)),
      post: jest.fn().mockResolvedValue(response(200)),
      put: jest.fn().mockResolvedValue(response(204)),
      storageState: jest.fn().mockResolvedValue(storageState('current-token')),
      dispose: jest.fn(),
    };
  });

  afterEach(() => {
    // Playwright owns the request fixture and disposes it after fixture teardown.
    expect(request.dispose).not.toHaveBeenCalled();
  });

  it('restores a changed password using the session token rotated by login', async () => {
    let token = 'before%2Blogin%3D';
    request.storageState.mockImplementation(async () => storageState(token));
    request.post.mockImplementation(async () => {
      token = 'after%2Blogin%3D';
      return response(200);
    });

    await restore();

    expect(request.get).toHaveBeenCalledWith('/api/config');
    expect(request.post).toHaveBeenCalledTimes(1);
    expect(request.post).toHaveBeenCalledWith('/api/members/sign_in', {
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 'before+login=' },
      data: { member: { email: EMAIL, password: CHANGED_PASSWORD } },
    });
    expect(request.put).toHaveBeenCalledTimes(1);
    expect(request.put).toHaveBeenCalledWith('/api/members/change_password', {
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 'after+login=' },
      data: { password: ORIGINAL_PASSWORD },
    });
  });

  it('confirms the original password without changing it if the test failed before saving', async () => {
    request.post
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200));
    request.storageState
      .mockResolvedValueOnce(storageState('first-token'))
      .mockResolvedValueOnce(storageState('retry-token'));

    await restore();

    expect(request.post).toHaveBeenCalledTimes(2);
    expect(request.post).toHaveBeenNthCalledWith(2, '/api/members/sign_in', {
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': 'retry-token' },
      data: { member: { email: EMAIL, password: ORIGINAL_PASSWORD } },
    });
    expect(request.put).not.toHaveBeenCalled();
  });

  it.each([403, 422, 500])('does not hide a login failure with status %i by trying another password', async (status) => {
    request.post.mockResolvedValue(response(status));

    await expect(restore()).rejects.toThrow();

    expect(request.post).toHaveBeenCalledTimes(1);
    expect(request.put).not.toHaveBeenCalled();
  });

  it('fails cleanup if neither known password authenticates', async () => {
    request.post.mockResolvedValue(response(401));

    await expect(restore()).rejects.toThrow();

    expect(request.post).toHaveBeenCalledTimes(2);
    expect(request.put).not.toHaveBeenCalled();
  });

  it('surfaces a rejected password restoration so later retries cannot silently reuse poisoned credentials', async () => {
    request.put.mockResolvedValue(response(422));

    await expect(restore()).rejects.toThrow();

    expect(request.put).toHaveBeenCalledTimes(1);
  });

  it('does not attempt authentication when the session bootstrap fails', async () => {
    request.get.mockResolvedValue(response(500));

    await expect(restore()).rejects.toThrow();

    expect(request.post).not.toHaveBeenCalled();
    expect(request.put).not.toHaveBeenCalled();
  });

  it('supports Rails test mode when forgery protection does not issue a CSRF cookie', async () => {
    request.storageState.mockResolvedValue({ cookies: [], origins: [] });

    await restore();

    expect(request.post).toHaveBeenCalledWith('/api/members/sign_in', expect.objectContaining({
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': '' },
    }));
    expect(request.put).toHaveBeenCalledWith('/api/members/change_password', expect.objectContaining({
      headers: { Accept: 'application/json', 'X-XSRF-TOKEN': '' },
    }));
  });
});
