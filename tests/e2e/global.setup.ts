import { execSync } from 'child_process';

function runRailsCmd(cmd: string): void {
  const railsDir       = process.env.RAILS_DIR;
  const railsContainer = process.env.RAILS_CONTAINER;

  if (railsContainer) {
    // Local dev — no RAILS_ENV override, resets development DB
    execSync(`docker exec ${railsContainer} ${cmd}`, { stdio: 'inherit' });
  } else {
    // CI — test environment
    execSync(cmd, {
      stdio: 'inherit',
      cwd: railsDir || process.cwd(),
      env: { ...process.env, RAILS_ENV: 'test' },
    });
  }
}

async function globalSetup() {
  if (process.env.SKIP_DB_RESET) {
    console.log('[setup] SKIP_DB_RESET set — skipping database reset.');
    return;
  }
  console.log('[setup] Resetting and seeding database...');
  runRailsCmd('bundle exec rake db:db_reset');
  console.log('[setup] Database ready.');
}

export default globalSetup;
