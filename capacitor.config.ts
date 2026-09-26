import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'org.manchestermakerspace.portal',
  appName: 'Makerspace',
  webDir: 'dist-native',
  server: { androidScheme: 'https' },
};
export default config;
