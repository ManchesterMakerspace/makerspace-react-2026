import type { CapacitorConfig } from '@capacitor/cli';
const { settings } = require('./config.cjs');
const { origin, debug } = settings();
const config: CapacitorConfig = {
  appId: 'org.manchestermakerspace.portal',
  appName: 'MMS Portal',
  webDir: 'www',
  loggingBehavior: 'none',
  server: { hostname: 'localhost', androidScheme: 'https', cleartext: debug && origin.startsWith('http:') },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: debug },
  plugins: {
    // Only first-party requests use the explicit HTTP adapters.
    CapacitorHttp: { enabled: false },
    CapacitorCookies: { enabled: false },
    PortalSession: { apiOrigin: origin },
    FirebaseAuthentication: { skipNativeAuth: false, providers: ['google.com'] },
    SplashScreen: { launchAutoHide: true, launchShowDuration: 800, backgroundColor: '#FFFFFF' },
  },
};
export default config;
