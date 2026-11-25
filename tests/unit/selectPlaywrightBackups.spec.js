const { selectBackups } = require('../../scripts/select-playwright-backups.cjs');

test('selects each registered backup once for final unexpected Playwright failures', () => {
  const warn = jest.fn();
  const report = {
    suites: [{
      suites: [{
        specs: [
          { tags: ['@backup-signup-catalog'], tests: [{ status: 'unexpected' }] },
          { tags: ['@backup-signup-catalog'], tests: [{ status: 'unexpected' }] },
          { tags: ['backup-member-profile'], tests: [{ status: 'unexpected' }] },
          { tags: ['@backup-household'], tests: [{ status: 'flaky' }] },
          { tags: ['@backup-audit-log'], tests: [{ status: 'expected' }] },
          { tags: ['@backup-expired-profile'], tests: [{ status: 'skipped' }] },
          { tags: ['@backup-unknown-group'], tests: [{ status: 'unexpected' }] },
          { tags: [], tests: [{ status: 'unexpected' }] },
        ],
      }],
    }],
  };

  expect(selectBackups(report, warn)).toEqual([
    'tests/e2e/backups/signup-catalog.spec.ts',
    'tests/e2e/backups/member-profile.spec.ts',
  ]);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown-group'));
});
