const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dir = path.resolve(__dirname, '..');
const { settings } = require('../config.cjs');
const built = JSON.parse(fs.readFileSync(path.join(dir, 'www/build-settings.json'), 'utf8'));
if (JSON.stringify(built) !== JSON.stringify(settings())) throw new Error('Build and sync settings differ; rebuild first.');
execFileSync(process.execPath, [require.resolve('@capacitor/cli/bin/capacitor'), 'sync', 'android'], { cwd: dir, stdio: 'inherit' });
// Firebase's native plugin initializes on launch. Leave it unregistered in a
// password-only debug build until the real Android Firebase config is supplied.
if (!fs.existsSync(path.join(dir, 'android/app/google-services.json'))) {
  const pluginsFile = path.join(dir, 'android/app/src/main/assets/capacitor.plugins.json');
  const plugins = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  fs.writeFileSync(pluginsFile, JSON.stringify(plugins.filter(plugin => plugin.pkg !== '@capacitor-firebase/authentication'), null, 2));
  console.warn('Google sign-in is unavailable in this debug build: supply android/app/google-services.json and sync again.');
}
