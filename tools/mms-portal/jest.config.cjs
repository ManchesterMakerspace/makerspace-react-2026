const path = require('node:path');
const root = path.resolve(__dirname, '../..');
module.exports = {
  ...require('../../package.json').jest,
  rootDir: root,
  testEnvironment: 'node',
  testRegex: '/tools/mms-portal/tests/.*\\.spec\\.ts$',
  transform: { '^.+\\.(j|t)sx?$': [require.resolve('ts-jest'), { tsconfig: path.join(__dirname, 'tsconfig.json') }] },
};
