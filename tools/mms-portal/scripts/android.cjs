const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dir = path.resolve(__dirname, '..');
const release = process.argv[2] === 'release';
const env = { ...process.env, MMS_PORTAL_DEBUG: release ? 'false' : 'true' };
if (release && !env.MMS_PORTAL_KEYSTORE) throw new Error('Signed release requires MMS_PORTAL_KEYSTORE and the signing settings documented in README.md.');
for (const script of ['build.cjs', 'sync.cjs']) execFileSync(process.execPath, [path.join(__dirname, script)], { cwd: dir, env, stdio: 'inherit' });
const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
execFileSync(command, [release ? 'assembleRelease' : 'assembleDebug'], { cwd: path.join(dir, 'android'), env, stdio: 'inherit', shell: process.platform === 'win32' });
