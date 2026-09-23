interface GoogleBridge {
  configuration: () => Promise<{ configured: boolean; projectId: string }>;
  projectId: () => string;
  signIn: () => Promise<unknown>;
  idToken: () => Promise<{ token: string }>;
}
export const googleSignIn = (bridge: GoogleBridge) => async (): Promise<string> => {
  const config = await bridge.configuration();
  if (!config.configured || config.projectId !== bridge.projectId()) {
    throw new Error('Google sign-in is not configured for this portal build. Use your email and password.');
  }
  await bridge.signIn();
  const { token } = await bridge.idToken();
  if (!token) throw new Error('Google did not return a sign-in token. Please try again.');
  return token;
};
