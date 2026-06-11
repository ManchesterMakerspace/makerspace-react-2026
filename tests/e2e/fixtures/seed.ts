import { execSync } from 'child_process';

function runRailsCmd(cmd: string): void {
  const railsDir       = process.env.RAILS_DIR;
  const railsContainer = process.env.RAILS_CONTAINER;

  if (railsContainer) {
    // Local dev — exec into Docker container (no RAILS_ENV override, uses dev DB)
    execSync(`docker exec ${railsContainer} ${cmd}`, { stdio: 'pipe' });
  } else {
    // CI — Rails runs natively in test mode
    execSync(cmd, {
      stdio: 'pipe',
      cwd: railsDir || process.cwd(),
      env: { ...process.env, RAILS_ENV: 'test' },
    });
  }
}

export const createRejectCard = (uid: string): void => {
  runRailsCmd(`bundle exec rake "db:reject_card[${uid}]"`);
};

export const cancelMemberSubscription = (email: string): void => {
  runRailsCmd(`bundle exec rake "db:braintree_webhook[${email}]"`);
};

export const seedVolunteerCredits = (email: string, count: number = 1): void => {
  runRailsCmd(`bundle exec rake "db:seed_volunteer_credits[${email},${count}]"`);
};
