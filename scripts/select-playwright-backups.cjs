const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const routes = require('../tests/e2e/consolidated-routes.json');

function selectBackups(report, warn) {
  const selected = new Set();

  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      if (!spec.tests.some(test => test.status === 'unexpected')) continue;

      for (const tag of spec.tags ?? []) {
        // The JSON reporter can strip the leading '@' from declared tags.
        const group = /^@?backup-([a-z0-9-]+)$/.exec(tag)?.[1];
        if (!group) continue;
        if (!Object.hasOwn(routes, group)) {
          warn(`Unexpected Playwright failure references unknown backup group "${group}".`);
          continue;
        }
        selected.add(`tests/e2e/backups/${group}.spec.ts`);
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  }

  for (const suite of report.suites ?? []) visit(suite);
  return [...selected];
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const reportPath = process.argv[2] ?? path.join(root, 'tmp/playwright-primary.json');
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (!Array.isArray(report?.suites)) throw new SyntaxError('Expected a Playwright report with a suites array.');
    const selected = selectBackups(report, console.warn);
    for (const spec of selected) {
      if (!existsSync(path.join(root, spec))) throw new Error(`Missing Playwright backup: ${spec}`);
    }
    if (selected.length === 0) console.error('No final Playwright failures have a registered backup.');
    if (selected.length > 0) console.log(selected.join('\n'));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    console.warn(`Playwright backup selection skipped: ${error.message}`);
  }
}

module.exports = { selectBackups };
