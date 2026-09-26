const { spawnSync } = require('child_process');
const path = require('path');
const task = process.argv[2];
if (!['assembleDebug', 'bundleRelease'].includes(task)) throw new Error('Unsupported Gradle task');
const result = spawnSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [task], {
  cwd: path.resolve(__dirname, '../android'), stdio: 'inherit', shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
