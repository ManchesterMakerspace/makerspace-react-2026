/** Read the current token on every mutation; share only an in-flight bootstrap. */
export const sessionCsrf = (read: () => Promise<{ token: string }>, bootstrap: () => Promise<void>) => {
  let pending: Promise<void> | undefined;
  return async () => {
    let { token } = await read();
    if (!token) {
      pending ||= bootstrap().finally(() => { pending = undefined; });
      await pending;
      token = (await read()).token;
    }
    if (!token) throw new Error('Unable to establish a secure portal session.');
    return token;
  };
};
