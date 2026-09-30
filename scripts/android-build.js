const { spawnSync } = require('child_process');
const path = require('path');
const task = process.argv[2];
if (!['assembleDebug', 'bundleRelease'].includes(task)) throw new Error('Unsupported Gradle task');
const windows = process.platform === 'win32';
// Git checkouts may not preserve the wrapper's executable bit.
const result = spawnSync(windows ? 'gradlew.bat' : 'sh', windows ? [task] : ['./gradlew', task], {
  cwd: path.resolve(__dirname, '../android'), stdio: 'inherit', shell: windows,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
